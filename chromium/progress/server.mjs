// Local progress page for the Visibility Browser build.
// Serves http://127.0.0.1:3000 and a JSON status at /status.json.
// Every stage is measured from the disk, not guessed: a file that exists or a line in a log.

import http from 'node:http';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = 'D:\\src\\chromium\\src';
const BUILD_LOG = path.join(process.env.LOCALAPPDATA || '', 'Temp', 'visib-build-round.log');
const STATE_DIR = path.join(HERE, 'state');
const PATCHES_DONE = path.join(STATE_DIR, 'patches.done');
const BUILD_START = path.join(STATE_DIR, 'build.start');

fs.mkdirSync(STATE_DIR, { recursive: true });

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const sizeOf = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };

// Stage weights are the share of total wall time each stage takes, from measured or
// reported durations: fetch and sync dominate the waiting, the compile dominates the rest.
const STAGES = [
  { id: 'fetch', name: 'РСЃС…РѕРґРЅРёРєРё Chromium 158', weight: 5, typical: '1вЂ“2 С‡', done: () => exists(path.join(SRC, '.git', 'HEAD')) && exists(path.join(SRC, 'chrome', 'browser', 'BUILD.gn')) },
  { id: 'sync', name: 'Р—Р°РІРёСЃРёРјРѕСЃС‚Рё (gclient sync)', weight: 15, typical: '1вЂ“3 С‡', done: () => exists(path.join(SRC, 'third_party', 'ffmpeg', 'ffmpeg_options.gni')) && exists(path.join(SRC, 'third_party', 'devtools-frontend', 'src', 'scripts', 'build', 'typescript', 'typescript.gni')) },
  { id: 'hooks', name: 'РРЅСЃС‚СЂСѓРјРµРЅС‚С‹ СЃР±РѕСЂРєРё (hooks)', weight: 5, typical: '10вЂ“30 РјРёРЅ', done: () => exists(path.join(SRC, 'build', 'toolchain', 'win', 'rc', 'win', 'rc.exe.sha1')) },
  { id: 'gn', name: 'РќР°СЃС‚СЂРѕР№РєР° СЃР±РѕСЂРєРё (gn gen)', weight: 2, typical: '1 РјРёРЅ', done: () => exists(path.join(SRC, 'out', 'Dev', 'build.ninja')) },
  { id: 'patches', name: 'РќР°С€Рё РїСЂР°РІРєРё РІ Chromium', weight: 3, typical: 'РІСЂСѓС‡РЅСѓСЋ', done: () => exists(PATCHES_DONE) },
  { id: 'build', name: 'РљРѕРјРїРёР»СЏС†РёСЏ Р±СЂР°СѓР·РµСЂР° (ninja)', weight: 70, typical: '5вЂ“8 С‡', done: () => false, progress: buildProgress },
];

