/* Homeoffice rettet das Dorf? · #30DayMapChallenge 2026 Day 9 */
const RAMP = ["#e4efe8", "#bfdccd", "#8fc3ab", "#5ea589", "#33836a", "#1f6f5c", "#0f4f40"];
const BINS = [1, 5, 15, 40, 100, 250, 600];                          // empty homes per km²
const OFF = "#e9e8e3", BERLIN = "#cfd6dc";
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString("en-GB");
const S = { ho: 3, hr: 16, m: "v", fc: null, map: null, sel: null };

function maxMinutes() {                                               // one-way door-to-centre minutes that fit the budget
  if (S.limOverride != null) return S.limOverride;
  const office = 5 - S.ho;
  return office <= 0 ? Infinity : S.hr * 60 / (2 * office * 4.33);
}

function compute() {
  const lim = maxMinutes(), k = S.m;
  let n = 0, cells = 0; const by = new Map();
  for (const f of S.fc.features) {
    const p = f.properties;
    const ok = !p.be && (lim === Infinity || (p.t != null && p.t <= lim));
    p.ok = ok ? 1 : 0;
    if (ok && p[k]) {
      n += p[k]; cells++;
      const g = by.get(p.a) || { name: p.g, n: 0, dw: 0, t: [] };
      g.n += p[k]; g.dw += p.dw; if (p.t != null) g.t.push(p.t); by.set(p.a, g);
    }
  }
  return { n, cells, lim, by };
}

function render() {
  const r = compute();
  $("#hoV").textContent = `${S.ho} days · ${5 - S.ho} in the office`;
  $("#hrV").textContent = `${S.hr} h`;
  $("#kN").textContent = fmt(r.n);
  const what = S.m === "v" ? "empty homes" : "empty homes available on the market";
  $("#kT").innerHTML = r.lim === Infinity
    ? `${what} in Brandenburg: working fully from home, distance no longer matters`
    : `${what} in Brandenburg within <b style="display:inline;font-size:inherit;color:inherit">${Math.round(r.lim)} min</b> of central Berlin, door to door`;
  const st = S.stats, tot = st.brandenburg[S.m === "v" ? "vacant" : "vacant_ma"], ber = st.berlin[S.m === "v" ? "vacant" : "vacant_ma"];
  $("#kpis").innerHTML = `<div class="kpi"><b>${Math.round(100 * r.n / tot)} %</b><span>of Brandenburg's ${fmt(tot)} counted ${S.m === "v" ? "empty" : "market-ready"} homes</span></div>
    <div class="kpi"><b>${fmt(ber)}</b><span>${S.m === "v" ? "empty" : "market-ready"} homes in all of Berlin, for comparison</span></div>
    <div class="kpi"><b>${r.by.size}</b><span>municipalities with at least one qualifying cell</span></div>
    <div class="kpi"><b>${(r.n / Math.max(1, ber)).toFixed(1)}×</b><span>Berlin's own ${S.m === "v" ? "empty" : "market-ready"} stock</span></div>`;
  const top = [...r.by.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  $("#top").innerHTML = `<tr><th>Municipality</th><th>${S.m === "v" ? "empty" : "on market"}</th><th>min to centre</th></tr>` +
    top.map(([a, g]) => { const t = g.t.sort((x, y) => x - y)[Math.floor(g.t.length / 2)]; return `<tr data-a="${a}"><td>${g.name}</td><td>${fmt(g.n)}</td><td>${t ?? "–"}</td></tr>`; }).join("");
  $("#top").querySelectorAll("tr[data-a]").forEach(tr => tr.onclick = () => zoomTo(tr.dataset.a));
  if (S.map && S.map.getLayer("c")) S.map.setPaintProperty("c", "fill-color", color(r.lim));
  legend(r);
}

function color(lim = maxMinutes()) {
  const v = ["coalesce", ["get", S.m], 0];
  const far = lim === Infinity ? false : ["any", ["!", ["has", "t"]], [">", ["get", "t"], lim]];
  return ["case", ["==", ["get", "be"], 1], BERLIN, far, OFF,
    ["step", v, "rgba(0,0,0,0)", ...BINS.flatMap((b, i) => [b, RAMP[i]])]];
}
function legend(r) {
  $("#legend").innerHTML = `<b>${S.m === "v" ? "Empty homes" : "Empty homes on the market"} per km²</b>
    <div class="ramp">${RAMP.map(c => `<b style="background:${c}"></b>`).join("")}</div><div class="ends"><span>1</span><span>600+</span></div>
    <div class="it"><i style="background:${OFF}"></i>too far for this scenario</div><div class="it"><i style="background:${BERLIN}"></i>Berlin</div>`;
}
function zoomTo(a) {
  const fs = S.fc.features.filter(f => f.properties.a === a); if (!fs.length) return;
  let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
  for (const f of fs) for (const [x, y] of f.geometry.coordinates[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  S.map.fitBounds([[x0, y0], [x1, y1]], { padding: 60, maxZoom: 11, duration: 900 });
}

async function init() {
  const [fc, stats] = await Promise.all([fetch("data/cells.geojson?v=2").then(r => r.json()), fetch("data/stats.json?v=2").then(r => r.json())]);
  S.fc = fc; S.stats = stats;
  const map = (S.map = new maplibregl.Map({ container: "map", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [13.4, 52.45], zoom: 6.9, attributionControl: false }));
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Zensus 2022 © Destatis · VG250 © GeoBasis-DE/BKG · VBB" }), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  const setup = () => {
    if (map.getLayer("c")) return true;
    try {
      const sym = map.getStyle().layers.find(l => l.type === "symbol")?.id;
      map.addSource("c", { type: "geojson", data: S.fc });
      map.addLayer({ id: "c", type: "fill", source: "c", paint: { "fill-color": color(), "fill-opacity": 0.9 } }, sym);
      map.addSource("g", { type: "geojson", data: "data/gem.geojson" });
      map.addLayer({ id: "g", type: "line", source: "g", paint: { "line-color": "#6d7671", "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.2, 11, 0.8], "line-opacity": 0.5 } }, sym);
      map.on("click", "c", e => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML(`<b>${p.g}</b><br>${fmt(p.dw)} homes in this km²<br>
          ${p.q != null ? `${p.q} % empty (≈ ${fmt(p.v)})` : "vacancy rate not published"}${p.qm != null ? ` · ${p.qm} % on the market (≈ ${fmt(p.vm)})` : ""}<br>
          ${p.t != null ? `${p.t} min to central Berlin via ${p.s}` : "no train or bus to central Berlin in reach on a weekday morning"}`).addTo(map);
      });
      map.on("mouseenter", "c", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "c", () => (map.getCanvas().style.cursor = ""));
      return true;
    } catch (e) { return false; }
  };
  map.on("load", setup);
  const poll = setInterval(() => { if (map.style && map.style._loaded && setup()) { clearInterval(poll); render(); } }, 250);
  $("#ho").oninput = e => { S.ho = +e.target.value; render(); };
  $("#hr").oninput = e => { S.hr = +e.target.value; render(); };
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b)); S.m = b.dataset.m; render();
  });
  render();
}
init();
