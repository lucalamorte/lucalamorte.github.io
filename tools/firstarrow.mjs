// Compara la primera flecha con la segunda en un Edge visible: cuadros que no llegaron a la pantalla y qué tareas
// largas hubo (hilo de la página, raster y GPU). Uso: node tools/firstarrow.mjs <url>
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const [url, wait = '7000'] = process.argv.slice(2);
const edge = `${process.env['ProgramFiles(x86)']}/Microsoft/Edge/Application/msedge.exe`;
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(edge, ['--window-position=0,0', '--window-size=1600,912', '--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${join(tmpdir(), `fa-${Date.now()}`)}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('timeout'); proc.kill(); process.exit(1); }, 150000).unref();
for (let i = 0; i < 50; i++) { try { if ((await (await fetch(`http://127.0.0.1:${port}/json`)).json()).length) break; } catch {} await sleep(200); }
await sleep(2500);
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const bws = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
const mk = async u => { const ws = new WebSocket(u); await new Promise(r => ws.addEventListener('open', r)); let id = 0; const p = new Map(); const h = { ws, events: [], done: null };
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); }
    if (m.method === 'Tracing.dataCollected') h.events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') h.done && h.done(); });
  h.send = (method, params = {}) => new Promise(r => { const k = ++id; p.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); }); return h; };
const page = await mk(tab.webSocketDebuggerUrl), browser = await mk(bws);
const ev = async x => (await page.send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
await page.send('Page.bringToFront');
await page.send('Page.navigate', { url }); await sleep(+wait);
for (const k of [1, 2, 3]) {
  browser.events = [];
  await browser.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,viz,gpu,benchmark,blink', transferMode: 'ReportEvents' });
  await sleep(300);
  await ev(`document.querySelector('.scroll-next').click()`);
  await sleep(1800);
  await new Promise(r => { browser.done = r; browser.send('Tracing.end'); });
  const E = browser.events;
  if (process.env.SAVE) writeFileSync(`${process.env.SAVE}-${k}.json`, JSON.stringify(E));
  const rep = E.filter(e => e.name === 'PipelineReporter' && e.ph === 'b');
  const st = {}; rep.forEach(e => { const s = e.args?.chrome_frame_reporter?.state || '?'; st[s] = (st[s] || 0) + 1; });
  const long = E.filter(e => e.ph === 'X' && e.dur > 8000 && !/ThreadControllerImpl|RunTask|ProxyMain|ThreadPool_RunTask|MessageLoop|TaskQueueManager/.test(e.name))
    .map(e => `${(e.dur / 1000).toFixed(0)}ms ${e.name}${e.args?.data?.url ? ' ' + e.args.data.url.split('/').pop() : ''}${e.args?.data?.functionName ? ' ' + e.args.data.functionName : ''}`);
  const agg = {}; long.forEach(l => { const n = l.replace(/^\d+ms /, ''); agg[n] = (agg[n] || []); agg[n].push(+l.split('ms')[0]); });
  console.log(`\n== flecha ${k}: ` + Object.entries(st).map(([s, n]) => `${s.replace('STATE_', '')} ${n}`).join(' · '));
  Object.entries(agg).sort((a, b) => Math.max(...b[1]) - Math.max(...a[1])).slice(0, 14).forEach(([n, d]) => console.log(`  max ${Math.max(...d)}ms x${d.length}  ${n}`));
  await sleep(1000);
}
proc.kill(); process.exit(0);
