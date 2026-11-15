// La primera vez que se aprieta la flecha, con el caché vacío: cuánto tarda cada cuadro mientras baja.
// Uso: node tools/arrow.mjs <url>   (abre un Edge visible en la esquina, perfil nuevo)
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url] = process.argv.slice(2);
const edge = `${process.env['ProgramFiles(x86)']}/Microsoft/Edge/Application/msedge.exe`;
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(edge, ['--window-position=0,0', '--window-size=1600,912', '--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${join(tmpdir(), `arrow-${Date.now()}`)}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { proc.kill(); process.exit(1); }, 90000).unref();
for (let i = 0; i < 50; i++) { try { if ((await (await fetch(`http://127.0.0.1:${port}/json`)).json()).length) break; } catch {} await sleep(200); }
await sleep(2500);
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.bringToFront');
await send('Page.navigate', { url }); await sleep(4000);
const rec = `new Promise(done => { const d = []; let p = performance.now(); const f = t => { d.push(t - p); p = t; if (d.length < 400 && t < start + 2500) requestAnimationFrame(f); else done(d); }; const start = performance.now(); requestAnimationFrame(f); })`;
for (let k = 1; k <= 3; k++) {
  const run = ev(rec); await sleep(30);
  await ev(`document.querySelector('.scroll-next').click()`);
  const d = (await run).slice(1), max = Math.max(...d);
  console.log(`flecha ${k}: ${d.length} cuadros en 2.5 s · peor ${max.toFixed(0)} ms · >34ms: ${d.filter(x => x > 34).length} · >50ms: ${d.filter(x => x > 50).length}`);
  await sleep(800);
}
proc.kill(); process.exit(0);
