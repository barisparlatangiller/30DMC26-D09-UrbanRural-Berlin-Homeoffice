# Homeoffice rettet das Dorf?

**#30DayMapChallenge 2026 · Day 9 · Urban–rural** · live map: https://barisparlatangiller.github.io/30DMC26-D09-UrbanRural-Berlin-Homeoffice/

Berlin is short of homes; Brandenburg has empty ones. If you only went to the office a few days a week, which places are close
enough to central Berlin by public transport? Pick 2–5 home-office days and the commuting you accept per month; the map shows
the 1 km cells in Brandenburg that qualify and how many empty homes they hold.

## Method
- **Empty homes** – Zensus 2022 (Destatis), 1 km grid: dwellings × vacancy rate; "on the market" = market-active vacancy rate.
  Suppressed rates count as zero, so totals are a floor.
- **Time to central Berlin** – VBB GTFS, a normal Tuesday, reverse connection scan: shortest trip to
  Hbf / Friedrichstraße / Alexanderplatz / Potsdamer Platz / Zoo arriving 6:30–9:00 (every 5 min), 3 min per change. Access: walking ≤ 1.2 km, else 18 km/h + 4 min.
- **Scenario** – monthly hours = 2 × time × (5 − home-office days) × 4.33.

## Limits
Approximate values, no addresses. An empty dwelling is not automatically for rent or sale. A scenario, not a forecast.

## Run
```
pip install -r requirements.txt
python pipeline/a_cells.py && python pipeline/b_transit.py && python pipeline/c_web.py
```
GitHub Actions runs the same on every push and deploys `docs/` to Pages.

Data: Zensus 2022 © Destatis · VG250 © GeoBasis-DE/BKG (dl-de/by-2.0) · VBB GTFS (CC BY 4.0) · basemap © CARTO / OSM.
Barış Parlatangiller, built with Claude.
