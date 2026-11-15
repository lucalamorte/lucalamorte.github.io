// Cuánto trabajo le cuesta la página a la compu: tiempo de CPU del proceso de la placa de video (GPU) y de la página
// (renderer) durante 8 s quieto en el inicio, la flecha y 8 s jugando. Edge con ventana (fuera de la pantalla), que
// dibuja a ritmo real. Es más estable que medir cuadros sueltos.
// Uso: node tools/gpu.mjs <url> [ancho] [alto]   (JANK_CSS agrega reglas, para experimentos)
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, W = '1600', H = '912'] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(edge, ['--window-position=-3000,0', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(tmpdir(), `gpu-${Date.now()}`)}`, `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('timeout'); proc.kill(); process.exit(1); }, 120000).unref();
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch {} await sleep(200); }
await sleep(2500);
const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const open = u => new Promise(r => { const w = new WebSocket(u); w.addEventListener('open', () => r(w)); });
const [bws, ws] = await Promise.all([open(ver.webSocketDebuggerUrl), open(tab.webSocketDebuggerUrl)]);
const keep = setInterval(() => {}, 1000);
const client = w => { let id = 0; const pending = new Map(); w.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  return (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); w.send(JSON.stringify({ id: k, method, params })); }); };
const send = client(ws), bsend = client(bws);
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
if (process.env.JANK_CSS) await send('Page.addScriptToEvaluateOnNewDocument', { source: `addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = ${JSON.stringify(process.env.JANK_CSS)}; document.head.append(st); });` });
// La página es el renderer que más trabaja (Edge con un perfil nuevo tiene otros, de servicios propios, casi quietos).
const cpu = async () => { const r = (await bsend('SystemInfo.getProcessInfo')).result.processInfo; const by = {}; r.forEach(p => { by[p.type + ':' + p.id] = p.cpuTime; }); return by; };
async function phase(name, run, ms) {
  const a = await cpu(); const t = Date.now(); await run(); await sleep(ms); const b = await cpu(); const s = (Date.now() - t) / 1000;
  const d = Object.keys(b).map(k => [k, ((b[k] || 0) - (a[k] || 0)) / s * 100]);
  const top = type => Math.round(Math.max(0, ...d.filter(([k]) => k.startsWith(type + ':')).map(([, v]) => v)));
  console.log(`${name.padEnd(22)} GPU ${String(top('GPU')).padStart(3)}%  página ${String(top('renderer')).padStart(3)}%   (100% = un núcleo entero)`);
}
await send('Page.navigate', { url }); await sleep(4000);
await phase('quieto en el inicio', async () => {}, 8000);
if (process.env.ONLY_IDLE) { proc.kill(); process.exit(0); }
await phase('flecha x3', async () => { for (let k = 0; k < 3; k++) { await ev(`document.querySelector('.scroll-next')?.click()`); await sleep(1300); } }, 300);
await ev('scrollTo({ top: 0, behavior: "instant" })'); await sleep(800);
await phase('jugando 8 s', () => ev(`document.querySelector('[data-pk-play]')?.click()`), 8000);
proc.kill(); process.exit(0);
