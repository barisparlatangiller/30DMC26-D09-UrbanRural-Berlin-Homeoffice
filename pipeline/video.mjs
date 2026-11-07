// ~14 s LinkedIn video (1080×1350): home-office days go from 2 to 5 and Brandenburg's empty homes light up
// as the reachable area around Berlin grows. Rendered from the built site (16 h of commuting a month).
//   node pipeline/video.mjs   → media/day9_homeoffice.mp4, cover.png, thumb_full.jpg
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import http from "node:http";
import path from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new globalThis.URL(req.url, "http://x").pathname);
  const f = path.join("docs", u.endsWith("/") ? u + "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Content-Length": fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
}).listen(8000);

const URL = "http://localhost:8000/", OUT = "media", FR = "media/frames", FPS = 15, HR = 16;
fs.mkdirSync(FR, { recursive: true });
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"];
const ready = p => p.waitForFunction(() => typeof S !== "undefined" && S.map && S.map.getLayer("c") && S.map.loaded(), null, { timeout: 120000 });
const idle = p => p.evaluate(() => new Promise(r => { S.map.once("idle", () => setTimeout(r, 20)); S.map.triggerRepaint(); setTimeout(r, 5000); }));
const lim = ho => (ho >= 5 ? Infinity : HR * 60 / (2 * (5 - ho) * 4.33));

