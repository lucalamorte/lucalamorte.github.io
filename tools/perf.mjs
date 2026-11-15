// Mide dónde se va el tiempo de la página: CPU por función (perfilador de V8) y cuánto toma cada tipo de trabajo
// del navegador (script, layout, estilos) en tres momentos: la carga, la flecha de abajo y el inicio del juego.
// Uso: node tools/perf.mjs <url> [ancho] [alto]
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, W = '1600', H = '912'] = process.argv.slice(2);
const edge = `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
const port = 9300 + Math.floor(Math.random() * 500);
// PERF_REAL=1 usa un Edge con ventana (fuera de la pantalla), que dibuja a ritmo real; sin eso, headless.
const mode = process.env.PERF_REAL ? ['--window-position=-3000,0', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--no-first-run', '--no-default-browser-check'] : ['--headless=new'];
const proc = spawn(edge, [...mode, `--user-data-dir=${join(tmpdir(), `perf-${Date.now()}`)}`, `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('timeout'); proc.kill(); process.exit(1); }, 400000).unref();
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await sleep(200); }
// Con ventana, Edge a veces cambia la pestaña del arranque: se abre una propia.
if (process.env.PERF_REAL) { await sleep(2500); tabs = [await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()]; tabs[0].type = 'page'; }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Performance.enable'); await send('Profiler.enable'); await send('Runtime.enable');
await send('Profiler.setSamplingInterval', { interval: 200 });
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]));
const diff = (a, b) => ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'].map(k => `${k.replace('Duration', '')} ${Math.round((b[k] - a[k]) * 1000)}ms`).join(' · ');

async function phase(name, run, ms) {
  const m0 = await metrics(); await send('Profiler.start');
  await run(); await sleep(ms);
  const prof = (await send('Profiler.stop')).result.profile, m1 = await metrics();
  // Tiempo propio por función, sumado; el intervalo entre muestras es el tiempo de cada una.
  const self = new Map(), byId = new Map(prof.nodes.map(n => [n.id, n]));
  const dt = prof.timeDeltas, samples = prof.samples;
  samples.forEach((sid, k) => { const n = byId.get(sid), f = n.callFrame; if (['(idle)', '(program)', '(root)'].includes(f.functionName)) return;
    const key = `${f.functionName || '(anon)'} ${(f.url.split('/').pop() || '').split('?')[0]}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[k] || 0) / 1000); });
  const gc = [...self].filter(([k]) => k.startsWith('(garbage')).reduce((a, [, v]) => a + v, 0);
  console.log(`\n== ${name}  [${diff(m0, m1)}]  gc ${Math.round(gc)}ms`);
  [...self].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(5)}ms  ${k}`));
}

await phase('carga (8 s)', () => send('Page.navigate', { url }), 8000);
await phase('flecha x3', async () => { for (let k = 0; k < 3; k++) { await ev(`document.querySelector('.scroll-next')?.click()`); await sleep(1200); } }, 500);
await phase('quieto 4 s (sin tocar nada)', async () => {}, 4000);
await phase('Play + 6 s', () => ev(`document.querySelector('[data-pk-play]')?.click()`), 6000);
proc.kill(); process.exit(0);
