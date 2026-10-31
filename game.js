// El portfolio como nivel. El muñequito espera debajo del texto de la portada; al tocarlo da una vuelta por el
// retrato y cae sobre el título. Desde ahí se salta a la cara de Luca: la zambullida lo deja en un DAG que recorre
// la experiencia, los productos y "how I think" (cada tarjeta es una tarea que corre mientras se lee, los
// desplegables se abren solos, y una compuerta all_success cierra cada sección). El DAG desemboca en el bucket de S3, Airflow lo carga a Snowflake,
// el warehouse se prende, dbt construye stage, integration y consumption, y Monte Carlo lo revisa a la salida.
// Al final el dato entra como fila en una tabla, la tabla se vuelve reporte y del reporte sale el agente; ahí el
// juego se apaga solo y la página queda marcada con lo leído. Se mueve con las flechas o con los controles del
// celu. Scrollear deja mirar la página sin cortar el juego; Esc lo pausa.
(() => {
  const $ = s => document.querySelector(s);
  const hero = $('.hero'), portrait = $('#portrait');
  if (!hero) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACCENT = '#5eead4', MUTED = '#94a3b8', LINE = 'rgba(94,234,212,.55)', FAINT = 'rgba(148,163,184,.35)', INK = '#0b1120';
  const GRAVITY = 1900, JUMP = 720, SPEED = 290, S = 24, MONO = '11px "JetBrains Mono", monospace';

  // ---------- piezas en la página ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'play-layer'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const hit = document.createElement('button');
  hit.type = 'button'; hit.className = 'pk-hit'; hit.setAttribute('aria-label', 'Start the journey: play the portfolio as a game');
  const hint = document.createElement('span');
  hint.className = 'pk-hint'; hint.textContent = touch ? "hi, i'm Little Bit. tap me" : "hi, i'm Little Bit. click me"; hint.classList.add('side');
  // La misión, con las teclas para moverse, en un globo sobre el muñequito.
  const mission = document.createElement('div');
  mission.className = 'pk-say'; mission.setAttribute('role', 'status');
  mission.innerHTML = `<p>I'm looking for the contacts table. Have you seen it?</p>${touch ? '<p class="go">use the buttons below ↓</p>' : '<p class="go"><kbd>←</kbd><kbd>→</kbd> move <kbd>↑</kbd> jump</p>'}`;
  // El panel fijo con los controles y el botón para reiniciar; aparece cuando el juego ya empezó.
  const help = document.createElement('div');
  help.className = 'play-help';
  help.innerHTML = '<span class="goal">goal: get me to the contacts table</span><span><kbd>←</kbd><kbd>→</kbd> move</span><span><kbd>↑</kbd> jump</span><span><kbd>↓</kbd> down</span><button type="button" class="restart">↺ restart</button><button type="button" class="exit">✕ exit</button>';
  const pad = document.createElement('div');
  pad.className = 'pad'; pad.hidden = true;
  pad.innerHTML = '<button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="right" aria-label="Right">▶</button><button type="button" data-k="down" class="down" aria-label="Go down">▼</button><button type="button" data-k="jump" class="jump" aria-label="Jump">▲</button><button type="button" class="x" aria-label="Stop playing">✕</button><button type="button" class="restart re" aria-label="Restart the game">↺</button>';
  document.body.append(canvas, hit, hint, mission, help, pad);

  let camFree = false, endAt = 0, endSaid = false, fade = 1, mode = 'wait', missionUntil = 0, lockFrom = 0, lockUntil = 0, swapUntil = 0, swapping = null, W = 0, H = 0, level = null, keys = {}, last = 0, labels = [], expected = -1, intro = null, won = false;
  const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, on: null, face: 1, squash: 0, form: 'pk', ride: null, dropUntil: 0, trail: [] };

  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const home = () => { const b = box($('.hero h1')); return { x: b.r - S - 6, y: b.y + 4 - S }; };
  // Donde espera antes de empezar: debajo del texto de la portada, más grande y saltando. Primero se lee y
  // después invita; al tocarlo salta al título, donde arranca el juego.
  const BIG = 1.5;
  const waitSpot = () => { const b = box($('.hero .tools')); return { x: b.x + 10, y: b.b + 34 }; };
  // Un cartelito que flota sobre el muñequito o sobre una pieza.
  // Los diálogos siempre salen justo arriba del muñequito y lo siguen mientras se mueve.
  // De a un diálogo por vez: el nuevo aparece enseguida, en su momento, y el anterior se desvanece debajo.
  const READ = 1500, LINGER = 7000, FADE = 320, POP = 320;
  let lastSaid = null;
  const say = (text, ms = 2000) => {
    const now = performance.now(), until = now + Math.max(ms, LINGER), shown = labels[labels.length - 1];
    if (shown && now < shown.until && shown.text === text) { shown.until = Math.max(shown.until, until); return; }
    labels = labels.filter(l => now < l.until).map(l => ({ ...l, until: Math.min(l.until, now + FADE) }));
    labels.push({ text, from: now, until }); lastSaid = text;
  };
  // Lo que el muñequito va contando del recorrido: cada frase, una sola vez por partida.
  const said = new Set();
  // Lo que le pide algo al jugador queda en pantalla hasta que toque una tecla: así nadie se pierde la pista.
  const HOLD = Infinity, letGo = () => { const now = performance.now(); labels.forEach(l => { if (l.until === HOLD) l.until = Math.max(now, l.from + READ); }); };
  // Cada frase del recorrido frena al muñequito lo justo para leerla: así nunca llega antes que lo que dice.
  // Mientras tanto, un anillo alrededor suyo muestra cuánto falta para que vuelva a moverse.
  const hold = ms => { lockFrom = performance.now(); lockUntil = Math.max(lockUntil, lockFrom + ms); };
  const once = (text, ms = 3600) => { if (said.has(text)) return; said.add(text); say(text, ms); hold(500 + text.length * 35); };

  // ---------- el nivel ----------
  function build() {
    W = document.documentElement.clientWidth;
    const plats = [], things = [], checkpoints = [], walls = [];
    let level_mc = null, block = null;
    const h = box(hero), colL = Math.max(16, h.x), colR = Math.min(W - 16, h.r);
    const ledge = (x, y, w, extra = {}) => { const p = { x, y, w, solid: true, ...extra }; plats.push(p); return p; };
    // Un piso de lado a lado con huecos: por ahí se baja.
    const floor = (y, gaps = [], extra = {}) => {
      let x = -60;
      for (const [gx, gw] of [...gaps, [W + 60, 0]]) { if (gx > x) ledge(x, y, gx - x, { floor: true, ...extra }); x = gx + gw; }
      gaps.forEach(([gx, gw]) => things.push({ draw: now => drawGap(gx + gw / 2, y, now) }));
    };
    // El DAG: las tarjetas son tareas y el muñequito viaja por las aristas como un dato. Las aristas van por
    // el margen izquierdo (el bus) y por el hueco de arriba de cada fila de tarjetas, nunca sobre el texto.
    // Al llegar a una tarea, corre (queued → running → ✓) mientras se lee, y hasta que no termina no se sale.
    // Al final de cada sección, una compuerta con la regla de Airflow all_success: pasa recién cuando corrieron todas.
    const nodes = [];
    const node = (x, y, extra = {}) => { const n = { x, y, links: [], ...extra }; nodes.push(n); return n; };
    const link = (a, b) => { a.links.push(b); b.links.push(a); };
    const mx = Math.max(S / 2 + 4, colL - 26);
    // El bus de la primera fila de cada sección es su parada: ahí se frena y la cámara muestra el título con esa fila.
    const dag = (els, from, need) => {
      const section = els[0].closest('section'), tasks = [], byRow = new Map();
      let first = null;
      els.forEach(el => { const c = box(el), key = Math.round(c.y); byRow.set(key, [...(byRow.get(key) || []), { el, c }]); });
      let bus = from;
      // Lo que la cámara muestra centrado mientras se anda por cada fila: la primera va con el título de la sección.
      let frame = null;
      [...byRow.values()].forEach((row, r) => {
        const gy = row[0].c.y - 16;
        frame = [r ? gy - 20 : box(section.firstElementChild).y, Math.max(...row.map(q => q.c.b))];
        const b = node(mx, gy, { frame, bus: true }); if (bus) link(bus, b); bus = b; first = first || b;
        let prev = b;
        row.sort((u, v) => u.c.x - v.c.x).forEach(({ el, c }) => {
          const t = node(c.x + c.w / 2, gy, { task: el, need, t: 0, done: el.classList.contains('read'), frame });
          link(prev, t); prev = t; tasks.push(t);
        });
      });
      const bottom = Math.max(...els.map(el => box(el).b));
      const gate = node(mx, bottom + 26, { gate: tasks, frame });
      link(bus, gate);
      return { first, gate };
    };
    // Portada: el título es el piso, sin línea encima, y no hay ningún hueco. La única salida es la cara de
    // Luca: al entrar el muñequito se zambulle, cruza la cabeza (las rayas se ondulan) y sale por abajo.
    const h1 = box($('.hero h1')), fig = portrait ? box(portrait) : null;
    let face = null;
    if (fig && fig.b > h1.y) {
      // Con el retrato al costado, el título llega hasta la cara: caminando a la izquierda se entra de frente.
      // Los hombros cierran por debajo, así que no hay otra forma de bajar.
      const edge = fig.r - fig.w * 0.25, title = ledge(edge, h1.y + 4, Math.min(W, colR + 44) - edge, { floor: true });
      // Caminando se llega al borde de la silueta y ahí se frena: para entrar a la cara hay que saltar.
      walls.push({ x: edge, y1: h1.y + 4 - 30, y2: h1.y + 4 });
      // A mitad de camino, un NULL en el piso: el primer salto, y tiempo para que cada frase se lea en su momento.
      const cw = 46, ch = 26, cx = (edge + home().x) / 2 - cw / 2, cy = h1.y + 4 - ch;
      block = { x: cx, w: cw };
      walls.push({ x: cx, y1: cy, y2: h1.y + 4 }, { x: cx + cw, y1: cy, y2: h1.y + 4 });
      ledge(cx, cy, cw, { crate: true, floor: true });
      things.push({ draw: () => {
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 5); ctx.stroke();
        text('NULL', cx + cw / 2, cy + 17, ACCENT, 'center');
      } });
      things.push({ draw: now => { if (P.on === title && P.x <= edge + 6) drawJump(edge + 12, h1.y - 44, now); } });
    } else {
      // En el celu el retrato queda arriba del título: se salta desde el título hacia la cara.
      ledge(h1.x, h1.y + 4, h1.w, { floor: true });
      floor(h.b - 8);
    }
    // La cara: entrar ahí es la zambullida, que termina en la entrada del DAG.
    if (fig) {
      face = fig.b > h1.y
        // Con el retrato al costado, todo lo que quede a la izquierda del título entra por la cara, salte por donde salte.
        ? { jump: true, x1: -60, x2: fig.r - fig.w * 0.25 + 14, y1: h.y - 200, y2: fig.y + fig.h * 0.8, via: [fig.x + fig.w * 0.5, fig.y + fig.h * 0.38] }
        : { x1: fig.x + fig.w * 0.3, x2: fig.x + fig.w * 0.7, y1: fig.y + fig.h * 0.08, y2: fig.y + fig.h * 0.74 };
    }

    // El DAG arranca donde termina la zambullida, cruza la experiencia y los productos y desemboca en el bucket.
    const work = dag([...document.querySelectorAll('#experience .card.big')], null, 2.2);
    const built = dag([...document.querySelectorAll('#projects .card')], work.gate, 1.6);
    // "how I think": cada desplegable es una tarea sobre el bus. Al llegar se abre y queda abierto el tiempo que
    // se quiera; se cierra recién cuando el muñequito sigue.
    const folds = [...document.querySelectorAll(FOLDS)], foldTasks = [];
    let prev = built.gate;
    folds.forEach(el => {
      const s = box(el.querySelector('summary'));
      const t = node(mx, s.y + s.h / 2, { task: el, fold: true, need: 1, t: 0, done: el.classList.contains('read') });
      link(prev, t); prev = t; foldTasks.push(t);
    });
    const g2 = node(mx, box(folds[folds.length - 1]).b + 26, { gate: foldTasks });
    link(prev, g2);
    const entry = work.first;
    const tasks = nodes.filter(n => n.task);
    things.push({ draw: now => drawDag(nodes, now) });
    const reads = { get done() { return tasks.filter(n => n.done).length; }, total: tasks.length };

    // Al final de "how I think" está el bucket de S3: el DAG desemboca ahí.
    const pr = box($('#more'));
    const fy = pr.b - 6, bw = 84, bx = Math.max(colL + 30, 24);
    floor(fy, [[bx, bw]]);
    // Airflow corre 3 segundos después de que el archivo cae al bucket (si los números ya se leyeron).
    const RUN = 3000, ready = () => reads.done >= reads.total;
    const bucket = { x: bx, y: fy, w: bw, d: 52, since: 0, ready };
    // Del bucket no se sale por los costados: la única salida es la compuerta de abajo.
    walls.push({ x: bx, y1: fy, y2: fy + 52 }, { x: bx + bw, y1: fy, y2: fy + 52 });
    const gateOpen = now => ready() && bucket.since && now - bucket.since >= RUN;
    const gate = ledge(bx + 4, fy + 48, bw - 8, { tick: now => { gate.solid = !gateOpen(now); }, land: () => { if (!ready()) say('↑ we skipped something', 2000); } });
    things.push({ draw: now => drawBucket(bucket, gateOpen(now), now, RUN, reads) });
    const ly = Math.max(fy - 44, g2.y + 18), low = node(mx, ly), exit = node(bx + bw / 2, ly, { exit: true });
    link(g2, low); link(low, exit);

    // La tarea de Airflow carga el archivo hasta Snowflake (extract y load). La caja de Snowflake queda a la
    // izquierda del contacto, que tiene lugar libre, con su piso justo arriba de los botones.
    const bounds = { l: Math.max(0, colL - 44), r: Math.min(W, colR + 44) };
    const ctBtn = box($('#contact .btn'));
    const wx = colL + 14, wy = ctBtn.b - 60, top = wy - 240;
    const sfW = Math.min(240, W - wx - 16), boxL = wx - 14, boxR = boxL + sfW, boxB = wy + 28;
    const hatch = { x: boxR - 74, w: 58 }, hx = hatch.x + hatch.w / 2;
    const path = [[bx + bw / 2, fy + 56], [bx + bw / 2, top], [hx, top], [hx, top + 30]];
    const pipe = { path, mouth: [bx + bw / 2, fy + 56] };
    things.push({ draw: now => drawPipe(pipe, now) });

    // Snowflake es una caja cerrada y baja sola, en orden: primero se prende el warehouse (sin cómputo no corre
    // nada), después dbt construye stage, integration (donde vive el fact) y consumption. Cada capa es un piso que se abre recién cuando quedó
    // construida, así que no se saltea ninguna. Al fondo, la salida pasa por Monte Carlo.
    walls.push({ x: boxL, y1: top - 18, y2: boxB }, { x: boxR, y1: top - 18, y2: boxB });
    const LAYERS = [['warehouse', 1.5], ['stage · stg_orders', 0.7], ['integration · fct_orders', 0.7], ['consumption · rpt_orders', 0.7]];
    LAYERS.forEach(([name, need], k) => {
      const m = ledge(boxL + 2, top + 50 + k * 50, boxR - boxL - 4, { kind: 'model', name, need, t: 0, built: false });
      if (k === 0) m.label = () => m.built ? 'warehouse M · running' : `warehouse ${['XS', 'S', 'M'][Math.min(2, Math.floor(m.t / m.need * 3))]}`;
      m.stand = (dt, now) => {
        if (m.built) return;
        // Una capa no se termina mientras el muñequito está hablando: cada frase de Snowflake llega a leerse.
        if (k === 0) once('brr, Snowflake runs cold');
        // dbt ayuda a moverse más rápido, literal: sus capas salen enseguida y de acá en más camina más rápido.
        if (k === 1) P.fast = true;
        if (now >= lockUntil) m.t += dt;
        if (m.t >= m.need) { m.built = true; m.solid = false; }
      };
    });
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

    // Contacto: la meta es la tabla. El dato que recorrió todo el pipeline cae como su fila nueva, y encima de la
    // tabla el muñequito queda como el agente que la consulta. Va al costado de los botones; si no hay lugar a
    // ninguno de los dos lados (en el celu), debajo de ellos y centrada.
    const btn = box($('#contact .btn')), lastBtn = box($('#contact .cta .btn:last-child')), tw = 196, th = 72;
    // Con lugar, la tabla queda bien separada de los botones y en el hueco un cartel indica para dónde seguir.
    const far = Math.min(lastBtn.r + 210, bounds.r - tw - 10);
    const tx = far > lastBtn.r + 40 ? far : lastBtn.r + 40 + tw < W - 16 ? lastBtn.r + 40 : btn.x - 40 - tw > 8 ? btn.x - 40 - tw : null;
    const table = tx === null ? { x: (W - tw) / 2, y: btn.b + 40, w: tw, h: th, fill: 0 } : { x: tx, y: btn.b - th, w: tw, h: th, fill: 0 };
    things.push({ draw: now => drawTable(table, now) });
    if (tx === far && far - lastBtn.r > 130) {
      // Un cartel de ruta: la tabla clavada en un palo, con la punta hacia donde hay que ir.
      const sw = 124, tip = 13, sh = 26, sx = lastBtn.r + (far - lastBtn.r - sw - tip) / 2, ground = table.y + th, sy = ground - 62, mid = sx + sw / 2;
      things.push({ draw: () => {
        ctx.strokeStyle = ACCENT; ctx.lineCap = 'round'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(mid, sy + sh); ctx.lineTo(mid, ground); ctx.moveTo(mid - 7, ground); ctx.lineTo(mid + 7, ground); ctx.stroke();
        ctx.shadowColor = 'rgba(94,234,212,.55)'; ctx.shadowBlur = 10; ctx.fillStyle = INK; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(sx + 5, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw + tip, sy + sh / 2); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + 5, sy + sh); ctx.arcTo(sx, sy + sh, sx, sy + sh - 5, 5); ctx.lineTo(sx, sy + 5); ctx.arcTo(sx, sy, sx + 5, sy, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.lineJoin = 'miter';
        text('contacts table', mid + 2, sy + 17, ACCENT, 'center');
      } });
    }
    ledge(table.x, table.y, tw, { hidden: true });
    floor(table.y + th, []);

    // Si se cae fuera del nivel, reaparece al comienzo de la última sección que pasó.
    for (const id of ['experience', 'projects', 'contact']) checkpoints.push({ y: box(document.getElementById(id)).y, x: colL + 30 });
    return { plats, things, walls, bounds, face, block, nodes, entry, mc: level_mc, pipe, bucket, table, checkpoints, colL, colR, docH: document.documentElement.scrollHeight };
  }

  // ---------- dibujo ----------
  function text(t, x, y, color = MUTED, align = 'left', font = MONO) {
    ctx.font = font; ctx.textAlign = align;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(t, x, y);
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function dashedBox(x, y, w, h, r) { ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(94,234,212,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); ctx.setLineDash([]); }
  // Las aristas como la pipeline: las que salen del nodo donde está el muñequito corren animadas; el resto, quietas.
  // Las tareas muestran su estado como en Airflow y las compuertas, cuántas de arriba ya corrieron.
  const gateOpen = n => n.gate.every(t => t.done);
  const dirOf = (n, m) => Math.abs(m.x - n.x) > Math.abs(m.y - n.y) ? (m.x < n.x ? 'left' : 'right') : (m.y < n.y ? 'up' : 'down');
  function drawDag(nodes, now) {
    const here = P.rail && !P.rail.to ? P.rail.at : null;
    ctx.lineCap = 'round';
    nodes.forEach((n, i) => n.links.forEach(m => {
      if (nodes.indexOf(m) < i) return;
      const live = here && (here === n || here === m), shut = (n.gate && m.y > n.y && !gateOpen(n)) || (m.gate && n.y > m.y && !gateOpen(m));
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = 'rgba(94,234,212,.08)'; ctx.lineWidth = 12; ctx.stroke();
      if (live && !shut) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -now / 30; }
      else { ctx.strokeStyle = shut ? 'rgba(148,163,184,.25)' : 'rgba(94,234,212,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash(shut ? [2, 6] : []); }
      ctx.stroke(); ctx.setLineDash([]);
    }));
    for (const n of nodes) {
      if (n.task) {
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = n.done ? ACCENT : INK; ctx.strokeStyle = n.done ? ACCENT : MUTED; ctx.fill(); ctx.stroke();
        if (n.done) { ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(n.x - 3.5, n.y); ctx.lineTo(n.x - 1, n.y + 3); ctx.lineTo(n.x + 4, n.y - 3); ctx.stroke(); }
        else if (here && here.gate && here.gate.includes(n)) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.globalAlpha = 0.45 + Math.sin(now / 220) * 0.45; ctx.beginPath(); ctx.arc(n.x, n.y, 15, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        else if (n.t && now >= lockUntil) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, n.t / n.need)); ctx.stroke(); }
      } else if (n.gate) {
        const open = gateOpen(n), done = n.gate.filter(t => t.done).length, k = n.nudge && now - n.nudge < 400 ? Math.sin((now - n.nudge) / 30) * 3 : 0;
        ctx.fillStyle = open ? ACCENT : INK; ctx.strokeStyle = open ? ACCENT : MUTED; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(n.x, n.y - 8); ctx.lineTo(n.x + 8, n.y); ctx.lineTo(n.x, n.y + 8); ctx.lineTo(n.x - 8, n.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        text(`all_success ${done}/${n.gate.length}`, n.x + 16 + k, n.y + 4, open ? ACCENT : MUTED);
        // Frenado en la compuerta cerrada: dice en claro qué falta (y abajo, las tareas pendientes titilan).
        if (!open && here === n) { const left = n.gate.length - done; text(`${left} ${left === 1 ? 'card' : 'cards'} to read first ↑`, n.x + 16 + k, n.y + 22, ACCENT); }
      } else if (n.links.length > 2) { ctx.fillStyle = 'rgba(94,234,212,.6)'; ctx.beginPath(); ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // Por dónde se puede seguir desde el nodo donde está parado.
    if (here && !(here.task && !here.done)) here.links.forEach(m => {
      if (here.gate && m.y > here.y && !gateOpen(here)) return;
      const d = dirOf(here, m), k = Math.sin(now / 250) * 3, off = { left: [-24 - k, 4], right: [24 + k, 4], up: [0, -18 - k], down: [0, 26 + k] }[d];
      text({ left: '←', right: '→', up: '↑', down: '↓' }[d], here.x + off[0], here.y + off[1], ACCENT, 'center', '14px "JetBrains Mono", monospace');
    });
  }
  function drawJump(x, y, now) { const k = Math.sin(now / 250) * 3; text('↑', x, y - k, ACCENT, 'center', '14px "JetBrains Mono", monospace'); }
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
  // La meta cuenta el final en tres tiempos: el dato entra como la fila nueva de la tabla, las filas se vuelven un
  // reporte (barras que crecen) y del reporte sale el agente, el muñequito con su antenita.
  const ease = (e, from, len) => Math.max(0, Math.min(1, (e - from) / len));
  function drawTable(t, now) {
    const e = endAt ? (now - endAt) / 1000 : 0, fill = ease(e, 0, 0.9), morph = ease(e, 2.8, 1.2), rise = ease(e, 4.2, 0.9);
    const row = t.h / 4;
    ctx.strokeStyle = 'rgba(94,234,212,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, t.h, 6); ctx.stroke();
    text(morph > 0.5 ? 'report' : 'contacts', t.x, t.y - 8, MUTED);
    ctx.globalAlpha = 1 - morph;
    ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(t.x, t.y + row * k); ctx.lineTo(t.x + t.w, t.y + row * k); ctx.stroke(); }
    text('id   from        status', t.x + 8, t.y + row - 5, MUTED);
    ctx.fillStyle = 'rgba(148,163,184,.18)';
    for (const k of [1, 2]) { ctx.fillRect(t.x + 8, t.y + row * k + 7, 14, 4); ctx.fillRect(t.x + 34, t.y + row * k + 7, 60, 4); ctx.fillRect(t.x + 122, t.y + row * k + 7, 30, 4); }
    const ly = t.y + row * 3;
    if (fill > 0) {
      ctx.globalAlpha = fill * (1 - morph); ctx.fillStyle = 'rgba(94,234,212,.12)'; ctx.fillRect(t.x + 1, ly + 1, t.w - 2, row - 2);
      text('3    little bit  ✓ loaded', t.x + 8, ly + row - 5, ACCENT);
    } else {
      // Después de Monte Carlo la fila vacía titila y una flecha lleva hasta ella: ese es el destino.
      const ready = level.mc.state.checked;
      ctx.globalAlpha = ready ? 0.6 + Math.sin(now / 220) * 0.4 : 1;
      ctx.setLineDash([3, 5]); ctx.strokeStyle = ready ? ACCENT : MUTED; ctx.beginPath(); ctx.roundRect(t.x + 6, ly + 4, t.w - 12, row - 8, 3); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (ready) { const dir = t.x + t.w / 2 > P.x ? 1 : -1, k = Math.sin(now / 200) * 4; text(dir > 0 ? '→' : '←', P.x + S / 2 + dir * (S + 6 + k), P.y + 18, ACCENT, 'center', '18px "JetBrains Mono", monospace'); }
    }
    ctx.globalAlpha = 1;
    if (morph > 0) {
      const bars = [0.45, 0.7, 0.55, 0.95], bw = (t.w - 40) / bars.length;
      bars.forEach((v, k) => { const bh = (t.h - 18) * v * morph; ctx.fillStyle = k === bars.length - 1 ? ACCENT : 'rgba(94,234,212,.45)'; ctx.fillRect(t.x + 12 + k * (bw + 6), t.y + t.h - 8 - bh, bw, bh); });
    }
    if (rise > 0) { ctx.globalAlpha = rise; drawPk(t.x + t.w / 2 - S / 2, t.y - S - 6 * (1 - rise), now); ctx.globalAlpha = 1; }
  }
  function drawPlat(p, now) {
    if (p.hidden || p.crate) return;
    if (p.kind === 'model') {
      if (p.built) { text(`✓ ${p.label ? p.label() : p.name}`, p.x + 12, p.y + 18, ACCENT); return; }
      ctx.fillStyle = 'rgba(148,163,184,.1)'; ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, p.w - 12, 6, 3); ctx.fill(); ctx.stroke();
      if (p.t) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, (p.w - 12) * Math.min(1, p.t / p.need), 6, 3); ctx.fill(); }
      text(p.label ? p.label() : p.name, p.x + 12, p.y + 20, MUTED);
      if (p.label && !p.built) snowflake(p.x + p.w - 18, p.y + 16, 5, p.t ? ACCENT : MUTED);
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
    if (won) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + w / 2, py); ctx.lineTo(px + w / 2, py - 8); ctx.stroke(); ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(px + w / 2, py - 10, 3, 0, Math.PI * 2); ctx.fill(); }
  }

  function draw(now) {
    const top = scrollY;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -top);
    const seen = (y, h = 0) => y + h > top - 120 && y < top + H + 120;
    if (mode === 'play' && level) {
      // Con un desplegable abierto, lo de abajo está medido con él cerrado: no se dibuja encima de su contenido.
      // En el cambio entre dos desplegables manda el de más arriba, porque los dos se están moviendo.
      const unfolded = P.rail ? [P.rail.at, P.rail.to].filter(n => n && n.fold && (n.task.open || now < swapUntil)).map(n => box(n.task.querySelector('summary')).b) : [];
      ctx.save();
      if (unfolded.length) { ctx.beginPath(); ctx.rect(0, top - 40, W, Math.min(...unfolded) + 40 - top); ctx.clip(); }
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
      ctx.restore();
    } else if (level && P.on && !P.on.floor && !P.on.hidden && !P.on.crate) drawPlat(P.on, now);
    // La estela del muñequito cuando atraviesa el retrato.
    P.trail.forEach((t, k) => { ctx.globalAlpha = (k / P.trail.length) * 0.35; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(t[0] + 4, t[1] + 4, S - 8, S - 8, 5); ctx.fill(); });
    ctx.globalAlpha = 1;
    // Esperando, el muñequito está sobre el título, listo para arrancar. Al terminar queda solo el de la nota.
    if (mode === 'wait') {
      const ws = waitSpot(), hop = still ? 0 : (now % 1600 < 520 ? Math.sin((now % 1600) / 520 * Math.PI) * 12 : 0);
      P.face = -1;
      ctx.save(); ctx.translate(ws.x + S / 2, ws.y + S - hop); ctx.scale(BIG, BIG); ctx.translate(-(ws.x + S / 2), -(ws.y + S));
      drawPk(ws.x, ws.y, now); ctx.restore();
    } else if (mode !== 'done' && !endAt && seen(P.y)) {
      if (P.on && P.on.hidden && mode === 'play') {
        const g2 = ctx.createLinearGradient(P.x - 30, 0, P.x + S + 30, 0);
        g2.addColorStop(0, 'rgba(94,234,212,0)'); g2.addColorStop(0.5, 'rgba(94,234,212,.75)'); g2.addColorStop(1, 'rgba(94,234,212,0)');
        ctx.strokeStyle = g2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x - 30, P.on.y); ctx.lineTo(P.x + S + 30, P.on.y); ctx.stroke();
      }
      drawPk(P.x, P.y, now);
    }
    labels = labels.filter(l => now < l.until);
    // Los diálogos: globos apilados sobre el muñequito, con su entrada, sin salirse de la pantalla ni tapar el menú.
    ctx.font = '500 15px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
    if (mode === 'play' && now < lockUntil) {
      const k = Math.max(0, Math.min(1, (now - lockFrom) / (lockUntil - lockFrom)));
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.beginPath(); ctx.arc(P.x + S / 2, P.y + S / 2, S * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(P.x + S / 2, P.y + S / 2, S * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    }
    labels.forEach((l, k) => {
      const a = Math.min(1, (l.until - now) / FADE), rise = Math.max(0, Math.min(1, (now - l.from) / POP)), pop = 1 - (1 - rise) ** 3, half = ctx.measureText(l.text).width / 2 + 16;
      const cx = Math.max(half + 8, Math.min(W - half - 8, P.x + S / 2)), up = 0;
      const y = Math.max(top + 92 + up, P.y - 40 - up) + (1 - pop) * 6;
      ctx.save(); ctx.globalAlpha = a * pop; ctx.translate(cx, y); ctx.scale(0.97 + pop * 0.03, 0.97 + pop * 0.03);
      ctx.fillStyle = 'rgba(11,17,32,.96)'; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.shadowColor = 'rgba(94,234,212,.35)'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(-half, -18, half * 2, 36, 12); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
      ctx.fillStyle = '#f1f5f9'; ctx.textAlign = 'center'; ctx.fillText(l.text, 0, 1);
      ctx.restore();
    });
    ctx.textBaseline = 'alphabetic';
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
  // La zambullida arranca con la velocidad que traía el muñequito (caminando o en pleno salto).
  const DIVE_MAX = 640;
  const divePath = (via, b) => { const vx = P.vx || P.face * SPEED, vy = P.vy; return { via, b, vx, vy, speed: Math.min(DIVE_MAX, Math.hypot(vx, vy)), age: 0 }; };
  // Por los rieles del DAG se va de nodo en nodo, eligiendo la arista con las flechas. En una esquina o en una
  // compuerta abierta sigue de largo; en una tarea se queda hasta que corre.
  const RAIL = 560;
  const onNode = n => { P.x = n.x - S / 2; P.y = n.y - S / 2; };
  function railStep(dt, control, now) {
    const r = P.rail;
    // Primero se centra lo que hay que leer: hasta que la cámara llega, no arranca el viaje ni corre la tarea.
    // La tecla igual se toma: el muñequito elige la arista y sale cuando la cámara está lista.
    const settled = n => { if (now < swapUntil) return true; const t = frameTarget(n); return t === null || Math.abs(scrollY - t) <= 6; };
    if (r.to) {
      if (r.d === 0 && !settled(r.to)) return;
      r.d += RAIL * dt;
      const len = Math.hypot(r.to.x - r.at.x, r.to.y - r.at.y), u = Math.min(1, r.d / (len || 1));
      P.x = r.at.x + (r.to.x - r.at.x) * u - S / 2; P.y = r.at.y + (r.to.y - r.at.y) * u - S / 2; P.form = 'dot';
      if (u < 1) return;
      const from = r.at, n = r.at = r.to; r.to = null; r.d = 0; onNode(n); P.form = 'pk';
      if (n.exit) { P.rail = null; P.vy = 120; return; }
      // Si la tarea trae frase, un solo anillo cubre las dos cosas: la frase y la lectura.
      if (n.task && !n.fold && n.task.dataset.say) { once(n.task.dataset.say); if (!n.done) hold(n.need * 1000 + 500); }
      if (n.bus && from.gate && from.y < n.y) once('i ❤️ dbt. raw in, clean out');
      if (n.task && !n.done) { r.fresh = !!n.fold; return; }
      if (n.gate && from.y < n.y && !gateOpen(n)) gateHint(n);
      const ahead = n.links.filter(m => m !== from);
      if (n.links.length === 2 && !n.task && !n.bus && (!n.gate || (from.y < n.y && gateOpen(n)))) r.to = ahead[0];
      else r.fresh = true;
      return;
    }
    const n = r.at;
    if (n.fold && !n.task.open) n.task.open = true;
    if (n.fold && !n.done) { n.done = true; n.task.classList.add('read'); once(n.task.dataset.say || "ooh, reading time. ↓ when you're ready", HOLD); }
    if (n.task && !n.done) {
      if (!settled(n)) return;
      n.task.classList.add('lit');
      if (now < lockUntil) { n.t = n.need; return; }
      n.t += dt;
      if (n.t >= n.need) { n.done = true; n.task.classList.add('read'); n.task.classList.remove('lit'); }
      return;
    }
    if (!control) return;
    // Al frenar en un nodo hay que soltar la tecla para seguir: un toque nunca cruza dos tramos.
    if (r.fresh) { if (keys.left || keys.right || keys.jump || keys.down) return; r.fresh = false; }
    const want = keys.left ? 'left' : keys.right ? 'right' : keys.jump ? 'up' : keys.down ? 'down' : null;
    const m = want && n.links.find(q => dirOf(n, q) === want);
    if (!m) return;
    if (n.gate && m.y > n.y && !gateOpen(n)) { n.nudge = now; gateHint(n); return; }
    if (n.task) n.task.classList.remove('lit');
    // Entre desplegables es un acordeón: uno se pliega mientras el otro se abre, en los dos sentidos, sin que la
    // página quede nunca con los dos cerrados. La cámara espera quieta: si persiguiera las alturas a mitad de la
    // animación, saltaría.
    const swap = n.fold && m.fold;
    if (swap) { swapUntil = now + 420; n.task.classList.add('swap'); }
    if (n.fold) n.task.open = false;
    if (m.fold) m.task.open = true;
    // El que se abre no tiene de dónde transicionar, así que su altura se anima a mano, del cero a la que le toca.
    if (swap) {
      const full = getComputedStyle(m.task, '::details-content').height;
      m.task.classList.add('swap');
      // Si se vuelve antes de que termine, la animación nueva reemplaza a la anterior.
      if (swapping) swapping.cancel();
      swapping = m.task.animate({ height: ['0px', full] }, { duration: 420, easing: 'ease', pseudoElement: '::details-content' });
      swapping.onfinish = () => { swapping = null; [n, m].forEach(f => f.task.classList.remove('swap')); };
    }
    r.to = m; r.d = 0; P.face = m.x < n.x ? -1 : m.x > n.x ? 1 : P.face;
  }
  // Si pasa un rato sin que el jugador haga nada, el muñequito le pide lo que falta. Nunca interrumpe lo que corre
  // solo, ni a quien scrollea para leer, y en un desplegable abierto espera más.
  const IDLE = 8000, READING = 20000, ARROW = { left: '←', right: '→', up: '↑', down: '↓' };
  const toward = x => (x > P.x ? '→' : '←');
  // Por dónde seguir en el DAG: hacia la tarea pendiente más cercana o, si no queda ninguna, hacia la salida.
  function nextOnRail(from) {
    const seen = new Set([from]), queue = [[from, null]];
    let out = null;
    while (queue.length) {
      const [n, first] = queue.shift();
      if (first && n.task && !n.done) return { first, task: true };
      if (first && n.exit) out = out || { first, task: false };
      for (const m of n.links) {
        if (seen.has(m) || (n.gate && m.y > n.y && !gateOpen(n))) continue;
        seen.add(m); queue.push([m, first || m]);
      }
    }
    return out;
  }
  // En una compuerta cerrada, la pista: cuántas tareas faltan y para qué lado están.
  function gateHint(n) {
    const left = n.gate.filter(t => !t.done).length, go = nextOnRail(n);
    const text = `${go ? `${ARROW[dirOf(n, go.first)]} ` : ''}${left} ${left > 1 ? 'tasks' : 'task'} left back there`;
    if (!labels.some(l => l.text === text)) say(text, HOLD);
  }
  // En la portada habla poco: al frenar en el NULL y al pasarlo. Lo del borde queda para quien se quede quieto ahí.
  const faceLine = f => {
    const b = level.block;
    if (!b || P.x + S / 2 < b.x) return "← who's that handsome guy? my creator?";
    return P.x - b.x - b.w < 70 ? '↑ a NULL in the way. hop over it?' : null;
  };
  function request() {
    if (P.dive || P.ride || endAt) return null;
    if (P.rail) {
      const r = P.rail, n = r.at;
      if (r.to || (n.task && !n.done)) return null;
      if (n.fold) return "no rush. ↓ when you're done";
      const go = nextOnRail(n);
      return go && `${ARROW[dirOf(n, go.first)]} ${go.task ? 'more tasks that way' : 'i smell a bucket'}`;
    }
    if (!P.ground || P.form === 'file' || (P.on && P.on.kind === 'model' && !P.on.built)) return null;
    const f = level.face, mc = level.mc, t = level.table;
    if (f && P.y < level.entry.y) return !f.jump || P.x <= f.x2 - 8 ? '↑ feels like we should jump here' : faceLine(f);
    return mc.state.checked ? `${toward(t.x)} almost there, i can feel it` : `${toward(mc.x + mc.w / 2)} the exit's over here`;
  }
  let idleSince = 0;
  function nudge(now) {
    const busy = camFree || now < missionUntil || Object.values(keys).some(Boolean) || labels.some(l => now < l.until) || document.querySelector('dialog[open]');
    if (busy) { idleSince = now; return; }
    if (now - idleSince < (P.rail && P.rail.at.fold ? READING : IDLE)) return;
    const text = request();
    if (text) say(text, HOLD);
    idleSince = now;
  }
  function step(dt, now, control) {
    if (endAt) {
      if (!endSaid && now - endAt > 900) { endSaid = true; say("there's no place like home", 1600); }
      if (now - endAt > 7500) finish();
      return;
    }
    if (P.dive) {
      // Conserva el impulso que traía: la velocidad gira de a poco hacia la cara y después hacia la salida,
      // y acelera como una caída. Si venía subiendo en un salto, sigue subiendo un poco antes de curvarse:
      // nunca se frena ni se da vuelta de golpe.
      const d = P.dive, px = P.x, py = P.y;
      d.age += dt;
      const target = d.via || d.b, tx = target[0] - P.x, ty = target[1] - P.y, dist = Math.hypot(tx, ty);
      const speed = d.speed = Math.min(DIVE_MAX, d.speed + GRAVITY * 0.6 * dt), turn = Math.min(1, dt * 7);
      d.vx += (tx / (dist || 1) * speed - d.vx) * turn; d.vy += (ty / (dist || 1) * speed - d.vy) * turn;
      P.x += d.vx * dt; P.y += d.vy * dt;
      if (d.via && dist < 40) d.via = null;
      if (window.__portraitPoke) window.__portraitPoke(P.x + S / 2, P.y + S / 2 - scrollY, (P.x - px) * 3, (P.y - py) * 3);
      if ((!d.via && P.y >= d.b[1]) || d.age > 2.5) {
        P.dive = null; P.vy = 0; if (window.__portraitPoke) window.__portraitPoke(null);
        onNode(level.entry); P.rail = { at: level.entry, to: null, d: 0 }; once('a DAG! this could be helpful');
      }
      return;
    }
    if (P.ride) {
      P.ride.d += dt * 620;
      const [x, y, end] = rideTo(P.ride.d);
      P.x = x - S / 2; P.y = y - S / 2;
      if (end) { P.ride = null; P.form = 'pk'; P.vy = 0; }
      return;
    }
    if (P.rail) { railStep(dt, control, now); return; }
    for (const p of level.plats) if (p.tick) p.tick(now, dt);
    const dir = control ? ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) : 0;
    if (dir) P.face = dir;
    P.vx = dir * SPEED * (P.fast ? 1.7 : 1);
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
    // Apenas se va la misión, el muñequito ya mira la cara: no espera a que el jugador se quede quieto.
    if (f && control && P.ground && P.y < level.entry.y && now >= missionUntil && faceLine(f)) once(faceLine(f), HOLD);
    if (f && control && (!P.ground || !f.jump) && P.x + S / 2 > f.x1 && P.x + S / 2 < f.x2 && P.y + S / 2 > f.y1 && P.y + S / 2 < f.y2) {
      P.dive = divePath(f.via ? [f.via[0] - S / 2, f.via[1] - S / 2] : null, [level.entry.x - S / 2, level.entry.y - S / 2]); P.on = null; P.ground = false;
      return;
    }
    const mc = level.mc;
    // La caja solo se deja por Monte Carlo: pasar su borde de abajo es haber salido, a cualquier velocidad.
    if (mc && !mc.state.checked && P.y > mc.y) mc.state.checked = true;
    // La tabla recién se ve al avanzar un poco: ahí la encuentra, sin frenar.
    const found = 'found my table, finally!!!';
    if (mc && mc.state.checked && !said.has(found) && P.x > Math.min(mc.x + mc.w + 100, level.table.x - 40)) { said.add(found); say(found, 5000); }
    const b = level.bucket, cx = P.x + S / 2;
    const inside = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    if (!inside) b.since = 0; else if (!b.since && b.ready()) { b.since = now; once('nice bucket. must be AWS'); }
    const inBucket = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    P.form = inBucket ? 'file' : 'pk';
    if (inBucket && P.y + S > b.y + b.d + 4) { P.ride = { d: 0 }; P.form = 'dot'; }

    const m = level.table;
    if (!won && P.x + S > m.x - 6 && P.x < m.x + m.w + 6 && P.y + S > m.y - 10 && P.y < m.y + m.h) {
      won = true; keys = {}; endAt = now; endSaid = false; P.x = m.x + m.w / 2 - S / 2; P.y = m.y - S; P.vy = 0;
    }
    for (const c of level.checkpoints) if (P.y > c.y + 40) level.respawn = c;
    if (P.y > level.docH + 60) { const c = level.respawn || level.checkpoints[0]; P.x = c.x; P.y = c.y + 30; P.vy = 0; }
  }

  // ---------- cámara: sigue al muñequito pero deja leer ----------
  function frameTarget(n) {
    const open = n && n.fold && n.task.open && box(n.task);
    if (!n || !(open || n.frame)) return null;
    const [y1, y2] = open ? [open.y, open.b] : n.frame, nav = 64, max = document.documentElement.scrollHeight - H;
    return Math.max(0, Math.min(max, y2 - y1 + 40 < H - nav ? (y1 + y2) / 2 - (H + nav) / 2 : y1 - nav - 24));
  }
  function follow(dt) {
    // Si se scrolleó a mano, la cámara no pelea: vuelve recién con la próxima tecla.
    if (camFree || performance.now() < swapUntil) return;
    const rel = P.y - scrollY;
    let target = null;
    if (rel < H * 0.28) target = P.y - H * 0.28;
    if (rel > H * 0.62) target = P.y - H * 0.62;
    // En el DAG la cámara muestra centrado, debajo del menú, el cuadro del nodo hacia donde va el muñequito
    // (o su comienzo si no entra entero), para que se lea completo y no cortado.
    const framed = P.rail ? frameTarget(P.rail.to || P.rail.at) : null;
    if (framed !== null) target = framed;
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
  const SAVE = 'pk-progress', FOLDS = '#more .fold', TASKS = `#experience .card.big, #projects .card, ${FOLDS}`;
  function snapshot() {
    if (!level) return null;
    return {
      x: P.x, y: P.y, won, done: mode === 'done', playing: mode === 'play',
      reads: [...document.querySelectorAll(TASKS)].map((el, k) => el.classList.contains('read') ? k : -1).filter(k => k >= 0),
      plats: level.plats.map((p, i) => (p.t || p.built || p.solid === false) ? { i, t: p.t, b: p.built, s: p.solid } : null).filter(Boolean),
      // En los rieles se guarda la tarea donde estaba, o la sección: si el nivel se arma distinto, vuelve ahí.
      rail: P.rail ? (P.rail.at.task ? { task: [...document.querySelectorAll(TASKS)].indexOf(P.rail.at.task) } : { at: level.nodes.indexOf(P.rail.at), of: level.nodes.length, section: [...document.querySelectorAll('main > section')].find(s => { const b = box(s); return P.y >= b.y && P.y < b.b; })?.id }) : null,
    };
  }
  function apply(snap) {
    for (const st of snap.plats) {
      const p = level.plats[st.i];
      if (!p) continue;
      p.t = st.t; p.built = st.b; p.solid = st.s;
    }
    P.x = snap.x; P.y = snap.y; P.vy = 0; P.on = null; won = snap.won;
    const cards = [...document.querySelectorAll(TASKS)], sec = snap.rail && snap.rail.section && box(document.getElementById(snap.rail.section));
    // Si el nivel quedó igual de forma, al mismo nodo; si no, a la misma tarea o al comienzo de la misma sección.
    const back = !snap.rail ? null : snap.rail.task >= 0 ? level.nodes.find(n => n.task === cards[snap.rail.task])
      : snap.rail.of === level.nodes.length ? level.nodes[snap.rail.at]
      : level.nodes.find(n => n.frame && !n.task && !n.gate && sec && n.y >= sec.y && n.y < sec.b) || level.entry;
    P.rail = back ? { at: back, to: null, d: 0 } : null;
    if (P.rail) onNode(P.rail.at);
  }
  addEventListener('pagehide', () => { const snap = mode === 'wait' || mode === 'intro' ? null : snapshot(); try { if (snap) sessionStorage.setItem(SAVE, JSON.stringify(snap)); } catch (e) {} });
  function restore() {
    let snap = null;
    try { snap = JSON.parse(sessionStorage.getItem(SAVE) || 'null'); } catch (e) {}
    if (!snap) return;
    const cards = document.querySelectorAll(TASKS);
    snap.reads.forEach(k => { if (cards[k]) cards[k].classList.add('read'); });
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    void document.body.offsetHeight;
    rebuild(); apply(snap); mode = 'idle';
    if (snap.done) finish(); else if (snap.playing) start();
  }
  function start() {
    if (mode === 'play') return;
    relayout();
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    // La clase va antes de medir: mientras se juega, algunas secciones dejan lugar para piezas del nivel.
    document.body.classList.add('playing');
    if (!P.rail) document.querySelectorAll(FOLDS).forEach(el => { el.open = false; });
    void document.body.offsetHeight;
    document.documentElement.style.scrollBehavior = 'auto';
    if (mode === 'intro') endIntro();
    // El nivel se mide de nuevo, pero sin perder lo ya hecho.
    const snap = level && snapshot();
    rebuild();
    if (snap) apply(snap);
    // Si el muñequito quedó lejos de lo que estás mirando, no se mueve él: la cámara va a buscarlo.
    mode = 'play'; keys = {}; camFree = false; expected = scrollY;
    document.body.classList.add('playing'); pad.hidden = !touch; hint.classList.remove('on');
  }
  function stop() {
    if (mode !== 'play') return;
    mode = 'idle'; keys = {};
    document.documentElement.style.scrollBehavior = '';
    document.body.classList.remove('playing'); pad.hidden = true;
  }
  // Vuelve todo al estado de la página recién cargada: el muñequito espera junto al botón y no queda nada leído.
  function reset() {
    try { sessionStorage.removeItem(SAVE); } catch (e) {}
    document.querySelectorAll(TASKS).forEach(el => el.classList.remove('read', 'lit'));
    won = false; endAt = 0; lastSaid = null; said.clear(); P.fast = false; document.body.classList.remove('ran'); if (note) note.hidden = true; labels = []; P.ride = null; P.rail = null; P.dive = null; P.form = 'pk'; P.vy = 0; P.on = null;
    keys = {}; mode = 'wait';
    document.body.classList.remove('playing'); pad.hidden = true;
    document.documentElement.style.scrollBehavior = '';
    rebuild();
  }
  // El juego termina solo: vuelve el diseño normal, cada tarjeta leída queda marcada y el agente deja su nota
  // en el contacto, con un botón para jugar de nuevo.
  let note = null;
  function finish() {
    endAt = 0; mode = 'done'; keys = {}; labels = [];
    document.body.classList.remove('playing'); document.body.classList.add('ran'); pad.hidden = true;
    document.documentElement.style.scrollBehavior = '';
    if (!note) {
      note = document.createElement('div');
      note.className = 'agent-note'; note.setAttribute('role', 'status');
      $('#contact .cta').after(note);
    }
    note.innerHTML = `<span class="agent-dot" aria-hidden="true"></span><p><b>agent</b>Thanks for the ride! Luca is just one message away.</p><button type="button" class="again">↺ play again</button>`;
    note.hidden = false;
    note.querySelector('.again').addEventListener('click', restart);
    const hi = $('#contact .btn'); hi.classList.remove('wiggle'); void hi.offsetWidth; hi.classList.add('wiggle');
  }
  function restart() {
    reset();
    // Vuelve arriba de una, con la página ya recalculada: si no, el scroll no llega y la entrada se saltea.
    void document.body.offsetHeight;
    scrollTo({ top: 0, behavior: 'instant' });
    beginIntro();
  }
  function endIntro() {
    intro = null; P.trail = []; if (window.__portraitPoke) window.__portraitPoke(null);
    const spot = home(); P.x = spot.x; P.y = spot.y; P.vy = 0; mode = 'idle';
    // Apenas aterriza ya se juega: cuenta la misión y muestra con qué se mueve.
    // Unos segundos sin moverse para que la misión se lea: al salir ya cede el lugar a lo que dice frente al NULL.
    start(); P.squash = 1; missionUntil = performance.now() + 9000; hold(2500);
    if (touch) { pad.classList.remove('pulse'); void pad.offsetWidth; pad.classList.add('pulse'); }
  }
  // Abrir el mail (o apretar una flecha mientras espera) hace la entrada; después solo retoma el juego.
  const activate = () => { if (mode === 'done') reset(); if (mode === 'wait') beginIntro(); else if (mode !== 'intro') start(); };

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
    relayout();
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
    else if (level && mode !== 'wait' && mode !== 'done') { step(dt, now, mode === 'play' && now >= lockUntil); if (mode === 'play') { follow(dt); nudge(now); } }
    if (P.trail.length && mode !== 'intro') P.trail.shift();
    draw(now);
    // El botón invisible sobre el muñequito: para tocarlo en el celu o llegar con Tab.
    const ws = waitSpot(), waiting = mode === 'wait', showHit = mode === 'idle' || waiting, big = S * BIG + 24;
    hit.style.display = showHit ? '' : 'none';
    if (waiting) Object.assign(hit.style, { left: `${ws.x + S / 2 - big / 2}px`, top: `${ws.y + S + 6 - big}px`, width: `${big}px`, height: `${big}px` });
    else if (showHit) Object.assign(hit.style, { left: `${P.x - 10}px`, top: `${P.y - 10}px`, width: '44px', height: '44px' });
    // El globito mientras espera, y la misión sobre el muñequito al aterrizar.
    hint.classList.toggle('on', waiting && ws.y > scrollY && ws.y < scrollY + H);
    if (waiting) {
      // Al costado si entra; en pantallas angostas, arriba del muñequito.
      const side = ws.x + S * BIG + 230 < W;
      hint.classList.toggle('side', side);
      hint.style.left = `${side ? ws.x + S / 2 + S * BIG / 2 + 14 : Math.min(W - 70, ws.x + S / 2)}px`;
      hint.style.top = `${side ? ws.y + S - S * BIG / 2 : ws.y + S - S * BIG - 14}px`;
    }
    help.classList.toggle('on', !!level && (mode === 'play' || mode === 'idle'));
    const talk = mode === 'play' && now < missionUntil;
    mission.classList.toggle('on', talk);
    if (talk) { mission.style.left = `${Math.max(170, Math.min(W - 170, P.x + S / 2))}px`; mission.style.top = `${P.y - 16}px`; }
    requestAnimationFrame(frame);
  }

  // ---------- controles ----------
  const KEY = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', ArrowDown: 'down', s: 'down' };
  addEventListener('keydown', event => {
    // Con un visor abierto (las capturas en grande), las teclas son del visor.
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (mode === 'intro') { if (k) event.preventDefault(); return; }
    if (mode === 'play') {
      if (event.key === 'Escape') { stop(); return; }
      if (k) { if (!event.repeat) letGo(); keys[k] = true; camFree = false; event.preventDefault(); missionUntil = Math.min(missionUntil, Math.max(performance.now(), lockUntil) + 800); }
      else if (['PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) camFree = true;
      return;
    }
    // Las flechas solo arrancan el juego si no estás usando unas pestañas o escribiendo.
    const el = document.activeElement;
    if ((k === 'left' || k === 'right') && !(el && el.closest('[role="tablist"], input, textarea, select, [contenteditable]'))) { const fresh = mode === 'wait' || mode === 'done'; activate(); if (!fresh) keys[k] = true; event.preventDefault(); }
  });
  addEventListener('keyup', event => { const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key]; if (k) keys[k] = false; });
  hit.addEventListener('click', activate);
  // Un click sobre el muñequito mientras se juega repite lo último que dijo; si todavía no dijo nada, la misión.
  document.addEventListener('click', event => {
    if (mode !== 'play' || Math.hypot(event.clientX - P.x - S / 2, event.clientY + scrollY - P.y - S / 2) > 34) return;
    if (lastSaid) { labels = []; say(lastSaid); } else missionUntil = performance.now() + 9000;
  });
  // Scrollear no corta el juego: la página se mira libre y el muñequito espera donde está. La cámara vuelve a
  // seguirlo con la próxima tecla.
  const look = () => { if (mode === 'play') camFree = true; };
  addEventListener('wheel', look, { passive: true });
  addEventListener('touchmove', event => { if (!pad.contains(event.target)) look(); }, { passive: true });
  addEventListener('scroll', () => { if (mode === 'play' && Math.abs(scrollY - expected) > 40) look(); }, { passive: true });
  pad.querySelectorAll('[data-k]').forEach(button => {
    const k = button.dataset.k;
    const on = event => { event.preventDefault(); letGo(); keys[k] = true; camFree = false; missionUntil = Math.min(missionUntil, Math.max(performance.now(), lockUntil) + 800); button.setPointerCapture?.(event.pointerId); };
    const off = () => { keys[k] = false; };
    button.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, off));
  });
  pad.querySelector('.x').addEventListener('click', () => stop());
  // Salir del todo: el muñequito vuelve a esperar junto al botón, como al cargar la página.
  help.querySelector('.exit').addEventListener('click', event => { event.stopPropagation(); reset(); });
  document.querySelectorAll('.restart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); restart(); }));
  // Con la pestaña oculta la página puede achicarse a cero: medir ahí rompe el nivel. Se mide al volver, si cambió.
  // También se vuelve a medir antes de arrancar o de la entrada: si la página cargó oculta, el alto guardado
  // podía ser 0 y el muñequito aparecía en cualquier lado.
  let measured = '';
  function relayout() {
    if (document.hidden || !innerWidth || !innerHeight || measured === `${innerWidth}x${innerHeight}`) return;
    measured = `${innerWidth}x${innerHeight}`;
    resize(); if (level) { const snap = snapshot(); rebuild(); apply(snap); }
  }
  addEventListener('resize', relayout);
  // Mientras se juega, los desplegables son tareas del DAG: los abre y los cierra el muñequito, no el mouse.
  document.addEventListener('click', event => {
    if (!document.body.classList.contains('playing') || !event.target.closest('.fold summary, a[href$="#how-i-work"], a[href$="#education"]')) return;
    event.preventDefault(); event.stopPropagation();
    say('it opens when i arrive, promise', 2400);
  }, true);
  document.addEventListener('toggle', () => { if (level && !(P.rail && P.rail.at.fold)) { const snap = snapshot(); rebuild(); apply(snap); } }, true);
  document.addEventListener('visibilitychange', relayout);

  // Para probarlo desde afuera.
  window.__pk = { level: () => level, activate, state: () => ({ dive: !!P.dive, mode, x: Math.round(P.x), y: Math.round(P.y), form: P.form, ride: !!P.ride, won, on: P.on && (P.on.kind || (P.on.floor ? 'floor' : 'ledge')), scrollY }), start, stop, keys: k => Object.assign(keys, k), place: (x, y) => { P.x = x; P.y = y; P.vy = 0; }, sim: ms => { let t = performance.now(); for (let k = 0; k < ms / 16; k++) { t += 16; step(0.016, t, mode === 'play'); if (mode === 'play') follow(0.016); } return window.__pk.state(); } };

  relayout();
  if (document.readyState === 'complete') restore(); else addEventListener('load', restore);
  last = performance.now(); requestAnimationFrame(frame);
})();
