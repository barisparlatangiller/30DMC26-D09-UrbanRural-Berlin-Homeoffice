"""
1 km grid for Berlin and Brandenburg: dwellings, vacancy rate, market-active vacancy rate (Zensus 2022, Destatis) and
the municipality (BKG VG250) each cell lies in.

  vacant      ≈ dwellings × Leerstandsquote
  vacant_ma   ≈ dwellings × marktaktive Leerstandsquote (vacant and available on the market within ~3 months)
Cells whose rate is suppressed ("–") keep the dwelling count but have no vacancy figure.

  python pipeline/a_cells.py
Output  build/cells.parquet
"""
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
import shapely

D, IN, B = Path("data"), Path("input"), Path("build")
IN.mkdir(exist_ok=True); B.mkdir(exist_ok=True)
DW_URL = "https://www.destatis.de/static/DE/zensus/gitterdaten/Wohnungen_nach_Gebaeudetyp_Groesse.zip"


def num(s):
    return pd.to_numeric(s.astype(str).str.replace("–", "").str.replace(".", "", regex=False).str.replace(",", ".").str.strip(), errors="coerce")


def dwellings():
    f = IN / "Wohnungen_nach_Gebaeudetyp_Groesse.zip"
    if not f.exists():
        r = requests.get(DW_URL, timeout=900, headers={"User-Agent": "Mozilla/5.0 30DMC26"}); r.raise_for_status(); f.write_bytes(r.content)
    z = zipfile.ZipFile(f)
    name = next(n for n in z.namelist() if "1km" in n and n.lower().endswith(".csv"))
    t = pd.read_csv(z.open(name), sep=";", dtype=str, encoding="latin-1")
    print("dwellings file:", name, list(t.columns))
    tot = next((c for c in t.columns if c.lower() in ("insgesamt_wohnungen", "insgesamt", "wohnungen")), None)
    vals = [c for c in t.columns if c not in ("GITTER_ID_1km", "x_mp_1km", "y_mp_1km") and "zeichen" not in c.lower()]
    t["dw"] = num(t[tot]) if tot else sum(num(t[c]).fillna(0) for c in vals)
    return t[["GITTER_ID_1km", "dw"]]


def main():
    q = pd.read_csv(D / "Zensus2022_Leerstandsquote_1km-Gitter_BE_BB.csv", sep=";", dtype=str)
    m = pd.read_csv(D / "Zensus2022_Marktaktive_Leerstandsquote_1km-Gitter_BE_BB.csv", sep=";", dtype=str)
    c = q[["GITTER_ID_1km", "x_mp_1km", "y_mp_1km", "Leerstandsquote"]].merge(m[["GITTER_ID_1km", "marktaktive_Leerstandsquote"]], on="GITTER_ID_1km", how="left")
    c = c.merge(dwellings(), on="GITTER_ID_1km", how="left")
    c["q"] = num(c.Leerstandsquote); c["qm"] = num(c.marktaktive_Leerstandsquote)
    c["x"] = c.x_mp_1km.astype(float); c["y"] = c.y_mp_1km.astype(float)
    c = c[c.dw.fillna(0) > 0]
    g = gpd.GeoDataFrame(c[["GITTER_ID_1km", "dw", "q", "qm"]],
                         geometry=[shapely.box(x - 500, y - 500, x + 500, y + 500) for x, y in zip(c.x, c.y)], crs=3035)
    gem = gpd.read_file(D / "vg250_gem_be_bb.gpkg").to_crs(3035)
    pt = g.copy(); pt["geometry"] = g.centroid
    j = gpd.sjoin(pt, gem[["AGS", "GEN", "BEZ", "SN_L", "geometry"]], how="inner", predicate="within").drop(columns="index_right")
    g = g.loc[j.index].join(j[["AGS", "GEN", "BEZ", "SN_L"]])
    g["vac"] = g.dw * g.q / 100
    g["vac_ma"] = g.dw * g.qm / 100
    g.to_parquet(B / "cells.parquet")
    for sl, nm in (("11", "Berlin"), ("12", "Brandenburg")):
        s = g[g.SN_L == sl]
        print(f"{nm}: {len(s):,} cells · {s.dw.sum():,.0f} dwellings · vacant ≈ {s.vac.sum():,.0f} "
              f"(rate known in {s.q.notna().mean():.0%} of cells) · market-active ≈ {s.vac_ma.sum():,.0f} (known in {s.qm.notna().mean():.0%})")


if __name__ == "__main__":
    main()
