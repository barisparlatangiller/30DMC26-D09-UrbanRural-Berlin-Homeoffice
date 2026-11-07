"""
Public-transport time from every station in Berlin–Brandenburg to central Berlin, from the VBB timetable (GTFS).

Question asked of the timetable: "on a normal Tuesday, how late can I leave this station and still be at one of
Berlin Hauptbahnhof, Friedrichstraße, Alexanderplatz, Potsdamer Platz or Zoologischer Garten by 9:00?"
Answered with a reverse Connection Scan (exact for the timetable): 3 minutes for every change of train/bus at a station,
no change time for staying on a vehicle. Travel time = 9:00 − latest departure.

  python pipeline/b_transit.py
Output  build/stations.parquet (station, lon, lat, minutes to central Berlin)
"""
import io, re, zipfile
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests

IN, B = Path("input"), Path("build")
GTFS_URL = "https://www.vbb.de/vbbgtfs"
ARRIVE = 9 * 3600
EARLIEST = 4 * 3600 + 30 * 60
CHANGE = 180
TARGETS = r"^S\+U Berlin Hauptbahnhof|^S\+U Friedrichstr|^S\+U Alexanderplatz|^S\+U Potsdamer Platz|^S\+U Zoologischer Garten"


def hms(s):
    p = s.str.split(":", expand=True).astype(int)
    return p[0] * 3600 + p[1] * 60 + p[2]


def main():
    f = IN / "vbb_gtfs.zip"
    if not f.exists():
        r = requests.get(GTFS_URL, timeout=900, allow_redirects=True, headers={"User-Agent": "Mozilla/5.0 30DMC26"})
        r.raise_for_status(); f.write_bytes(r.content)
    z = zipfile.ZipFile(f)
    rd = lambda n, **k: pd.read_csv(z.open(n), dtype=str, **k)
    cal = rd("calendar.txt"); cd = rd("calendar_dates.txt")
    start = pd.to_datetime(cal.start_date).min().date()
    day = start + timedelta(days=(1 - start.weekday()) % 7 + 7)               # the second Tuesday of the feed
    ds = day.strftime("%Y%m%d")
    act = set(cal[(cal.tuesday == "1") & (cal.start_date <= ds) & (cal.end_date >= ds)].service_id)
    act |= set(cd[(cd.date == ds) & (cd.exception_type == "1")].service_id)
    act -= set(cd[(cd.date == ds) & (cd.exception_type == "2")].service_id)
    trips = rd("trips.txt", usecols=["trip_id", "service_id", "route_id"])
    trips = trips[trips.service_id.isin(act)]
    print(f"timetable day {day}: {len(act):,} services, {len(trips):,} trips", flush=True)

    stops = rd("stops.txt", usecols=["stop_id", "stop_name", "stop_lat", "stop_lon", "parent_station"])
    stops["sta"] = stops.parent_station.fillna(stops.stop_id)
    sta_of = dict(zip(stops.stop_id, stops.sta))
    st = rd("stop_times.txt", usecols=["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"])
    st = st[st.trip_id.isin(set(trips.trip_id))]
    st["arr"] = hms(st.arrival_time); st["dep"] = hms(st.departure_time)
    st["seq"] = st.stop_sequence.astype(int)
    st = st.sort_values(["trip_id", "seq"])
    st["s"] = st.stop_id.map(sta_of)
    nxt = st.groupby("trip_id").shift(-1)
    c = pd.DataFrame({"trip": st.trip_id.values, "from": st.s.values, "dep": st.dep.values,
                      "to": nxt.s.values, "arr": nxt.arr.values}).dropna()
    c = c[(c.dep >= EARLIEST) & (c.arr <= ARRIVE)]
    c = c.sort_values("dep", ascending=False)
    print(f"connections 4:30–9:00: {len(c):,}", flush=True)

    sta_ids = pd.Index(pd.unique(np.r_[c["from"].values, c["to"].values]))
    fi = sta_ids.get_indexer(c["from"]); ti = sta_ids.get_indexer(c["to"])
    tr_codes, tr = np.unique(c.trip.values, return_inverse=True)
    dep = c.dep.values.astype(np.int64); arr = c.arr.values.astype(np.int64)
    names = stops.drop_duplicates("sta").set_index("sta").reindex(sta_ids)
    S = np.full(len(sta_ids), -1, dtype=np.int64)                          # latest time to be at a station (−1 = cannot)
    tgt = names.stop_name.fillna("").str.contains(TARGETS, regex=True).values
    S[tgt] = ARRIVE + CHANGE                                               # arriving there is enough, no change needed
    print("targets:", sorted(set(names.stop_name[tgt])), flush=True)
    onboard = np.zeros(len(tr_codes), dtype=bool)
    for k in range(len(dep)):                                              # reverse connection scan
        t = tr[k]
        if onboard[t] or arr[k] + CHANGE <= S[ti[k]]:
            onboard[t] = True
            v = dep[k]
            if v > S[fi[k]]:
                S[fi[k]] = v
    reach = S >= 0
    out = pd.DataFrame({"sta": sta_ids[reach], "name": names.stop_name.values[reach],
                        "lat": names.stop_lat.astype(float).values[reach], "lon": names.stop_lon.astype(float).values[reach],
                        "min": np.where(tgt[reach], 0, (ARRIVE - (S[reach] - 0)) / 60).round(1)})
    out.loc[out["min"] < 0, "min"] = 0
    out.to_parquet(B / "stations.parquet")
    print(f"stations that reach central Berlin by 9:00: {len(out):,}")
    for nm in ["S Potsdam Hauptbahnhof", "S Oranienburg", "Fürstenwalde, Bahnhof", "S Eberswalde", "Cottbus, Hauptbahnhof", "Frankfurt (Oder), Bahnhof", "Brandenburg, Hauptbahnhof", "Wittenberge, Bahnhof", "Prenzlau, Bahnhof", "Angermünde, Bahnhof"]:
        r = out[out.name.str.contains(re.escape(nm), regex=True)].sort_values("min").head(1)
        if len(r): print(f"  {r.name.iloc[0]}: {r['min'].iloc[0]:.0f} min")


if __name__ == "__main__":
    main()
