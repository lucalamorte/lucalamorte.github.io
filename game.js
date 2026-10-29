// El portfolio como nivel, contado como un camino del héroe sin exagerar: el muñequito espera junto al botón
// de la portada; al tocarlo salta, cruza el retrato de Luca y cae sobre el título. Cada sección es una etapa
// (el mentor, las pruebas, lo construido, las lecciones, el entrenamiento, el regreso) y el final es el contacto. Se mueve con ← → ↑ o con los controles del celu; scrollear o Esc lo pausa.
// Es un dato que viaja por el stack hasta llegar al contacto, y cada pieza hace lo que hace de verdad:
// todo pasa en AWS, S3 lo guarda como archivo, el DAG de Airflow lo deja pasar a horario y lo carga,
// Monte Carlo lo revisa, en Snowflake dbt lo transforma de raw a mart, el warehouse escala mientras
// lo usas y el hueco te deja justo arriba del primer producto, el chat de Nutrigordo contesta, las flashcards de PrimeroLab vuelven
// más tarde, DataChinchilla salta los pasos que ya tienes, las reglas de How I work se abren al pisarlas
// y las credenciales se sellan.
// El camino es siempre el mismo: los bordes de la columna son paredes y cada sección tiene una sola salida.
(() => {
  const $ = s => document.querySelector(s);
  const hero = $('.hero'), portrait = $('#portrait');
  if (!hero) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACCENT = '#5eead4', MUTED = '#94a3b8', LINE = 'rgba(94,234,212,.55)', FAINT = 'rgba(148,163,184,.35)', INK = '#0b1120', BG = 'rgba(11,17,32,.92)', RED = '#f87171', EGG = '#f8fafc', YOLK = '#fbbf24';
  const GRAVITY = 1900, JUMP = 720, SPEED = 290, S = 24, MONO = '11px "JetBrains Mono", monospace';

  // ---------- piezas en la página ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'play-layer'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const hit = document.createElement('button');
  hit.type = 'button'; hit.className = 'pk-hit'; hit.setAttribute('aria-label', 'Start the journey: play the portfolio as a game');
  const hint = document.createElement('span');
  hint.className = 'pk-hint'; hint.textContent = touch ? 'tap to start' : 'click to start the journey'; hint.classList.add('side');
  // La misión, con las teclas para moverse, en un globo sobre el muñequito.
  const mission = document.createElement('div');
  mission.className = 'pk-say'; mission.setAttribute('role', 'status');
  mission.innerHTML = `<p>Find Luca. He's at the end.</p>${touch ? '<p class="go">use the buttons below ↓</p>' : '<p class="go"><kbd>←</kbd><kbd>→</kbd> move <kbd>↑</kbd> jump</p>'}`;
  // El panel fijo con los controles y el botón para reiniciar; aparece cuando el juego ya empezó.
  const help = document.createElement('div');
  help.className = 'play-help';
  help.innerHTML = '<span><kbd>←</kbd><kbd>→</kbd> move</span><span><kbd>↑</kbd> jump</span><span><kbd>↓</kbd> down</span><button type="button" class="restart">↺ restart</button><button type="button" class="exit">✕ exit</button>';
  const pad = document.createElement('div');
  pad.className = 'pad'; pad.hidden = true;
  pad.innerHTML = '<button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="right" aria-label="Right">▶</button><button type="button" data-k="down" class="down" aria-label="Go down">▼</button><button type="button" data-k="jump" class="jump" aria-label="Jump">▲</button><button type="button" class="x" aria-label="Stop playing">✕</button><button type="button" class="restart re" aria-label="Restart the game">↺</button>';
  document.body.append(canvas, hit, hint, mission, help, pad);

  let exited = false, fade = 1, mode = 'wait', missionUntil = 0, W = 0, H = 0, level = null, keys = {}, last = 0, labels = [], expected = -1, intro = null, won = false;
  const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, on: null, face: 1, squash: 0, form: 'pk', ride: null, dropUntil: 0, trail: [] };

  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const home = () => { const b = box($('.hero h1')); return { x: b.x + 6, y: b.y + 4 - S }; };
  // Donde espera antes de empezar: al lado del primer botón de la portada, más grande y saltando.
  const BIG = 1.5;
  const waitSpot = () => { const b = box($('.hero .cta .btn')); return { x: b.r + 26, y: b.b - S }; };
  // Un cartelito que flota sobre el muñequito o sobre una pieza.
  // Los diálogos siempre salen justo arriba del muñequito y lo siguen mientras se mueve.
  const say = (text, ms = 2000) => { labels = labels.filter(l => l.text !== text); labels.push({ text, until: performance.now() + ms }); };

  // ---------- el nivel ----------
  function build() {
    W = document.documentElement.clientWidth;
    const plats = [], things = [], checkpoints = [], walls = [];
    let level_mc = null;
    const h = box(hero), colL = Math.max(16, h.x), colR = Math.min(W - 16, h.r);
    const ledge = (x, y, w, extra = {}) => { const p = { x, y, w, solid: true, ...extra }; plats.push(p); return p; };
    // Un piso de lado a lado con huecos: por ahí se baja.
    const floor = (y, gaps = [], extra = {}) => {
      let x = -60;
      for (const [gx, gw] of [...gaps, [W + 60, 0]]) { if (gx > x) ledge(x, y, gx - x, { floor: true, ...extra }); x = gx + gw; }
      gaps.forEach(([gx, gw]) => things.push({ draw: now => drawGap(gx + gw / 2, y, now) }));
    };
    // Lectura obligada: paredes a los costados de una lista y, debajo de cada fila, un piso. Parado ahí se lee
    // lo de arriba; cuando la barrita se llena se abre una compuerta en una punta (alternando lados) y se baja
    // caminando hasta ella. La flecha ↓ es un atajo. Con auto, el piso se abre solo al terminar.
    const GATE = 56;
    const gated = (L, R, k, yOf, extra) => {
      const right = k % 2 === 0;
      const p = ledge(right ? L : L + GATE, yOf(), R - L - GATE, { kind: 'read', t: 0, ...extra });
      const gate = ledge(right ? R - GATE : L, yOf(), GATE, { kind: 'gate', main: p });
      p.gate = gate; p.side = right ? '→' : '←'; gate.bare = p.bare;
      p.tick = () => { const ny = yOf(); for (const q of [p, gate]) { if (P.on === q) P.y += ny - q.y; q.y = ny; } };
      p.open = () => { gate.solid = false; gate.open = true; };
      return p;
    };
    // Filas de piezas lado a lado (los números, las tarjetas): el piso es su borde de arriba, entre paredes.
    // Parado sobre una pieza se la lee; la fila se abre recién cuando se leyeron todas.
    const rowRead = (els, top, need, onEnter, onDone) => {
      if (!els.length) return;
      const all = els.map((el, k) => { const c = box(el); return { el, k, x: c.x, r: c.r, y: c.y, t: 0 }; });
      const L = Math.min(...all.map(c => c.x)) - 4, R = Math.max(...all.map(c => c.r)) + 4, bottom = Math.max(...els.map(el => box(el).b));
      walls.push({ x: L, y1: top, y2: bottom }, { x: R, y1: top, y2: bottom });
      const byRow = new Map();
      all.forEach(c => { const key = Math.round(c.y); byRow.set(key, [...(byRow.get(key) || []), c]); });
      [...byRow.values()].forEach((cards, r) => {
        const yOf = () => Math.min(...cards.map(c => c.el.getBoundingClientRect().top)) + scrollY;
        const p = gated(L, R, r, yOf, { cards, need, bare: true });
        let current = null;
        p.ready = () => cards.every(c => c.t >= need);
        p.stand = p.gate.stand = dt => {
          const cx = P.x + S / 2, c = cards.find(q => cx >= q.x - 8 && cx <= q.r + 8);
          if (!c) return;
          if (current !== c) { current = c; els.forEach(el => el.classList.toggle('lit', el === c.el)); onEnter(c); }
          if (c.t >= need) return;
          c.t += dt;
          if (c.t < need) return;
          if (onDone) onDone(c);
          if (p.ready()) p.open();
        };
      });
    };
    // Portada: el título es el piso, sin línea encima, y no hay ningún hueco. La única salida es la cara de
    // Luca: al entrar el muñequito se zambulle, cruza la cabeza (las rayas se ondulan) y sale por abajo.
    const h1 = box($('.hero h1')), fig = portrait ? box(portrait) : null;
    let face = null;
    if (fig && fig.b > h1.y) {
      // Con el retrato al costado, el título llega hasta la cara: caminando a la izquierda se entra de frente.
      // Los hombros cierran por debajo, así que no hay otra forma de bajar.
      ledge(fig.r - fig.w * 0.25, h1.y + 4, Math.min(W, colR + 44) - (fig.r - fig.w * 0.25), { floor: true });
    } else {
      // En el celu el retrato queda arriba del título: se salta desde el título hacia la cara.
      ledge(h1.x, h1.y + 4, h1.w, { floor: true });
      floor(h.b - 8);
    }
    // La zambullida suelta al muñequito un poco arriba de la sección siguiente, para que aterrice en ella.
    const nextEl = hero.nextElementSibling, landY = nextEl ? box(nextEl.firstElementChild || nextEl).y - 70 : h.b + 10;
    if (fig) {
      face = fig.b > h1.y
        // Con el retrato al costado, todo lo que quede a la izquierda del título entra por la cara, salte por donde salte.
        ? { x1: -60, x2: fig.r - fig.w * 0.25 + 14, y1: h.y - 200, y2: fig.y + fig.h * 0.8, ex: fig.x + fig.w * 0.42, ey: landY, via: [fig.x + fig.w * 0.5, fig.y + fig.h * 0.38] }
        : { x1: fig.x + fig.w * 0.3, x2: fig.x + fig.w * 0.7, y1: fig.y + fig.h * 0.08, y2: fig.y + fig.h * 0.74, ex: fig.x + fig.w * 0.42, ey: landY };
    }

    // Lo construido en Kimberly-Clark: las dos tarjetas grandes, cada una con su comentario.
    const flagEls = [...document.querySelectorAll('#experience .card.big')];
    const reads = { done: flagEls.filter(el => el.classList.contains('read')).length, total: flagEls.length };
    rowRead(flagEls, box($('#experience')).y + 40, 1.8, () => {}, c => { if (!c.el.classList.contains('read')) { c.el.classList.add('read'); reads.done++; } });

    // Productos: el muñequito usa cada uno mientras lo lee.
    const cardEls = [...document.querySelectorAll('#projects .card')];
    rowRead(cardEls, box($('#projects')).y + 40, 1.5, () => {});

    // Al final de los productos está el bucket de S3: la única salida hacia Experience.
    const pr = box($('#projects'));
    const fy = pr.b - 6, bw = 84, bx = Math.max(colL + 30, 24);
    floor(fy, [[bx, bw]]);
    // Airflow corre 3 segundos después de que el archivo cae al bucket (si los números ya se leyeron).
    const RUN = 3000, ready = () => reads.done >= reads.total;
    const bucket = { x: bx, y: fy, w: bw, d: 52, since: 0, ready };
    // Del bucket no se sale por los costados: la única salida es la compuerta de abajo.
    walls.push({ x: bx, y1: fy, y2: fy + 52 }, { x: bx + bw, y1: fy, y2: fy + 52 });
    const gateOpen = now => ready() && bucket.since && now - bucket.since >= RUN;
    const gate = ledge(bx + 4, fy + 48, bw - 8, { tick: now => { gate.solid = !gateOpen(now); }, land: () => { if (!ready()) say('read first ↑', 2000); } });
    things.push({ draw: now => drawBucket(bucket, gateOpen(now), now, RUN, reads) });

    // La tarea de Airflow carga el archivo hasta Snowflake (extract y load). La caja de Snowflake queda a la
    // izquierda del contacto, que tiene lugar libre, con su piso justo arriba de los botones.
    const ctBtn = box($('#contact .btn'));
    const wx = colL + 14, wy = ctBtn.b - 60, top = wy - 240;
    const path = [[bx + bw / 2, fy + 56], [bx + bw / 2, top], [wx + 28, top], [wx + 28, top + 30]];
    const pipe = { path, mouth: [bx + bw / 2, fy + 56] };
    things.push({ draw: now => drawPipe(pipe, now) });

    // Snowflake es una caja cerrada: las paredes no dejan salir. Adentro, todo va de pared a pared y en orden:
    // primero se prende el warehouse (sin cómputo no corre nada), después dbt construye raw, staging y mart.
    // No se puede saltear ninguna capa. Al fondo, la salida pasa por Monte Carlo.
    const sfW = Math.min(240, W - wx - 16), boxL = wx - 14, boxR = boxL + sfW, boxB = wy + 28;
    walls.push({ x: boxL, y1: top - 18, y2: boxB }, { x: boxR, y1: top - 18, y2: boxB });
    const LAYERS = [['warehouse', 1.5], ['raw.orders', 0.8], ['stg_orders', 1.4], ['fct_orders', 1.4]];
    LAYERS.forEach(([name, need], k) => {
      const m = gated(boxL + 2, boxR - 2, k, () => top + 50 + k * 50, { kind: 'model', name, need, built: false });
      if (k === 0) m.label = () => m.built ? 'warehouse M · running' : `warehouse ${['XS', 'S', 'M'][Math.min(2, Math.floor(m.t / m.need * 3))]}`;
      m.stand = m.gate.stand = dt => {
        if (m.built) return;
        m.t += dt;
        if (m.t >= m.need) { m.built = true; m.open();  }
      };
      m.gate.land = m.land;
    });
    const hatch = { x: boxR - 74, w: 58 };
    ledge(boxL, boxB, hatch.x - boxL, { floor: true });
    ledge(hatch.x + hatch.w, boxB, boxR - hatch.x - hatch.w, { floor: true });
    const mc = { checked: false };
    things.push({ draw: now => {
      // La caja: el borde de abajo se corta en la salida, para que se vea que ahí se pasa.
      ctx.strokeStyle = 'rgba(94,234,212,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(hatch.x, boxB); ctx.lineTo(boxL + 18, boxB); ctx.arcTo(boxL, boxB, boxL, boxB - 18, 18); ctx.lineTo(boxL, top - 18 + 18);
      ctx.arcTo(boxL, top - 18, boxL + 18, top - 18, 18); ctx.lineTo(boxR - 18, top - 18); ctx.arcTo(boxR, top - 18, boxR, top, 18);
      ctx.lineTo(boxR, boxB - 18); ctx.arcTo(boxR, boxB, boxR - 18, boxB, 18); ctx.lineTo(hatch.x + hatch.w, boxB); ctx.stroke();
      snowflake(wx + 2, top - 26, 5, ACCENT); text('Snowflake', wx + 12, top - 22, ACCENT);
      // Monte Carlo en la salida: un marco con una línea que escanea.
      const k = (Math.sin(now / 300) + 1) / 2, cx = hatch.x + hatch.w / 2;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(hatch.x + 4, boxB - 6, hatch.w - 8, 34, 6); ctx.stroke();
      ctx.globalAlpha = 0.5 + k * 0.5; ctx.beginPath(); ctx.moveTo(hatch.x + 8, boxB - 2 + k * 26); ctx.lineTo(hatch.x + hatch.w - 8, boxB - 2 + k * 26); ctx.stroke(); ctx.globalAlpha = 1;
      text('Monte Carlo', cx, boxB + 44, ACCENT, 'center');
    } });
    level_mc = { x: hatch.x, w: hatch.w, y: boxB, state: mc };

    // Contacto: el buzón es la meta.
    // La fila de botones ocupa todo el ancho: se mide desde el primer botón hasta el último.
    const ct = box($('#contact')), btn = box($('#contact .btn')), lastBtn = box($('#contact .cta .btn:last-child'));
    const right = lastBtn.r + 40 + 40 < W ? lastBtn.r + 40 : Math.max(8, btn.x - 60);
    const mailbox = { x: right, y: btn.b - 44, w: 32, h: 44, flag: 0 };
    things.push({ draw: now => drawMailbox(mailbox, now) });
    floor(btn.b, []);

    const STAGES = { experience: 'the work', projects: 'what was built', contact: 'the return' };
    for (const [id, stage] of Object.entries(STAGES)) { const b = box(document.getElementById(id)); checkpoints.push({ y: b.y, x: colL + 30, stage }); }
    const bounds = { l: Math.max(0, colL - 44), r: Math.min(W, colR + 44) };
    return { plats, things, walls, bounds, face, mc: level_mc, pipe, bucket, mailbox, checkpoints, colL, colR, docH: document.documentElement.scrollHeight };
  }

  // ---------- dibujo ----------
  function text(t, x, y, color = MUTED, align = 'left', font = MONO) {
    ctx.font = font; ctx.textAlign = align;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(t, x, y);
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function dashedBox(x, y, w, h, r) { ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(94,234,212,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); ctx.setLineDash([]); }
  function drawGap(x, y, now) { const k = Math.sin(now / 250) * 3; text('↓', x, y + 4 + k, ACCENT, 'center', '14px "JetBrains Mono", monospace'); }
  function drawBucket(b, open, now, run, reads) {
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(b.x - 6, b.y); ctx.lineTo(b.x + 6, b.y + b.d); ctx.lineTo(b.x + b.w - 6, b.y + b.d); ctx.lineTo(b.x + b.w + 6, b.y); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y, b.w / 2 + 6, 5, 0, 0, Math.PI * 2); ctx.stroke();
    if (open) { ctx.fillStyle = INK; ctx.fillRect(b.x + 8, b.y + b.d - 2, b.w - 16, 4); }
    text('S3', b.x + b.w / 2, b.y + b.d / 2 + 6, ACCENT, 'center');
    // El DAG de Airflow: una tarea por párrafo leído; con las tres hechas, 3 segundos después de entrar corre.
    const cx = b.x + b.w + 22, cy = b.y + 22, left = b.since ? Math.max(0, (run - (now - b.since)) / 1000) : run / 1000;
    const all = reads.done >= reads.total;
    const nodes = [[cx, cy], [cx + 22, cy - 9], [cx + 22, cy + 9], [cx + 44, cy]];
    ctx.strokeStyle = MUTED; ctx.lineWidth = 1.2; ctx.beginPath();
    [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([a, z]) => { ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[z][0], nodes[z][1]); }); ctx.stroke();
    nodes.forEach(([x, y], k) => { const on = k === 3 ? open : k === 0 ? reads.done >= 1 : k === 1 ? reads.done >= 2 : all; ctx.fillStyle = on ? ACCENT : INK; ctx.strokeStyle = on ? ACCENT : MUTED; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    text(!all ? `Airflow: read the work first · ${reads.done}/${reads.total}` : open ? 'Airflow: DAG running' : b.since ? 'Airflow: run starts in' : 'Airflow: drop the file in S3', cx + 54, cy + 4, open ? ACCENT : MUTED);
    // La cuenta, grande, arriba del bucket.
    if (all && b.since && !open) text(String(Math.ceil(left)), b.x + b.w / 2, b.y - 22, ACCENT, 'center', '600 28px "JetBrains Mono", monospace');
  }
  function drawPipe(p, now) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); p.path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(94,234,212,.14)'; ctx.lineWidth = 20; ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -now / 30; ctx.stroke(); ctx.setLineDash([]);
    const [x2, y2] = p.path[2];
    text('Airflow · load', x2 + 16, y2 - 14, ACCENT);
  }
  function snowflake(x, y, r, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
  }
  function drawMailbox(m, now) {
    const up = won ? 1 : 0;
    m.flag += (up - m.flag) * 0.12;
    ctx.strokeStyle = MUTED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x + m.w / 2, m.y + 24); ctx.lineTo(m.x + m.w / 2, m.y + m.h); ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(m.x, m.y + 26); ctx.lineTo(m.x, m.y + 12); ctx.arc(m.x + m.w / 2, m.y + 12, m.w / 2, Math.PI, 0); ctx.lineTo(m.x + m.w, m.y + 26); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.x + 8, m.y + 14); ctx.lineTo(m.x + m.w - 8, m.y + 14); ctx.stroke();
    ctx.save(); ctx.translate(m.x + m.w + 3, m.y + 22); ctx.rotate((1 - m.flag) * Math.PI / 2);
    ctx.fillStyle = RED; ctx.fillRect(-1, -16, 2, 16); ctx.fillRect(-1, -16, 11, 7); ctx.restore();
    if (!won) text('contact', m.x + m.w / 2, m.y - 10, MUTED, 'center');
  }
  function drawPlat(p, now) {
    if (p.hidden) return;
    if (p.kind === 'model') {
      if (p.built) { text(`✓ ${p.label ? p.label() : p.name}`, p.x + 12, p.y + 18, ACCENT); return; }
      ctx.fillStyle = 'rgba(148,163,184,.1)'; ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, p.w - 12, 6, 3); ctx.fill(); ctx.stroke();
      if (p.t) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, (p.w - 12) * Math.min(1, p.t / p.need), 6, 3); ctx.fill(); }
      text(p.label ? p.label() : p.name, p.x + 12, p.y + 20, MUTED);
      if (p.label && !p.built) snowflake(p.x + p.w - 18, p.y + 16, 5, p.t ? ACCENT : MUTED);
      return;
    }
    if (p.kind === 'read') {
      if (!p.solid) return;
      if (!p.bare) { ctx.setLineDash([2, 6]); ctx.strokeStyle = 'rgba(148,163,184,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
      if (p.cards) p.cards.forEach(c => { if (c.t) { const x0 = Math.max(p.x, c.x); ctx.moveTo(x0, p.y); ctx.lineTo(x0 + (Math.min(c.r, p.x + p.w) - x0) * Math.min(1, c.t / p.need), p.y); } });
      else if (p.t) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w * Math.min(1, p.t / p.need), p.y); }
      ctx.stroke();
      return;
    }
    if (p.kind === 'gate') {
      // Abierta, corta la línea de la fila; cerrada, la línea de la fila alcanza (o una marca si no hay línea).
      if (p.open) { ctx.fillStyle = '#0b1120'; ctx.fillRect(p.x + 4, p.y - 2, p.w - 8, 5); if (P.on === p.main || P.on === p) drawGap(p.x + p.w / 2, p.y, now); return; }
      if (!p.bare) { ctx.strokeStyle = MUTED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x + 3, p.y); ctx.lineTo(p.x + p.w - 3, p.y); ctx.stroke(); }
      return;
    }
    if (p.floor) { ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); return; }
    ctx.strokeStyle = p.solid ? LINE : 'rgba(94,234,212,.15)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawPk(x, y, now) {
    if (P.form === 'dot') { ctx.shadowColor = ACCENT; ctx.shadowBlur = 14; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(x + S / 2, y + S / 2, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; return; }
    if (P.form === 'file') {
      ctx.fillStyle = INK; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 15, y); ctx.lineTo(x + 21, y + 6); ctx.lineTo(x + 21, y + S); ctx.lineTo(x + 3, y + S); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ACCENT; [9, 14, 19].forEach(ly => ctx.fillRect(x + 7, y + ly, 10, 2));
      return;
    }
    // El muñequito: se aplasta al caer, se estira al saltar, pestañea y mira hacia donde va.
    const sq = P.squash, sx = 1 + sq * 0.22, sy = 1 - sq * 0.22;
    const w = S * sx, h = S * sy, px = x + (S - w) / 2, py = y + (S - h);
    ctx.shadowColor = ACCENT; ctx.shadowBlur = 16; ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.roundRect(px, py, w, h, 7); ctx.fill(); ctx.shadowBlur = 0;
    const blink = (now % 3400) < 110, look = P.face * 2.5;
    ctx.fillStyle = INK;
    const eh = blink ? 1.5 : 7 * sy;
    ctx.fillRect(px + w * 0.27 + look - 2, py + h * 0.32, 4, eh); ctx.fillRect(px + w * 0.63 + look - 2, py + h * 0.32, 4, eh);
  }

  function draw(now) {
    const top = scrollY;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -top);
    const seen = (y, h = 0) => y + h > top - 120 && y < top + H + 120;
    if (mode === 'play' && level) {
      for (const t of level.things) t.draw(now);
      ctx.setLineDash([2, 8]); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const w of level.walls) { const y1 = Math.max(w.y1, top - 20), y2 = Math.min(w.y2, top + H + 20); if (y2 > y1) { ctx.moveTo(w.x, y1); ctx.lineTo(w.x, y2); } }
      for (const x of [level.bounds.l, level.bounds.r]) { ctx.moveTo(x, top); ctx.lineTo(x, top + H); }
      ctx.stroke(); ctx.setLineDash([]);
      // Lo que queda lejos del muñequito se apaga, para que el texto de la página se lea tranquilo.
      for (const p of level.plats) {
        if (!seen(p.y)) continue;
        ctx.globalAlpha = fade = p.floor ? 1 : Math.max(0.22, Math.min(1, 1 - (Math.abs(p.y - P.y) - 160) / 260));
        drawPlat(p, now);
      }
      ctx.globalAlpha = fade = 1;
    } else if (level && P.on && !P.on.floor && !P.on.hidden) drawPlat(P.on, now);
    // La estela del muñequito cuando atraviesa el retrato.
    P.trail.forEach((t, k) => { ctx.globalAlpha = (k / P.trail.length) * 0.35; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(t[0] + 4, t[1] + 4, S - 8, S - 8, 5); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (mode === 'wait') {
      const ws = waitSpot(), hop = still ? 0 : (now % 1600 < 520 ? Math.sin((now % 1600) / 520 * Math.PI) * 12 : 0);
      P.face = -1;
      ctx.save(); ctx.translate(ws.x + S / 2, ws.y + S - hop); ctx.scale(BIG, BIG); ctx.translate(-(ws.x + S / 2), -(ws.y + S));
      drawPk(ws.x, ws.y, now); ctx.restore();
    } else if (seen(P.y)) {
      if (P.on && (P.on.hidden || P.on.kind === 'read') && mode === 'play') {
        const g2 = ctx.createLinearGradient(P.x - 30, 0, P.x + S + 30, 0);
        g2.addColorStop(0, 'rgba(94,234,212,0)'); g2.addColorStop(0.5, 'rgba(94,234,212,.75)'); g2.addColorStop(1, 'rgba(94,234,212,0)');
        ctx.strokeStyle = g2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x - 30, P.on.y); ctx.lineTo(P.x + S + 30, P.on.y); ctx.stroke();
      }
      drawPk(P.x, P.y, now);
    }
    labels = labels.filter(l => now < l.until);
    // Los diálogos, apilados sobre el muñequito y sin salirse de la pantalla.
    ctx.font = MONO;
    labels.forEach((l, k) => {
      const a = Math.min(1, (l.until - now) / 300), half = ctx.measureText(l.text).width / 2 + 8;
      const ly = P.y - 14 - (labels.length - 1 - k) * 16 - (1 - a) * 6;
      ctx.globalAlpha = a; text(l.text, Math.max(half, Math.min(W - half, P.x + S / 2)), ly, ACCENT, 'center'); ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  // ---------- física ----------
  function rideTo(d) {
    const path = level.pipe.path;
    for (let k = 1; k < path.length; k++) {
      const [ax, ay] = path[k - 1], [bx, by] = path[k], len = Math.hypot(bx - ax, by - ay);
      if (d <= len) return [ax + (bx - ax) * d / len, ay + (by - ay) * d / len, false];
      d -= len;
    }
    const [x, y] = path[path.length - 1]; return [x, y, true];
  }
  function step(dt, now, control) {
    if (P.dive) {
      const d = P.dive, px = P.x, py = P.y;
      d.t = Math.min(1, d.t + dt / 0.9);
      const e = d.t * d.t * (3 - 2 * d.t);
      const [from, to, u] = d.via ? (e < 0.4 ? [d.a, d.via, e / 0.4] : [d.via, d.b, (e - 0.4) / 0.6]) : [d.a, d.b, e];
      P.x = from[0] + (to[0] - from[0]) * u; P.y = from[1] + (to[1] - from[1]) * u;
      if (window.__portraitPoke) window.__portraitPoke(P.x + S / 2, P.y + S / 2 - scrollY, (P.x - px) * 3, (P.y - py) * 3);
      if (d.t === 1) { P.dive = null; P.vy = 200; if (window.__portraitPoke) window.__portraitPoke(null); }
      return;
    }
    if (P.ride) {
      P.ride.d += dt * 620;
      const [x, y, end] = rideTo(P.ride.d);
      P.x = x - S / 2; P.y = y - S / 2;
      if (end) { P.ride = null; P.form = 'pk'; P.vy = 0; }
      return;
    }
    for (const p of level.plats) if (p.tick) p.tick(now, dt);
    const dir = control ? ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) : 0;
    if (dir) P.face = dir;
    P.vx = dir * SPEED;
    const prevX = P.x;
    P.x += P.vx * dt;
    for (const w of level.walls) {
      if (P.y + S <= w.y1 || P.y >= w.y2) continue;
      if (prevX + S <= w.x && P.x + S > w.x) P.x = w.x - S;
      if (prevX >= w.x && P.x < w.x) P.x = w.x;
    }
    P.x = Math.max(level.bounds.l, Math.min(level.bounds.r - S, P.x));
    if (control && keys.jump && P.ground) { P.vy = -JUMP; P.ground = false; P.squash = -0.7; }
    if (control && keys.down && P.ground && P.on && !P.on.floor) {
      const p = P.on.main || P.on, done = p.ready ? p.ready() : p.need === undefined || p.t >= p.need;
      if (done) { P.dropUntil = now + 260; P.dropFrom = P.on; P.ground = false; keys.down = false; }
    }
    const prevBottom = P.y + S;
    P.vy = Math.min(P.vy + GRAVITY * dt, 560);
    P.y += P.vy * dt;
    const was = P.on; P.on = null; P.ground = false;
    if (P.vy >= 0) {
      for (const p of level.plats) {
        if (!p.solid) continue;
        if (now < P.dropUntil && p === P.dropFrom) continue;
        if (prevBottom <= p.y + 2 && P.y + S >= p.y && P.x + S > p.x && P.x < p.x + p.w) {
          if (P.vy > 450) P.squash = Math.min(1, P.vy / 1100);
          P.y = p.y - S; P.vy = 0; P.ground = true; P.on = p;
          if (p !== was && p.land) p.land(now);
          break;
        }
      }
    }
    if (P.on && P.on.stand) P.on.stand(dt, now);
    P.squash *= Math.pow(0.002, dt);
    if (Math.abs(P.squash) < 0.01) P.squash = 0;

    if (window.__portraitPoke && portrait && control) {
      const r = portrait.getBoundingClientRect(), px = P.x + S / 2, py = P.y + S / 2 - scrollY;
      const inside = px > r.left && px < r.right && py > r.top && py < r.bottom;
      if (inside) window.__portraitPoke(px, py, P.vx * dt * 2.5, P.vy * dt * 2.5);
      else if (P.inFigure) window.__portraitPoke(null);
      P.inFigure = inside;
    }
    const f = level.face;
    if (f && control && P.x + S / 2 > f.x1 && P.x + S / 2 < f.x2 && P.y + S / 2 > f.y1 && P.y + S / 2 < f.y2) {
      P.dive = { t: 0, a: [P.x, P.y], via: f.via ? [f.via[0] - S / 2, f.via[1] - S / 2] : null, b: [f.ex - S / 2, f.ey] }; P.on = null; P.ground = false;
      return;
    }
    const mc = level.mc;
    if (mc && !mc.state.checked && P.x + S / 2 > mc.x && P.x + S / 2 < mc.x + mc.w && P.y > mc.y - 4 && P.y < mc.y + 40) { mc.state.checked = true; }
    const b = level.bucket, cx = P.x + S / 2;
    const inside = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    if (!inside) b.since = 0; else if (!b.since && b.ready()) b.since = now;
    const inBucket = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    P.form = inBucket ? 'file' : 'pk';
    if (inBucket && P.y + S > b.y + b.d + 4) { P.ride = { d: 0 }; P.form = 'dot'; }

    const m = level.mailbox;
    if (!won && P.x + S > m.x - 6 && P.x < m.x + m.w + 6 && P.y + S > m.y - 10 && P.y < m.y + m.h) {
      won = true; P.squash = 0.6; say('found him. say hi', 4000);
      const hi = $('#contact .btn'); hi.classList.remove('wiggle'); void hi.offsetWidth; hi.classList.add('wiggle');
      setTimeout(() => { stop(); P.x = m.x + m.w / 2 - S / 2; P.y = m.y - S; P.vy = 0; }, 1600);
    }
    for (const c of level.checkpoints) if (P.y > c.y + 40) level.respawn = c;
    if (P.y > level.docH + 60) { const c = level.respawn || level.checkpoints[0]; P.x = c.x; P.y = c.y + 30; P.vy = 0; }
  }

  // ---------- cámara: sigue al muñequito pero deja leer ----------
  function follow(dt) {
    const rel = P.y - scrollY;
    let target = null;
    if (rel < H * 0.28) target = P.y - H * 0.28;
    if (rel > H * 0.62) target = P.y - H * 0.62;
    if (target === null) return;
    scrollTo(0, Math.max(0, scrollY + (target - scrollY) * Math.min(1, dt * 7)));
    expected = scrollY;
  }

  // ---------- estados ----------
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = document.documentElement.clientWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rebuild() { level = build(); }
  // Si se entra a un proyecto y se vuelve, el muñequito y lo ya leído siguen donde estaban.
  const SAVE = 'pk-progress';
  function snapshot() {
    if (!level) return null;
    return {
      x: P.x, y: P.y, won,
      reads: [...document.querySelectorAll('#experience .card.big')].map((el, k) => el.classList.contains('read') ? k : -1).filter(k => k >= 0),
      plats: level.plats.map((p, i) => (p.t || p.built || p.solid === false || (p.gate && p.gate.open)) ? { i, t: p.t, b: p.built, s: p.solid, o: !!(p.gate && p.gate.open), c: p.cards && p.cards.map(c => c.t) } : null).filter(Boolean),
    };
  }
  function apply(snap) {
    for (const st of snap.plats) {
      const p = level.plats[st.i];
      if (!p) continue;
      p.t = st.t; p.built = st.b; p.solid = st.s;
      if (st.o && p.open) p.open();
      if (st.c && p.cards) p.cards.forEach((c, k) => { c.t = st.c[k] || 0; });
    }
    P.x = snap.x; P.y = snap.y; P.vy = 0; P.on = null; won = snap.won;
  }
  addEventListener('pagehide', () => { const snap = mode === 'wait' || mode === 'intro' ? null : snapshot(); try { if (snap) sessionStorage.setItem(SAVE, JSON.stringify(snap)); } catch (e) {} });
  function restore() {
    let snap = null;
    try { snap = JSON.parse(sessionStorage.getItem(SAVE) || 'null'); } catch (e) {}
    if (!snap) return;
    const stats = document.querySelectorAll('#experience .card.big');
    snap.reads.forEach(k => { if (stats[k]) stats[k].classList.add('read'); });
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    void document.body.offsetHeight;
    rebuild(); apply(snap); mode = 'idle';
  }
  function start() {
    if (mode === 'play') return;
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    // La clase va antes de medir: mientras se juega, algunas secciones dejan lugar para piezas del nivel.
    document.body.classList.add('playing');
    void document.body.offsetHeight;
    document.documentElement.style.scrollBehavior = 'auto';
    if (mode === 'intro') endIntro();
    // El nivel se mide de nuevo, pero sin perder lo ya hecho.
    const snap = level && snapshot();
    rebuild();
    if (snap) apply(snap);
    // Si el muñequito quedó lejos de lo que estás mirando, cae desde arriba de la pantalla.
    if (P.y < scrollY - 20 || P.y > scrollY + H) { P.x = level.colL + 30; P.y = scrollY + 70; P.vy = 0; P.on = null; }
    mode = 'play'; keys = {}; expected = scrollY;
    document.body.classList.add('playing'); pad.hidden = !touch; hint.classList.remove('on');
  }
  function stop() {
    if (mode !== 'play') return;
    mode = 'idle'; keys = {};
    document.documentElement.style.scrollBehavior = '';
    document.body.classList.remove('playing'); pad.hidden = true;
  }
  function restart() {
    try { sessionStorage.removeItem(SAVE); } catch (e) {}
    document.querySelectorAll('#experience .card, #projects .card').forEach(el => { el.classList.remove('read', 'lit'); delete el.dataset.said; delete el.dataset.used; });
    won = false; labels = []; P.ride = null; P.dive = null; P.form = 'pk'; P.vy = 0; P.on = null;
    document.body.classList.remove('playing'); pad.hidden = true;
    rebuild();
    document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0);
    mode = 'wait'; beginIntro();
  }
  function endIntro() {
    intro = null; P.trail = []; if (window.__portraitPoke) window.__portraitPoke(null);
    const spot = home(); P.x = spot.x; P.y = spot.y; P.vy = 0; mode = 'idle';
    // Apenas aterriza ya se juega: cuenta la misión y muestra con qué se mueve.
    start(); P.squash = 1; missionUntil = performance.now() + 9000;
    if (touch) { pad.classList.remove('pulse'); void pad.offsetWidth; pad.classList.add('pulse'); }
  }
  // Abrir el mail (o apretar una flecha mientras espera) hace la entrada; después solo retoma el juego.
  const activate = () => { if (mode === 'wait') beginIntro(); else if (mode !== 'intro') start(); };

  // La entrada: sale disparado del sobre, cruza el retrato de punta a punta moviendo las rayas y cae sobre
  // el título. El camino es una curva suave que pasa por unos puntos fijos (Catmull-Rom).
  function along(points, t) {
    const n = points.length - 1, i = Math.min(n - 1, Math.floor(t * n)), u = t * n - i;
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
    const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  function runIntro(now) {
    if (now < intro.t0) return;
    const k = Math.min(1, (now - intro.t0) / intro.ms), e = 1 - Math.pow(1 - k, 1.6);
    const [x, y] = along(intro.points, e);
    const vx = x - P.x, vy = y - P.y;
    P.x = x; P.y = y; P.face = vx >= 0 ? 1 : -1;
    P.trail.push([x, y]); if (P.trail.length > 10) P.trail.shift();
    if (window.__portraitPoke && portrait) {
      const r = portrait.getBoundingClientRect(), sx = x + S / 2, sy = y + S / 2 - scrollY;
      if (sx > r.left - 20 && sx < r.right + 20 && sy > r.top - 20 && sy < r.bottom + 20) window.__portraitPoke(sx, sy, vx * 2.2, vy * 2.2);
      else window.__portraitPoke(null);
    }
    if (k === 1) endIntro();
  }
  function beginIntro() {
    const spot = home(), ws = waitSpot();
    hint.classList.remove('on');
    // Sin movimiento, o si ya no está a la vista, aterriza directo.
    if (still || !portrait || ws.y < scrollY || ws.y > scrollY + H) { endIntro(); return; }
    const r = box(portrait), out = [ws.x, ws.y];
    P.x = out[0]; P.y = out[1];
    const points = [out, [out[0] - 20, out[1] - 160], [r.r - r.w * 0.12, r.y + r.h * 0.5], [r.x + r.w * 0.15, r.y + r.h * 0.42], [r.x + r.w * 0.5, r.y + r.h * 0.02], [spot.x, spot.y]];
    intro = { t0: performance.now(), ms: 2100, points };
    mode = 'intro';
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    if (mode === 'intro' && intro) runIntro(now);
    else if (level && mode !== 'wait') { step(dt, now, mode === 'play'); if (mode === 'play') follow(dt); }
    if (P.trail.length && mode !== 'intro') P.trail.shift();
    draw(now);
    // El botón invisible sobre el muñequito: para tocarlo en el celu o llegar con Tab.
    const ws = waitSpot(), showHit = mode === 'idle' || mode === 'wait', big = S * BIG + 24;
    hit.style.display = showHit ? '' : 'none';
    if (mode === 'wait') Object.assign(hit.style, { left: `${ws.x + S / 2 - big / 2}px`, top: `${ws.y + S + 6 - big}px`, width: `${big}px`, height: `${big}px` });
    else if (showHit) Object.assign(hit.style, { left: `${P.x - 10}px`, top: `${P.y - 10}px`, width: '44px', height: '44px' });
    // El globito mientras espera, y la misión sobre el muñequito al aterrizar.
    hint.classList.toggle('on', mode === 'wait' && ws.y > scrollY && ws.y < scrollY + H);
    if (mode === 'wait') {
      // Al costado si entra; en pantallas angostas, arriba del muñequito.
      const side = ws.x + S * BIG + 230 < W;
      hint.classList.toggle('side', side);
      hint.style.left = `${side ? ws.x + S / 2 + S * BIG / 2 + 14 : Math.min(W - 70, ws.x + S / 2)}px`;
      hint.style.top = `${side ? ws.y + S - S * BIG / 2 : ws.y + S - S * BIG - 14}px`;
    }
    if (mode === 'play') exited = false;
    help.classList.toggle('on', !!level && !exited && (mode === 'play' || mode === 'idle'));
    const talk = mode === 'play' && now < missionUntil;
    mission.classList.toggle('on', talk);
    if (talk) { mission.style.left = `${Math.max(170, Math.min(W - 170, P.x + S / 2))}px`; mission.style.top = `${P.y - 16}px`; }
    requestAnimationFrame(frame);
  }

  // ---------- controles ----------
  const KEY = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', ArrowDown: 'down', s: 'down' };
  addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (mode === 'intro') { if (k) event.preventDefault(); return; }
    if (mode === 'play') {
      if (event.key === 'Escape') { stop(); return; }
      if (k) { keys[k] = true; event.preventDefault(); missionUntil = Math.min(missionUntil, performance.now() + 2500); }
      else if (['PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) stop();
      return;
    }
    // Las flechas solo arrancan el juego si no estás usando unas pestañas o escribiendo.
    const el = document.activeElement;
    if ((k === 'left' || k === 'right') && !(el && el.closest('[role="tablist"], input, textarea, select, [contenteditable]'))) { const waiting = mode === 'wait'; activate(); if (!waiting) keys[k] = true; event.preventDefault(); }
  });
  addEventListener('keyup', event => { const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key]; if (k) keys[k] = false; });
  hit.addEventListener('click', activate);
  // Scrollear es la forma de volver a leer: el juego se pausa y el muñequito queda donde estaba.
  addEventListener('wheel', () => stop(), { passive: true });
  addEventListener('touchmove', event => { if (!pad.contains(event.target)) stop(); }, { passive: true });
  addEventListener('scroll', () => { if (mode === 'play' && Math.abs(scrollY - expected) > 40) stop(); }, { passive: true });
  pad.querySelectorAll('[data-k]').forEach(button => {
    const k = button.dataset.k;
    const on = event => { event.preventDefault(); keys[k] = true; missionUntil = Math.min(missionUntil, performance.now() + 2500); button.setPointerCapture?.(event.pointerId); };
    const off = () => { keys[k] = false; };
    button.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, off));
  });
  pad.querySelector('.x').addEventListener('click', () => stop());
  // Salir del todo: se pausa y el panel se esconde hasta que se vuelva a tocar el muñequito.
  help.querySelector('.exit').addEventListener('click', () => { stop(); exited = true; });
  document.querySelectorAll('.restart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); restart(); }));
  addEventListener('resize', () => { resize(); if (level) { const snap = snapshot(); rebuild(); apply(snap); } });

  // Para probarlo desde afuera.
  window.__pk = { level: () => level, activate, state: () => ({ dive: !!P.dive, mode, x: Math.round(P.x), y: Math.round(P.y), form: P.form, ride: !!P.ride, won, on: P.on && (P.on.kind || (P.on.floor ? 'floor' : 'ledge')), scrollY }), start, stop, keys: k => Object.assign(keys, k), place: (x, y) => { P.x = x; P.y = y; P.vy = 0; }, sim: ms => { let t = performance.now(); for (let k = 0; k < ms / 16; k++) { t += 16; step(0.016, t, mode === 'play'); } return window.__pk.state(); } };

  resize();
  if (document.readyState === 'complete') restore(); else addEventListener('load', restore);
  last = performance.now(); requestAnimationFrame(frame);
})();
