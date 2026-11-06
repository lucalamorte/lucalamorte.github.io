// Prueba automática del juego: recorre todo el DAG con las flechas hasta la tabla y deja el resultado en el título.
// Se carga sola con index.html#selftest; la corre selftest.ps1 en escritorio y en celular.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  addEventListener('error', e => errors.push(e.message));
  while (!window.__pk || document.readyState !== 'complete') await sleep(100);
  await sleep(1500);
  const pk = window.__pk, code = { right: 'ArrowRight', left: 'ArrowLeft', down: 'ArrowDown' };
  const ev = (type, k) => dispatchEvent(new KeyboardEvent(type, { key: code[k], code: code[k], bubbles: true }));
  const press = async (k, ms) => { ev('keydown', k); pk.sim(ms); await sleep(150); ev('keyup', k); pk.sim(100); await sleep(100); };
  const tasks = () => document.querySelectorAll('#experience .card.big, #projects .card, #more .fold');
  try { sessionStorage.clear(); } catch {}
  // Arranca parado en el título, a la derecha del portal, como después del vuelo de entrada.
  pk.start(); { const f = pk.level().face; pk.place(f.x2 + 60, f.y2 - 8 - 24); } pk.sim(3500); await sleep(300);
  // En el DAG el camino se arma en orden: se va siempre hacia el vecino que viene después. Fuera del DAG
  // (bucket, Snowflake, la tabla) se prueban las flechas en ronda.
  const nodes = () => pk.level().nodes, here = () => { const st = pk.state(); return nodes().find(n => Math.hypot(n.x - (st.x + 12), n.y - (st.y + 12)) < 4); };
  const dirTo = (a, b) => Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? (b.x > a.x ? 'right' : 'left') : (b.y > a.y ? 'down' : 'up');
  code.up = 'ArrowUp';
  for (let i = 0; i < 160 && !pk.state().won; i++) {
    const n = here(), list = nodes();
    const next = n && n.links.filter(m => list.indexOf(m) > list.indexOf(n)).sort((u, v) => list.indexOf(u) - list.indexOf(v))[0];
    await press(next ? dirTo(n, next) : ['right', 'right', 'left', 'left', 'down'][i % 5], 3000); await sleep(300); pk.sim(3000);
  }
  if (!pk.state().won) { ev('keydown', 'right'); for (let i = 0; i < 40 && !pk.state().won; i++) { pk.sim(500); await sleep(30); } ev('keyup', 'right'); }
  const read = [...tasks()].filter(el => el.classList.contains('read')).length, total = tasks().length, won = pk.state().won;
  const ok = won && read === total && !errors.length;
  document.title = `SELFTEST ${ok ? 'PASS' : 'FAIL'} ${innerWidth}px read ${read}/${total} won ${won}${errors.length ? ' errors ' + errors.join(' | ') : ''}`;
})();
