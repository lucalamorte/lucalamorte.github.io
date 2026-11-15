// Traza la carga y la flecha con el registro interno del navegador y suma el tiempo de layout y de estilos según
// qué los disparó (la línea de código que los forzó, o el cuadro normal si nadie los forzó).
// Uso: node tools/trace.mjs <url> [ancho] [alto]
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, W = '1600', H = '912'] = process.argv.slice(2);
const edge = `${process.env['ProgramFiles(x86)']}/Microsoft/Edge/Application/msedge.exe`;
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(edge, ['--headless=new', `--user-data-dir=${join(tmpdir(), `trace-${Date.now()}`)}`, `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('timeout'); proc.kill(); process.exit(1); }, 200000).unref();
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); let events = [], done = null;
ws.addEventListener('message', e => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Tracing.dataCollected') events.push(...m.params.value);
  if (m.method === 'Tracing.tracingComplete') done && done(); });
const send = (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });

async function traced(name, run, ms) {
  events = [];
  await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack', transferMode: 'ReportEvents' });
  await run(); await sleep(ms);
  await new Promise(r => { done = r; send('Tracing.end'); });
  const by = new Map(); let total = { Layout: 0, UpdateLayoutTree: 0, Paint: 0 };
  for (const e of events) {
    if (!(e.name in total) || e.ph !== 'X') continue;
    const d = (e.dur || 0) / 1000; total[e.name] += d;
    const st = e.args?.beginData?.stackTrace || e.args?.data?.stackTrace;
    const f = st && st[0];
    const key = `${e.name} ← ${f ? `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}` : '(frame)'}`;
    by.set(key, (by.get(key) || 0) + d);
  }
  console.log(`\n== ${name}  ` + Object.entries(total).map(([k, v]) => `${k} ${Math.round(v)}ms`).join(' · '));
  [...by].sort((a, b) => b[1] - a[1]).slice(0, 16).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(5)}ms  ${k}`));
}
await traced('carga (8 s)', () => send('Page.navigate', { url }), 8000);
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await traced('flecha x3', async () => { for (let k = 0; k < 3; k++) { await ev(`document.querySelector('.scroll-next')?.click()`); await sleep(1200); } }, 500);
proc.kill(); process.exit(0);