// Chromium builds with siso. `siso ps` prints "[done/total (remaining: N)]"; it is asked at most every 10 s.
let sisoCache = { at: 0, value: null };
function sisoPs() {
  if (Date.now() - sisoCache.at < 10000) return sisoCache.value;
  sisoCache.at = Date.now();
  try {
    const out = execFileSync('cmd', ['/c', 'siso ps -C out\\Dev'], {
      cwd: SRC, encoding: 'utf8', timeout: 20000, env: { ...process.env, PATH: `D:\\src\\depot_tools;${process.env.PATH}` },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const m = out.match(/\[(\d+)\/(\d+)/);
    sisoCache.value = m ? { done: Number(m[1]), total: Number(m[2]) } : null;
  } catch {
    sisoCache.value = null;
  }
  return sisoCache.value;
}

// siso prints its own summary into the log: "<elapsed> Build Progress: N done, M remaining - R/s".
function sisoLogSummary() {
  if (!exists(BUILD_LOG)) return null;
  const tail = fs.readFileSync(BUILD_LOG, 'utf8').slice(-20000);
  const m = [...tail.matchAll(/([\d.]+)s\s+Build\s+\w+:\s+(\d+) done.*?(\d+) remaining(?: - ([\d.]+)\/s)?/g)].at(-1);
  if (!m) return null;
  const done = Number(m[2]);
  const remaining = Number(m[3]);
  return { done, total: done + remaining, rate: m[4] ? Number(m[4]) : null };
}

function buildProgress() {
  let startedAt = null;
  if (exists(BUILD_START)) startedAt = Number(fs.readFileSync(BUILD_START, 'utf8'));
  const sum = sisoLogSummary();
  if (sum && sum.total) return { done: sum.done, total: sum.total, percent: (sum.done / sum.total) * 100, startedAt, size: 0, rate: sum.rate };
  const p = sisoPs();
  if (!p || !p.total) return null;
  return { done: p.done, total: p.total, percent: (p.done / p.total) * 100, startedAt, size: 0 };
}

function snapshot() {
  const now = Date.now();
  const stages = STAGES.map((s) => {
    const done = s.done();
    let fraction = done ? 1 : 0;
    let detail = done ? 'РіРѕС‚РѕРІРѕ' : 'РѕР¶РёРґР°РЅРёРµ';
    let prog = null;
    if (!done && s.progress) {
      prog = s.progress();
      if (prog) { fraction = prog.percent / 100; detail = `${prog.done} РёР· ${prog.total} С€Р°РіРѕРІ`; }
    }
    return { id: s.id, name: s.name, weight: s.weight, typical: s.typical, done, fraction, detail, prog };
  });

  const totalWeight = STAGES.reduce((a, s) => a + s.weight, 0);
  const overall = stages.reduce((a, s) => a + s.weight * s.fraction, 0) / totalWeight * 100;

  const active = stages.find((s) => !s.done) || null;

  // ETA from the compile rate once it has run for a minute or more.
  let eta = null;
  const b = stages.find((s) => s.id === 'build');
  if (b && b.prog && b.prog.done > 0) {
    // Prefer siso's own rate (steps per second, from its log); fall back to the average since start.
    let remaining = null;
    if (b.prog.rate && b.prog.rate > 0) remaining = ((b.prog.total - b.prog.done) / b.prog.rate) * 1000;
    else if (b.prog.startedAt) remaining = (now - b.prog.startedAt) / b.prog.done * (b.prog.total - b.prog.done);
    if (remaining != null) eta = { remainingMs: remaining, finishAt: now + remaining };
  }

  const lastLog = exists(BUILD_LOG) ? fs.readFileSync(BUILD_LOG, 'utf8').split(/\r?\n/).filter(Boolean).slice(-3) : [];

  return {
    updatedAt: now,
    overallPercent: Math.round(overall * 10) / 10,
    active: active ? { id: active.id, name: active.name } : null,
    eta,
    stages: stages.map(({ prog, ...rest }) => rest),
    lastLog,
  };
}

const PAGE = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visibility вЂ” СЃР±РѕСЂРєР°</title>
<style>
  :root { color-scheme: dark; --bg:#0a0b0e; --panel:#14171d; --text:#eef1f6; --muted:#8b93a3; --accent:#7fd8c6; --line:rgba(255,255,255,.08); }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:15px/1.5 "Segoe UI", system-ui, sans-serif; padding:40px 24px; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .sub { color: var(--muted); margin-bottom: 28px; }
  .big { font-size: 64px; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .bar { height: 10px; border-radius: 6px; background: rgba(255,255,255,.07); overflow:hidden; margin: 12px 0 8px; }
  .bar > i { display:block; height:100%; width:0; background: var(--accent); transition: width .6s cubic-bezier(.32,.72,0,1); }
  .meta { display:flex; flex-wrap:wrap; gap: 8px 24px; color: var(--muted); }
  .meta b { color: var(--text); font-weight: 500; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; margin-top: 20px; }
  .stage { display:grid; grid-template-columns: 22px 1fr auto; gap: 12px; align-items:center; padding: 12px 0; border-top: 1px solid var(--line); }
  .stage:first-child { border-top: 0; }
  .dot { width:14px; height:14px; border-radius:50%; border:1.5px solid var(--muted); }
  .stage.done .dot { background: var(--accent); border-color: var(--accent); }
  .stage.active .dot { border-color: var(--accent); box-shadow: 0 0 10px rgba(127,216,198,.6); }
  .name { font-weight: 500; }
  .detail { color: var(--muted); font-size: 13px; }
  .pct { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 13px; }
  .log { font: 12px/1.6 Consolas, monospace; color: var(--muted); white-space: pre-wrap; word-break: break-all; margin: 0; }
  .stamp { color: var(--muted); font-size: 12px; margin-top: 16px; }
</style></head>
<body><div class="wrap">
  <h1>РЎР±РѕСЂРєР° Visibility Browser</h1>
  <div class="sub">РћР±РЅРѕРІР»СЏРµС‚СЃСЏ СЃР°РјРѕ РєР°Р¶РґС‹Рµ 3 СЃРµРєСѓРЅРґС‹</div>
  <div class="big" id="pct">вЂ”</div>
  <div class="bar"><i id="bar"></i></div>
  <div class="meta">
    <span>Р­С‚Р°Рї: <b id="stage">вЂ”</b></span>
    <span>РћСЃС‚Р°Р»РѕСЃСЊ: <b id="eta">вЂ”</b></span>
    <span>Р¤РёРЅРёС€: <b id="finish">вЂ”</b></span>
  </div>
  <div class="card" id="stages"></div>
  <div class="card"><div class="detail" style="margin-bottom:8px">РџРѕСЃР»РµРґРЅРёРµ СЃС‚СЂРѕРєРё Р»РѕРіР° СЃР±РѕСЂРєРё</div><pre class="log" id="log"></pre></div>
  <div class="stamp" id="stamp"></div>
</div>
<script>
const fmt = (ms) => { if (ms == null) return 'вЂ”'; const m = Math.round(ms/60000); const h = Math.floor(m/60), mm = m%60; return h ? h+' С‡ '+mm+' РјРёРЅ' : mm+' РјРёРЅ'; };
async function tick() {
  try {
    const s = await (await fetch('/status.json', {cache:'no-store'})).json();
    document.getElementById('pct').textContent = s.overallPercent.toFixed(1) + '%';
    document.getElementById('bar').style.width = s.overallPercent + '%';
    document.getElementById('stage').textContent = s.active ? s.active.name : 'РІСЃС‘ РіРѕС‚РѕРІРѕ';
    document.getElementById('eta').textContent = s.eta ? fmt(s.eta.remainingMs) : (s.active && s.active.id === 'build' ? 'СЃС‡РёС‚Р°СЋвЂ¦' : 'РїРѕРєР° РЅРµ РёР·РІРµСЃС‚РЅРѕ');
    document.getElementById('finish').textContent = s.eta ? new Date(s.eta.finishAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : 'вЂ”';
    document.getElementById('stages').innerHTML = s.stages.map(st => {
      const cls = st.done ? 'done' : (s.active && s.active.id === st.id ? 'active' : '');
      const pct = Math.round(st.fraction*100);
      return '<div class="stage '+cls+'"><span class="dot"></span><div><div class="name">'+st.name+'</div><div class="detail">'+st.detail+' В· РѕР±С‹С‡РЅРѕ '+st.typical+'</div></div><div class="pct">'+(st.done?'100%':pct+'%')+'</div></div>';
    }).join('');
    document.getElementById('log').textContent = s.lastLog.join('\\n') || 'РЎР±РѕСЂРєР° РµС‰С‘ РЅРµ РЅР°С‡Р°С‚Р°.';
    document.getElementById('stamp').textContent = 'РћР±РЅРѕРІР»РµРЅРѕ: ' + new Date(s.updatedAt).toLocaleTimeString('ru-RU');
  } catch (e) {
    document.getElementById('stamp').textContent = 'РќРµС‚ СЃРІСЏР·Рё СЃ СЃРµСЂРІРµСЂРѕРј: ' + e.message;
  }
}
tick(); setInterval(tick, 3000);
</script></body></html>`;

http.createServer((req, res) => {
  if (req.url.startsWith('/status.json')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(snapshot()));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(PAGE);
}).listen(PORT, '127.0.0.1', () => console.log(`progress on http://127.0.0.1:${PORT}`));


