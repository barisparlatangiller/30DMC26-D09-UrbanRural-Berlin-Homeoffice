"""
Door-to-centre time for every 1 km cell and the web layers.

  time to central Berlin = getting to a station + the timetable time from b_transit.py
  getting to a station   = walking (4.5 km/h) up to 1.2 km, otherwise bike / bus / car feeder (≈ 18 km/h) + 4 min
                           to any of the 25 nearest stations within 20 km; the fastest combination counts

  python pipeline/c_web.py
Output  docs/data/cells.geojson · docs/data/gem.geojson · docs/data/stats.json
"""
import json, time
from pathlib import Path

import geopandas as gpd
import numpy as np
from scipy.spatial import cKDTree

B, D, W = Path("build"), Path("data"), Path("docs/data")
W.mkdir(parents=True, exist_ok=True)

c = gpd.read_parquet(B / "cells.parquet")
s = gpd.read_parquet(B / "stations.parquet")
sg = gpd.GeoDataFrame(s, geometry=gpd.points_from_xy(s.lon, s.lat), crs=4326).to_crs(3035)
tree = cKDTree(np.c_[sg.geometry.x, sg.geometry.y])
cx = np.c_[c.centroid.x, c.centroid.y]
d, i = tree.query(cx, k=25, distance_upper_bound=20000)
ok = np.isfinite(d)
i = np.where(ok, i, 0)
acc = np.where(d <= 1200, d / 75.0, 4 + d / 300.0)
tot = np.where(ok, acc + s["min"].values[i], np.inf)
best = tot.argmin(axis=1)
c["t"] = tot[np.arange(len(c)), best]
c["sta"] = np.where(np.isfinite(c.t), s.name.values[i[np.arange(len(c)), best]], None)
c.loc[~np.isfinite(c.t), "t"] = np.nan
c["be"] = (c.SN_L == "11").astype(int)

o = c.to_crs(4326)
feats = []
for k, r in enumerate(o.itertuples()):
    p = {"i": k, "dw": int(round(r.dw)), "g": r.GEN, "a": r.AGS, "be": int(r.be)}
    if r.q == r.q: p["q"] = round(float(r.q), 1); p["v"] = int(round(r.vac))
    if r.qm == r.qm: p["qm"] = round(float(r.qm), 1); p["vm"] = int(round(r.vac_ma))
    if r.t == r.t: p["t"] = int(round(r.t)); p["s"] = r.sta
    x0, y0, x1, y1 = r.geometry.bounds
    ring = [[round(x0, 4), round(y0, 4)], [round(x1, 4), round(y0, 4)], [round(x1, 4), round(y1, 4)], [round(x0, 4), round(y1, 4)], [round(x0, 4), round(y0, 4)]]
    feats.append({"type": "Feature", "properties": p, "geometry": {"type": "Polygon", "coordinates": [ring]}})
(W / "cells.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))

gem = gpd.read_file(D / "vg250_gem_be_bb.gpkg").to_crs(4326)
gem["geometry"] = gem.simplify(0.0008)
gem[["AGS", "GEN", "BEZ", "SN_L", "geometry"]].to_file(W / "gem.geojson", driver="GeoJSON")

bb, be = c[c.be == 0], c[c.be == 1]
st = {"build": int(time.time()),
      "berlin": {"dwellings": round(float(be.dw.sum())), "vacant": round(float(be.vac.sum())), "vacant_ma": round(float(be.vac_ma.sum())), "cells": int(len(be))},
      "brandenburg": {"dwellings": round(float(bb.dw.sum())), "vacant": round(float(bb.vac.sum())), "vacant_ma": round(float(bb.vac_ma.sum())), "cells": int(len(bb)),
                      "cells_with_time": int(bb.t.notna().sum()), "median_time_min": round(float(np.nanmedian(bb.t)), 0)},
      "stations": int(len(s)),
      "assumptions": {"arrive_by": "09:00", "change_min": 3, "walk_kmh": 4.5, "walk_max_m": 1200, "feeder_kmh": 18, "feeder_extra_min": 4}}
(W / "stats.json").write_text(json.dumps(st, indent=1))
print(json.dumps(st, indent=1))
for t in (30, 45, 60, 75, 90):
    sel = bb[bb.t <= t]
    print(f"Brandenburg cells within {t} min: {len(sel):,} · vacant ≈ {sel.vac.sum():,.0f} · market-active ≈ {sel.vac_ma.sum():,.0f}")