let br = await chromium.launch({ args: ARGS });
{
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", m => m.type() === "error" && console.log("console:", m.text()));
  await p.goto(URL, { waitUntil: "networkidle" }); await ready(p); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/thumb_full.jpg`, type: "jpeg", quality: 88 });
  await p.close();
}

const CSS = `
  .panel, .legend, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right { display: none !important; }
  #map { inset: 0 !important; }
  .v { position: absolute; z-index: 5; left: 44px; right: 44px; font-family: Inter; color: #1d2422; }
  .v.top { top: 40px; }
  .v .eb { font-size: 19px; letter-spacing: .14em; text-transform: uppercase; color: #7f8984; font-weight: 600; }
  .v h1 { font-size: 74px; font-weight: 800; letter-spacing: -.035em; margin: 8px 0 4px; line-height: .95; }
  .v .s { font-size: 27px; color: #56605c; line-height: 1.3; max-width: 940px; }
  .v.bot { bottom: 44px; background: rgba(255,255,255,.95); border: 1px solid #e3e6e2; border-radius: 16px; padding: 22px 26px; box-shadow: 0 10px 30px -14px rgba(0,0,0,.3); }
  .v .days { display: flex; gap: 10px; margin-bottom: 14px; }
  .v .days i { flex: 1; height: 58px; flex-direction: column; line-height: 1.1; border-radius: 9px; background: #e9e8e3; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 19px; font-weight: 600; color: #8b948f; }
  .v .days i.h { background: #1f6f5c; color: #fff; } .v .days i small { font-size: 14px; font-weight: 500; opacity: .85; }
  .v .row { display: flex; justify-content: space-between; align-items: baseline; }
  .v .row b { font-size: 58px; letter-spacing: -.03em; color: #1f6f5c; font-variant-numeric: tabular-nums; }
  .v .row span { font-size: 22px; color: #56605c; text-align: right; line-height: 1.3; }
  .card { position: absolute; z-index: 6; left: 70px; right: 70px; top: 400px; background: rgba(255,255,255,.97); border-radius: 22px; padding: 38px 42px; text-align: center; box-shadow: 0 20px 50px -20px rgba(0,0,0,.35); }
  .card .q { font-size: 64px; font-weight: 800; letter-spacing: -.035em; line-height: 1; }
  .card p { font-size: 26px; line-height: 1.38; color: #3a423f; margin: 16px 0 0; }
  .card .url { margin-top: 24px; font-size: 22px; font-weight: 600; }
  .card .att { margin-top: 8px; font-size: 15px; color: #8b948f; }
`;
async function openPage() {
  const page = await br.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto(URL, { waitUntil: "networkidle" }); await ready(page);
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", `<div class="v top"><div class="eb">#30DayMapChallenge · Day 9 · Urban–rural · Berlin–Brandenburg</div>
      <h1>Homeoffice rettet<br>das Dorf?</h1><div class="s">Empty homes in Brandenburg that are close enough to central Berlin by train, if you accept 16 hours of commuting a month.</div></div>
      <div class="v bot"><div class="days" id="vd"></div><div class="row"><b id="vn">0</b><span id="vt"></span></div></div>`);
    S.map.resize(); S.map.fitBounds([[11.27, 51.36], [14.77, 53.56]], { padding: { top: 300, bottom: 250, left: 30, right: 30 }, animate: false });
  });
  await idle(page); await page.waitForTimeout(1500);
  return page;
}
let page = await openPage();

const plan = [];
const hold = (ho, l, n) => { for (let i = 0; i < n; i++) plan.push({ ho, l }); };
const grow = (ho, a, b, n) => { for (let i = 1; i <= n; i++) { const e = 0.5 - 0.5 * Math.cos(Math.PI * i / n); plan.push({ ho, l: a + (b - a) * e }); } };
hold(2, lim(2), 18);
grow(3, lim(2), lim(3), 14); hold(3, lim(3), 22);
grow(4, lim(3), lim(4), 16); hold(4, lim(4), 24);
grow(5, lim(4), 300, 20); hold(5, lim(5), 18);
for (let i = 0; i < 42; i++) plan.push({ ho: 5, l: lim(5), card: true });

let n = 0, info = null;
for (const fr of plan) {
  if (n > 0 && n % 70 === 0) { await br.close(); br = await chromium.launch({ args: ARGS }); page = await openPage(); }
  info = await page.evaluate(({ fr, HR }) => {
    S.limOverride = fr.l; S.ho = fr.ho; S.hr = HR;
    const r = compute();
    S.map.setPaintProperty("c", "fill-color", color(fr.l));
    document.querySelector("#vd").innerHTML = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => `<i class="${i >= 5 - fr.ho ? "h" : ""}">${d}<small>${i >= 5 - fr.ho ? "home" : "office"}</small></i>`).join("");
    document.querySelector("#vn").textContent = Math.round(r.n).toLocaleString("en-GB");
    document.querySelector("#vt").innerHTML = fr.l === Infinity ? `empty homes · ${fr.ho} home-office days<br>distance no longer matters`
      : `empty homes within ${Math.round(fr.l)} min<br>${fr.ho} home-office days a week`;
    if (fr.card && !document.querySelector(".card")) {
      document.querySelector(".v.bot").style.display = "none";
      document.body.insertAdjacentHTML("beforeend", `<div class="card"><div class="q">Saves the village?</div>
        <p>Only partly. Each extra home-office day pulls more of Brandenburg within reach, but many empty homes sit far from a fast
        train to Berlin, and an empty home is not automatically one you can rent.</p>
        <div class="url">Try your own week · barisparlatangiller.github.io</div>
        <div class="att">Zensus 2022 © Destatis · VG250 © GeoBasis-DE/BKG · timetable © VBB · © CARTO, © OpenStreetMap contributors</div></div>`);
    }
    return { n: r.n, by: r.by.size };
  }, { fr, HR });
  await idle(page);
  await page.screenshot({ path: `${FR}/f${String(n).padStart(4, "0")}.png` }); n++;
  if (n % 30 === 0) console.log("frame", n, JSON.stringify(info), new Date().toISOString());
}
fs.copyFileSync(`${FR}/f${String(plan.length - 50).padStart(4, "0")}.png`, `${OUT}/cover.png`);
await br.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${FR}/f%04d.png`,
  "-vf", "minterpolate=fps=30:mi_mode=blend", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", `${OUT}/day9_homeoffice.mp4`]);
console.log(`${n} frames, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(`${OUT}/day9_homeoffice.mp4`).size / 1e6).toFixed(2)} MB`);
fs.rmSync(FR, { recursive: true });
process.exit(0);
