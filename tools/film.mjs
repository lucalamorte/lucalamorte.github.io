// Filma el sitio en un celular emulado (Edge headless por CDP): pantalla de 390x844, táctil, y saca capturas
// mientras corre un guion. Uso: node tools/film.mjs <url> <carpeta> [guion.json]
// El guion es una lista de pasos: {"wait": ms} | {"tap": [x, y]} | {"shot": "nombre"} | {"eval": "js"}
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, scriptFile] = process.argv.slice(2);
const steps = scriptFile ? JSON.parse(readFileSync(scriptFile, 'utf8')) : [{ wait: 3000 }, { shot: 'load' }];
mkdirSync(out, { recursive: true });
const edge = `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
const prof = join(tmpdir(), `film-${Date.now()}`);
const port = 9300 + Math.floor(Math.random() * 500);
// FILM_DESKTOP=1 filma una compu de 1600x912 con mouse, en vez del celular.
const DESK = !!process.env.FILM_DESKTOP, VW = +process.env.FILM_W || (DESK ? 1600 : 390), VH = +process.env.FILM_H || (DESK ? 912 : 844);
const proc = spawn(edge, ['--headless=new', '--disable-gpu', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, `--window-size=${VW},${VH}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Si algo se cuelga (por ejemplo, el servidor no está), corta a los 110 s en vez de quedarse esperando.
setTimeout(() => { console.log('timeout'); try { proc.kill(); } catch {} process.exit(1); }, 110000).unref();
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await sleep(200); }
const page = tabs.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; console.log('ERROR', d.exception?.description?.split(String.fromCharCode(10)).slice(0, 3).join(' | ') || d.text, d.lineNumber); } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DESK ? 1 : 2, mobile: !DESK });
if (!DESK) {
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
}
await send('Page.enable'); await send('Runtime.enable');
// Sin esto la pestaña puede quedar 'oculta' y el navegador deja de animar.
await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Page.navigate', { url });
await sleep(1500);
const log = [];
for (const s of steps) {
  if (process.env.FILM_DEBUG) console.error('step', JSON.stringify(s).slice(0, 80));
  if (s.wait) await sleep(s.wait);
  if (s.eval) { const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true }); log.push(`${s.eval.slice(0, 60)} => ${JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text)}`); }
  if (s.tap) {
    const [x, y] = s.tap;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(s.hold || 80);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  if (s.press) await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.press[0], y: s.press[1] }] });
  if (s.release) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `${s.shot}.png`), Buffer.from(r.result.data, 'base64')); }
}
console.log(log.join('\n'));
ws.close(); proc.kill(); await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch {}
