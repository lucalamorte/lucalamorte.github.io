// El portfolio como nivel. El muñequito espera debajo del texto de la portada; al tocarlo da una vuelta por el
// retrato y cae sobre el título. Desde ahí se salta a la cara de Luca: la zambullida lo deja en un DAG que recorre
// la experiencia, los productos y "more about me" (cada tarjeta es una tarea que corre mientras se lee, los
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
  hit.type = 'button'; hit.className = 'pk-hit'; hit.setAttribute('aria-label', 'Play the portfolio as a game');
  const hint = document.createElement('span');
  hint.className = 'pk-hint'; hint.textContent = touch ? "Hi, I'm Little Bit. Tap me!" : "Hi, I'm Little Bit. Click me!"; hint.classList.add('side');
  // La misión, con las teclas para moverse, en un globo sobre el muñequito.
  const mission = document.createElement('div');
  mission.className = 'pk-say'; mission.setAttribute('role', 'status');
  const MISSION = "I'm Little Bit. Help me find the <code>contacts</code> table!";
  // Lo que hay que leer sí o sí va en este globo y se pasa con su botón (o con Enter o espacio), nunca por tiempo.
  // Mientras está abierto, Little Bit no se mueve.
  let talkSteps = null, talkIdx = 0, talkFrom = 0;
  const showStep = () => { const st = talkSteps[talkIdx]; mission.innerHTML = `<p>${st.html}</p><button type="button" class="next">${st.btn} <kbd>↵</kbd></button>`; };
  const converse = (steps, from = performance.now()) => { talkSteps = steps; talkIdx = 0; talkFrom = from; lockUntil = Infinity; keys = {}; queued = null; showStep(); };
  const advance = () => {
    if (!talkSteps || performance.now() < talkFrom) return;
    if (++talkIdx < talkSteps.length) { showStep(); return; }
    talkSteps = null; lockUntil = performance.now(); missionUntil = 0;
    tip = { keys: ['←', '→'], from: lockUntil + 300 };
  };
  mission.addEventListener('click', event => { if (event.target.closest('.next')) { event.stopPropagation(); advance(); } });
  // El panel fijo con los controles y el botón para reiniciar; aparece cuando el juego ya empezó.
  const help = document.createElement('div');
  help.className = 'play-help';
  help.innerHTML = '<span class="goal">Goal: get me to the <code>contacts</code> table.</span><span><kbd>←</kbd><kbd>→</kbd> move</span><span><kbd>↑</kbd> jump</span><span><kbd>↓</kbd> down</span><button type="button" class="restart">↺ Restart</button><button type="button" class="exit">✕ exit</button>';
  // Si se sigue leyendo la página y Little Bit queda fuera de pantalla un rato, avisa desde una esquina: volver con él
  // o salir del juego. No interrumpe la lectura: no mueve la página hasta que se elige.
  const away = document.createElement('div');
  away.className = 'pk-away';
  away.innerHTML = '<p></p><div><button type="button" class="back">Take me back</button><button type="button" class="quit">Exit game</button></div>';
  let awaySince = 0;
  const pad = document.createElement('div');
  pad.className = 'pad'; pad.hidden = true;
  pad.innerHTML = '<button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="right" aria-label="Right">▶</button><button type="button" data-k="down" class="down" aria-label="Go down">▼</button><button type="button" data-k="jump" class="jump" aria-label="Jump">▲</button><button type="button" class="x" aria-label="Stop playing">✕</button><button type="button" class="restart re" aria-label="Restart the game">↺</button>';
  document.body.append(canvas, hit, hint, mission, help, away, pad);

  let camFree = false, endAt = 0, fade = 1, mode = 'wait', missionUntil = 0, lockFrom = 0, lockUntil = 0, swapUntil = 0, swapping = null, queued = null, W = 0, H = 0, level = null, keys = {}, last = 0, labels = [], expected = -1, intro = null, won = false;
  const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, on: null, face: 1, squash: 0, form: 'pk', ride: null, dropUntil: 0, trail: [] };

  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const home = () => {
    const h = $('.hero h1'), b = box(h), range = document.createRange(); range.selectNodeContents(h);
    const rects = [...range.getClientRects()].filter(r => r.width), end = rects.length ? rects[rects.length - 1].right : b.r - scrollX;
    return { x: Math.min(b.r, end + scrollX) - S - 6, y: b.y + 4 - S };
  };
  // Donde espera antes de empezar: debajo del texto de la portada, más grande y saltando. Primero se lee y
  // después invita; al tocarlo salta al título, donde arranca el juego.
  const BIG = 1.5;
  // Little Bit se asoma recién cuando el título terminó de escribirse y hubo un momento para leerlo.
  let peekAt = null;
  addEventListener('title-typed', () => { peekAt = performance.now() + 300; });
  // En el celu Little Bit espera a que se escriba el rol y se lea la línea de abajo: recién ahí aparece.
  let roleAt = null;
  addEventListener('role-typed', () => { roleAt = performance.now(); });
  // Sin animación de escritura (movimiento reducido) no hay nada que esperar.
  // Si el título se terminó de escribir antes de que este archivo escuchara el aviso, se toma de la clase.
  // Mientras nadie juega, Little Bit flota perdido en el espacio, sin gravedad, por detrás de la página: deriva
  // despacio, gira apenas y rebota suave en los bordes de la pantalla, pidiendo ayuda. Vive en coordenadas de la ventana.
  const drift = { x: 0, y: 0, vx: -16, vy: 11, a: 0, va: .18, since: 0, ready: false };
  // En el celu flota más chico y más tenue: es un detalle del fondo, no tapa lo que se lee.
  const FB = () => W < 768 ? .52 : 1.05, FA = () => W < 768 ? .9 : 1;
  // Ya no flota por la página: el juego es solo a pedido, desde el botón Play.
  const drifting = now => {
    if (true || mode !== 'wait' || peekFrom() === null || now < peekFrom()) { drift.since = 0; return false; }
    if (!drift.ready) { drift.ready = true; drift.x = W * .72; drift.y = H * .28; }
    if (!drift.since) drift.since = now;
    return true;
  };
  // Habla cada tanto: unos segundos con un globo y un rato callado, cambiando lo que dice.
  const TALK = 5000, QUIET = 16000;
  const asks = touch ? ['Help!', 'Tap me!', "I'm lost!", 'Psst… tap me.']
    : ['Help!', 'Click me!', "I'm lost!", 'Psst… click me.'];
  // Flota solo por los márgenes, a los costados del contenido, sin pasar por encima del texto. En pantallas anchas
  // recorre todo el margen; en el celu, donde el margen es angosto, sube y baja pegado al borde.
  // `lane` guarda el margen de ahora (de borde a borde), para que el globo quepa ahí.
  let lane = null;
  const gutter = (w, l, r) => {
    const m = $('main'); if (!m) return null;
    const mr = m.getBoundingClientRect(), cs = getComputedStyle(m), cl = mr.left + parseFloat(cs.paddingLeft) - 12, cr = mr.right - parseFloat(cs.paddingRight) + 12;
    const right = drift.x + w / 2 > W / 2;
    if (cl - l < w + 16 || r + w - cr < w + 16) { lane = null; return right ? [W - w - 4, W - w - 2] : [2, 4]; }
    lane = right ? [cr, document.documentElement.clientWidth - 12] : [12, cl];
    return right ? [cr, r] : [l, cl - w];
  };
  let textBoxes = [], textAt = 0;
  const TEXT = 'main h1, main h2, main h3, main .eyebrow, main .role, main .hero p, main section > p, main .next-co, main .pr-group';
  const moveDrift = dt => {
    const now = performance.now();
    if (now - textAt > 400) { textAt = now; textBoxes = [...document.querySelectorAll(TEXT)].filter(el => !el.closest('.card, .fold')).map(el => el.getBoundingClientRect()).filter(r => r.width && r.bottom > 0 && r.top < H); }
    const w = S * FB(), pad = 18;
    for (const r of lane || W < 768 ? [] : textBoxes) {
      if (drift.x + w < r.left - pad || drift.x > r.right + pad || drift.y + w < r.top - pad || drift.y > r.bottom + pad) continue;
      // Se aleja por el lado más corto, con suavidad.
      const up = drift.y + w - (r.top - pad), down = r.bottom + pad - drift.y;
      drift.vy = up < down ? -Math.abs(drift.vy) : Math.abs(drift.vy);
      drift.y += (up < down ? -1 : 1) * Math.min(60 * dt, Math.min(up, down));
    }
    drift.x += drift.vx * dt; drift.y += drift.vy * dt; drift.a += drift.va * dt;
    let l = 24, r = W - S * FB() - 24; const t = 90, b = H - S * FB() - 110;
    const g = gutter(S * FB(), l, r); if (g) [l, r] = g;
    // En el celu el margen es una franja de pocos píxeles: ahí se queda pegado al borde y solo sube y baja, sin
    // rebotar de un lado al otro de la franja en cada cuadro (se veía trabado).
    // Y no sube ni baja por el borde (parecía en caída libre): flota en su lugar, con un vaivén suave.
    if (r - l < 6) {
      // En el celu vive abajo de todo, donde no tapa lo que se lee: aparece en un lugar al azar de la franja de abajo
      // (nunca en el medio, donde está la flecha), se queda un rato con un vaivén mínimo, se desvanece y al ratito
      // reaparece en otro lugar.
      const w = S * FB();
      drift.vx = 0; drift.vy = 0;
      // Cada aparición es un ciclo: espera, elige su lugar recién al aparecer (así el lugar es el de la pantalla que se ve
      // en ese momento), se queda un rato y se desvanece.
      if (!drift.cycle || (drift.cycle.placed && now > drift.cycle.end)) drift.cycle = { n: drift.cycle ? drift.cycle.n + 1 : 0, from: now + (drift.cycle ? 1200 + Math.random() * 1300 : 0) };
      const c = drift.cycle;
      if (!c.placed && now >= c.from && (drift.alpha ?? 0) < .05) {
        // En la portada su lugar es fijo: debajo de la línea de presentación, a la izquierda de la flecha, con el techo
        // del globo debajo de la línea. Aparece cuando ya se escribió el rol y pasó el tiempo de leer esa línea.
        const sub = $('.hero .intro p:last-child'), sb = sub && sub.getBoundingClientRect();
        const home = sb && sb.bottom > 0 && H - sb.bottom > w + 46 + 24 ? [sb.left + 8, sb.bottom + 46, true] : null;
        const ready = roleAt !== null || matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (home && (!ready || now < roleAt + 2500)) c.from = now + 200;
        else {
          const spot = home || freeSpot(w);
          // Sin lugar libre en esta pantalla: vuelve a probar en un ratito.
          if (!spot) c.from = now + 1200;
          else { Object.assign(c, { placed: true, from: now, docY: spot[1] + scrollY, end: now + 9000 + Math.random() * 5000 }); drift.x = spot[0]; drift.y = spot[1]; }
        }
      }
      // Queda pegado a la página: al scrollear se mueve con lo que tiene al lado. Si sale de la pantalla o le queda
      // algo para leer abajo, se va.
      if (c.placed) {
        c.y = c.docY - scrollY;
        if (c.y < 70 || c.y > H - w - 20) c.end = Math.min(c.end, now);
        else if (now < c.end - 600 && now - (c.checked || 0) > 300) { c.checked = now; if (!isFree(drift.x, c.y, w, true)) c.end = now + 600; }
      }
      const on = c.placed && now < c.end - 600;
      drift.alpha = Math.max(0, Math.min(1, (drift.alpha ?? 0) + (on ? dt * 2.5 : -dt * 2.5)));
      if (c.placed) drift.y = c.y + Math.sin(now / 1100) * 3;
    }
    else { if (!drift.vx) drift.vx = (Math.random() < .5 ? -1 : 1) * 26; if (!drift.vy) drift.vy = 11; if (drift.x < l || drift.x > r) { drift.vx *= -1; drift.x = Math.max(l, Math.min(r, drift.x)); } }
    if (W >= 768 && (drift.y < t || drift.y > b)) { drift.vy *= -1; drift.y = Math.max(t, Math.min(b, drift.y)); }
    if (Math.abs(drift.a) > .35) drift.va = -Math.sign(drift.a) * Math.abs(drift.va);
  };
  // Lo que se lee en la página: Little Bit flotando en el celu nunca se pone encima (ni él ni su globo).
  const READS = 'h1, h2, h3, p, li, summary, .btn, .email, .visual, .pr-item, .pr-scene.on, .agent-note, .logo, .kind, .nums';
  const readBoxes = () => [...document.querySelectorAll(READS)].map(el => el.getBoundingClientRect()).filter(q => q.width && q.bottom > 0 && q.top < H);
  const isFree = (x, y, w, talk = false, boxes = readBoxes()) => {
    // El globo va centrado arriba de él: se reserva su ancho a los dos lados.
    const a = talk ? { l: x + w / 2 - 66, r: x + w / 2 + 66, t: y - 34, b: y + w + 8 } : { l: x - 2, r: x + w + 2, t: y - 4, b: y + w + 4 };
    return !boxes.some(q => q.left < a.r && q.right > a.l && q.top < a.b && q.bottom > a.t);
  };
  // Dónde aparece: abajo a la derecha, en la esquina libre más baja (arriba interrumpe la lectura, abajo acompaña),
  // con lugar para su globo sin tocar texto y sin salirse de la pantalla. Siempre con lugar para hablar.
  const freeSpot = w => {
    const boxes = readBoxes(), spots = [];
    for (let y = 110; y < H - w - 30; y += 12) for (let x = 2; x + w / 2 + 66 < W - 4; x += 4) if (isFree(x, y, w, true, boxes)) spots.push([x, y, true]);
    if (!spots.length) return null;
    // Lo más abajo y a la derecha posible; entre los mejores, uno al azar para que no quede clavado siempre en el mismo píxel
    const score = ([x, y]) => y + x * .6, best = Math.max(...spots.map(score)), top = spots.filter(q => score(q) > best - 24);
    return top[Math.floor(Math.random() * top.length)];
  };
  const peekFrom = () => {
    const h = $('.hero h1');
    if (!h || !h.classList.contains('typing')) return 0;
    if (peekAt === null && h.classList.contains('typed')) peekAt = performance.now();
    return peekAt;
  };
  // Esperando, sube desde detrás del título y queda parado entero sobre la "e" de "here": el corte solo existe
  // mientras sube, así nunca parece metido en una caja.
  const waitSpot = () => {
    const cs = document.querySelectorAll('.hero h1 .ch'), c = cs.length > 2 ? cs[cs.length - 2] : $('.hero h1'), r = box(c);
    // La línea de las minúsculas se mide con la fuente real: así el cuerpo queda justo detrás y no pisa ninguna letra.
    const st = getComputedStyle(c); ctx.save(); ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    const m = ctx.measureText('x'); ctx.restore();
    const ledge = cs.length > 2 ? r.y + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent + 1 : r.y + r.h * 0.4, x = cs.length > 2 ? r.x + r.w / 2 - S / 2 : r.x + r.w * 0.6;
    return { x, y: ledge - S, ledge };
  };
  // Un cartelito que flota sobre el muñequito o sobre una pieza.
  // Los diálogos siempre salen justo arriba del muñequito y lo siguen mientras se mueve.
  // De a un diálogo por vez: el nuevo aparece enseguida, en su momento, y el anterior se desvanece debajo.
  const READ = 1500, LINGER = 7000, FADE = 320, POP = 320;
  let lastSaid = null;
  const bubbles = [];
  // En los globos, las flechas son teclas y los nombres de tablas van como código, igual que en la misión.
  const chips = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
    .replace(/[↑↓←→]/g, k => `<kbd>${k}</kbd>`).replace(/\b(contacts|[a-z]+_[a-z_]+)\b/g, '<code>$1</code>');
  let tip = null;
  const say = (line, ms = 2000) => {
    const now = performance.now(), cue = /^([↑↓←→]) (.*)$/.exec(line), text = cue ? cue[2] : line;
    if (cue) tip = { keys: [cue[1]], from: now + 250 };
    const until = now + Math.max(ms, LINGER), shown = labels[labels.length - 1];
    if (shown && now < shown.until && shown.text === text) { shown.until = Math.max(shown.until, until); return; }
    labels = labels.filter(l => now < l.until).map(l => ({ ...l, until: Math.min(l.until, now + FADE) }));
    labels.push({ text, from: now, until }); lastSaid = text;
  };
  // Lo que el muñequito va contando del recorrido: cada frase, una sola vez por partida.
  const said = new Set();
  // Lo que le pide algo al jugador queda en pantalla hasta que toque una tecla: así nadie se pierde la pista.
  const HOLD = Infinity, letGo = () => { const now = performance.now(); if (tip && now >= tip.from) tip = null; labels.forEach(l => { if (l.until === HOLD) l.until = Math.max(now, l.from + READ); }); };
  // Cada frase del recorrido frena al muñequito lo justo para leerla: así nunca llega antes que lo que dice.
  // Mientras tanto, un anillo alrededor suyo muestra cuánto falta para que vuelva a moverse.
  // Lo que se apretaba al empezar la frase se suelta, y nada de lo que se apriete mientras habla queda guardado para después.
  const hold = ms => { lockFrom = performance.now(); lockUntil = Math.max(lockUntil, lockFrom + ms); keys = {}; queued = null; };
  // Tampoco se guarda lo que se aprieta mientras viaja por el DAG o mientras una tarea carga: si no se puede, no se puede.
  const talking = () => mode === 'play' && (performance.now() < lockUntil || !!(P.rail && (P.rail.to || (P.rail.at.task && !P.rail.at.done))) || !!P.enter || !!P.dive);
  // El regalo: al aterrizar, la cara le manda sus estrellitas. Él las recibe y se ilumina, pero no sabe qué pasó:
  // lo van a descubrir juntos, con el jugador, cuando pise las primeras estrellas. Recién después cuenta la misión.
  const GIFT = 'Whoa… I feel different ✨';
  const GIFT_MS = 1700;
  // El regalo es un solo chorro: desde que cruza la cara hasta un momento después de aterrizar, la cara le va mandando
  // estrellitas sin cortes, cada vez menos, y todas tardan lo mismo en llegarle, lo que lo sigue esté volando o quieto.
  const makeGift = (face, now, ends) => {
    const span = ends + 900 - now;
    return { land: ends, sparks: Array.from({ length: 75 }, (_, k) => {
      const from = now + span * Math.pow((k + Math.random()) / 75, 1.15);
      return { x: face.x + face.w * (.25 + Math.random() * .5), y: face.y + face.h * (.15 + Math.random() * .6), bend: (Math.random() - .5) * 260, from, to: from + 700 + Math.random() * 250, r: 2.2 + Math.random() * 2.4, spin: Math.random() * 3, tint: tintOf(Math.random()) };
    }) };
  };
  let gift = null;
  // Una frase que se dice una sola vez. Frena para leerla solo si hace falta: en el bucket y en Snowflake no tiene
  // adónde ir igual, y frenarlo ahí solo demora que pase.
  const once = (text, ms = 3600, stop = true) => { if (said.has(text)) return; said.add(text); say(text, ms); if (stop) hold(500 + text.length * 35); };

  // ---------- el nivel ----------
  function build() {
    W = document.documentElement.clientWidth;
    const plats = [], things = [], checkpoints = [], walls = [], ceils = [];
    let level_mc = null, block = null;
    // La columna es la de las secciones, que en pantallas grandes son más anchas que la presentación: el riel corre por fuera de las tarjetas.
    const h = box(hero), sec = $('#experience') ? box($('#experience')) : h, colL = Math.max(16, Math.min(h.x, sec.x)), colR = Math.min(W - 16, Math.max(h.r, sec.r));
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
      const section = els[0].closest('section'), tasks = [], byRow = new Map(), n0 = nodes.length;
      // El costado derecho del camino: justo afuera de las tarjetas, sin salirse de la pantalla.
      const rx = Math.min(W - S / 2 - 4, Math.max(...els.map(el => box(el).r)) + 26);
      let first = null;
      els.forEach(el => { const c = box(el), key = Math.round(c.y); byRow.set(key, [...(byRow.get(key) || []), { el, c }]); });
      let bus = from;
      // Lo que la cámara muestra centrado mientras se anda por cada fila: la primera va con el título de la sección.
      let frame = null;
      [...byRow.values()].forEach((row, r) => {
        // En escritorio el riel va bien separado del vidrio de las tarjetas (si no, parece su borde); en el celu, donde
        // corre por el costado, queda pegado como antes.
        const gy = row[0].c.y - (W < 760 ? 16 : 34);
        frame = [r ? gy - 20 : box(section.firstElementChild).y, Math.max(...row.map(q => q.c.b))];
        // En el celu va una tarjeta por fila: la tarea queda sobre el bus y ↓ pasa de una tarjeta a la siguiente.
        if (W < 760 && row.length === 1) {
          const { el } = row[0], t = node(mx, gy, { task: el, need: need * .6, t: 0, done: el.classList.contains('read'), frame, bus: true });
          if (bus) link(bus, t); bus = t; first = first || t; tasks.push(t);
          return;
        }
        // Un solo camino, en serpentina: la fila se recorre entera de un costado al otro, pasando por cada tarjeta,
        // y se baja por ese mismo costado a la fila siguiente, que se recorre al revés. No hay desvíos que saltear.
        const right = r % 2 === 1, sx = right ? rx : mx;
        // La esquina donde entra cada fila no es una parada: el camino sigue de largo hasta la tarjeta.
        const b = node(sx, gy, { frame, start: r === 0 }); if (bus) link(bus, b); first = first || b;
        // Una sola parada por fila, en el medio: se leen todas sus tarjetas juntas (en el celu ya hay una por fila).
        row.sort((u, v) => u.c.x - v.c.x);
        const els = row.map(q => q.el), mid = (row[0].c.x + row[row.length - 1].c.r) / 2;
        const t = node(mid, gy, { task: els[0], mates: els.slice(1), need: need * .6 * (1 + (els.length - 1) * .6), t: 0, done: els.every(el => el.classList.contains('read')), frame });
        link(b, t); tasks.push(t);
        let prev = t;
        // Sale por el otro costado: desde ahí baja a la fila siguiente.
        const out = node(right ? mx : rx, gy, { frame }); link(prev, out); bus = out;
      });
      const bottom = Math.max(...els.map(el => box(el).b));
      // Si la última fila terminó a la derecha, el camino vuelve por debajo de las tarjetas hasta la compuerta.
      if (bus && bus.x !== mx) { const back = node(bus.x, bottom + 26, { frame }); link(bus, back); bus = back; }
      const gate = node(mx, bottom + 26, { gate: tasks, frame });
      link(bus, gate);
      // Todo lo armado acá es el DAG de tarjetas: se recorre más rápido que el resto.
      nodes.slice(n0).forEach(n => { n.dag = true; });
      return { first, gate };
    };
    // Portada: el título es el piso, sin línea encima, y no hay ningún hueco. La única salida es la cara de
    // Luca: al entrar el muñequito se zambulle, cruza la cabeza (las rayas se ondulan) y sale por abajo.
    const h1 = box($('.hero h1')), fig = portrait ? box(portrait) : null;
    let face = null;
    if (fig && fig.b > h1.y) {
      // Con el retrato al costado, el título llega hasta la cara: caminando a la izquierda se entra de frente.
      // Los hombros cierran por debajo, así que no hay otra forma de bajar.
      const edge = fig.r - fig.w * 0.25, title = ledge(edge, h1.y + 4, Math.min(W, colR + 44) - edge, { floor: true, hidden: true });
      // Caminando se llega al borde de la silueta y ahí se frena: para entrar a la cara hay que saltar.
      walls.push({ x: edge, y1: h1.y + 4 - 30, y2: h1.y + 4 });
    } else {
      // En el celu el retrato queda arriba del título: se salta desde el título hacia la cara.
      ledge(-60, h1.y + 4, W + 120, { hidden: true, floor: true });
    }
    // La entrada al juego es un portal MCP parado sobre el título, igual en la compu y en el celu: se camina
    // hasta él y entra solo. El viaje pasa por la cara de Luca (las rayas se ondulan) y termina en el DAG.
    {
      const side = fig && fig.b > h1.y, gx = side ? fig.r - fig.w * 0.25 + 4 : h1.x + 2, gy = h1.y + 4, gw = 30;
      face = { portal: true, mobile: !side, x1: -60, x2: gx + gw, y1: gy - 260, y2: gy + 8,
        via: fig ? [fig.x + fig.w * 0.5, fig.y + fig.h * (side ? 0.38 : 0.45)] : null,
        under: fig && !side ? [fig.x + fig.w * 0.12, fig.r - fig.w * 0.12] : null };
      face.at = [gx + gw / 2, gy - 30];
      things.push({ draw: now => drawPortal(gx + gw / 2, gy, now) });
    }

    // El DAG arranca donde termina la zambullida, cruza la experiencia y los productos y desemboca en el bucket.
    const work = dag([...document.querySelectorAll('#experience .card.big')], null, 2.2);
    const built = dag([...document.querySelectorAll('#projects .card')], work.gate, 1.6);
    // "more about me": cada desplegable es una tarea sobre el bus. Al llegar se abre y queda abierto el tiempo que
    // se quiera; se cierra recién cuando el muñequito sigue.
    const folds = [...document.querySelectorAll(FOLDS)], foldTasks = [];
    let prev = built.gate;
    folds.forEach(el => {
      const s = box(el.querySelector('summary'));
      const t = node(mx, s.y + s.h / 2, { task: el, fold: true, need: 1, t: 0, done: el.classList.contains('read') });
      link(prev, t); prev = t; foldTasks.push(t);
    });
    // Educación ya no es un desplegable: es una parada a la altura de su título, donde se frena a leer y comenta.
    const edu = $('#more .edu'), eduHead = edu && edu.closest('section').querySelector('h2');
    if (edu) {
      const s = box(eduHead);
      // Encuadra la sección entera, desde su etiqueta, como las tarjetas.
      const t = node(mx, s.y + s.h / 2, { task: edu, need: 1.2, t: 0, done: edu.classList.contains('read'), frame: [box(edu.closest('section').firstElementChild).y, box(edu).b] });
      link(prev, t); prev = t; foldTasks.push(t);
    }
    const lastTask = edu || folds[folds.length - 1];
    const g2 = lastTask ? node(mx, box(lastTask).b + 26, { gate: foldTasks }) : prev;
    if (lastTask) link(prev, g2);
    const entry = work.first;
    const tasks = nodes.filter(n => n.task);
    things.push({ draw: now => drawDag(nodes, now) });
    const reads = { get done() { return tasks.filter(n => n.done).length; }, total: tasks.length };

    // Al final de "more about me" está el bucket de S3: el DAG desemboca ahí.
    const pr = box($('#more'));
    const fy = pr.b - 6, bw = 84, bx = Math.max(colL + 30, 24);
    floor(fy, [[bx, bw]]);
    // Airflow corre 3 segundos después de que el archivo cae al bucket (si los números ya se leyeron).
    const RUN = 3000, ready = () => reads.done >= reads.total;
    const bucket = { x: bx, y: fy, w: bw, d: 52, since: 0, ready };
    // Del bucket no se sale por los costados: la única salida es la compuerta de abajo.
    walls.push({ x: bx, y1: fy, y2: fy + 52 }, { x: bx + bw, y1: fy, y2: fy + 52 });
    const gateOpen = now => ready() && bucket.since && now - bucket.since >= RUN;
    const gate = ledge(bx + 4, fy + 48, bw - 8, { tick: now => { gate.solid = !gateOpen(now); }, land: () => { if (!ready()) say('↑ We skipped something.', 2000); } });
    things.push({ draw: now => drawBucket(bucket, gateOpen(now), now, RUN, reads) });
    const ly = Math.max(fy - 44, g2.y + 18), low = node(mx, ly), exit = node(bx + bw / 2, ly, { exit: true });
    link(g2, low); link(low, exit);

    // La tarea de Airflow carga el archivo hasta Snowflake (extract y load). La caja de Snowflake queda a la
    // izquierda del contacto, que tiene lugar libre, con su piso justo arriba de los botones.
    const bounds = { l: Math.max(0, colL - 44), r: Math.min(W, colR + 44) };
    const ctBtn = box($('#contact .btn'));
    // Si al costado del texto no entra (celu, tablet), va arriba del título del contacto, en el lugar que le deja el
    // padding de .playing .contact: así nunca queda encima del texto.
    const ctText = box($('#contact p')), ctTitle = box($('#contact h2')), beside = ctText.x - colL > 270;
    const wx = colL + 14, wy = beside ? ctBtn.b - 60 : ctTitle.y - 100 - 150, top = wy - 240;
    const sfW = Math.min(240, W - wx - 16), boxL = wx - 14, boxR = boxL + sfW, boxB = wy + 28;
    const hatch = beside ? { x: boxR - 74, w: 58 } : { x: boxL + 22, w: 58 }, hx = hatch.x + hatch.w / 2;
    const path = [[bx + bw / 2, fy + 56], [bx + bw / 2, top], [hx, top], [hx, top + 30]];
    // Con la salida a la izquierda (celu), el cartel va junto a la bajada del tubo para no pisar el de Snowflake.
    const pipe = { path, mouth: [bx + bw / 2, fy + 56], label: beside ? null : [bx + bw / 2 + 10, (fy + 56 + top - 30) / 2 + 4] };
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
        if (k === 0) once('Brr… Snowflake.', 3600, false);
        // dbt ayuda a moverse más rápido, literal: sus capas salen enseguida y de acá en más camina más rápido.
        if (k === 1) P.fast = true;
        if (now >= lockUntil) m.t += dt;
        if (m.t >= m.need) { m.built = true; m.solid = false; }
      };
    });
    // El fondo de la caja es techo para el que viene de abajo: Monte Carlo deja salir, nunca entrar.
    ceils.push({ x: boxL, y: boxB + 2, w: boxR - boxL });
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
    // Sin lugar al costado (celu), la tabla va debajo de la caja, del lado opuesto a Monte Carlo: hay que caminar hasta ella.
    const table = !beside ? { x: Math.max(hatch.x + hatch.w + 70, bounds.r - tw - 12), y: boxB + 66, w: tw, h: th, fill: 0, below: true } : tx === null ? { x: (W - tw) / 2, y: btn.b + 40, w: tw, h: th, fill: 0 } : { x: tx, y: btn.b - th, w: tw, h: th, fill: 0 };
    things.push({ draw: now => drawTable(table, now) });
    // Un cartel de ruta chico, entre Monte Carlo y los botones: al salir de la revisión, la punta indica para dónde seguir.
    const mcR = level_mc ? level_mc.x + level_mc.w : null, sw = 76, tip = 9, sh = 18;
    if (mcR !== null && btn.x - mcR > sw + tip + 40) {
      const sx = mcR + (btn.x - mcR - sw - tip) / 2, ground = btn.b, sy = ground - 44, mid = sx + sw / 2;
      things.push({ draw: () => {
        ctx.strokeStyle = ACCENT; ctx.lineCap = 'round'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mid, sy + sh); ctx.lineTo(mid, ground); ctx.moveTo(mid - 5, ground); ctx.lineTo(mid + 5, ground); ctx.stroke();
        ctx.shadowColor = 'rgba(94,234,212,.45)'; ctx.shadowBlur = 6; ctx.fillStyle = INK; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx + 4, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw + tip, sy + sh / 2); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + 4, sy + sh); ctx.arcTo(sx, sy + sh, sx, sy + sh - 4, 4); ctx.lineTo(sx, sy + 4); ctx.arcTo(sx, sy, sx + 4, sy, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.lineJoin = 'miter';
        text('contacts', mid + 1, sy + 13, ACCENT, 'center', '500 10px "JetBrains Mono", monospace');
      } });
    }
    ledge(table.x, table.y, tw, { hidden: true });
    floor(table.y + th, []);

    // Si se cae fuera del nivel, reaparece al comienzo de la última sección que pasó.
    for (const id of ['experience', 'projects', 'contact']) checkpoints.push({ y: box(document.getElementById(id)).y, x: colL + 30 });
    return { plats, things, walls, ceils, bounds, face, block, nodes, entry, mc: level_mc, pipe, bucket, table, checkpoints, colL, colR, docH: document.documentElement.scrollHeight };
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
      ctx.strokeStyle = shut ? 'rgba(148,163,184,.14)' : live ? 'rgba(94,234,212,.5)' : 'rgba(94,234,212,.2)'; ctx.lineWidth = 1;
      ctx.stroke();
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
      const d = dirOf(here, m), [ux, uy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[d], k = 20 + Math.sin(now / 250) * 2.5, r = 4;
      const x = here.x + ux * k, y = here.y + uy * k;
      ctx.save(); ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(94,234,212,.7)'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(x - ux * r - uy * r, y - uy * r - ux * r); ctx.lineTo(x, y); ctx.lineTo(x - ux * r + uy * r, y - uy * r + ux * r); ctx.stroke(); ctx.restore();
    });
  }
  // El portal es un remolino: un núcleo claro, brazos en espiral que giran hacia adentro y un borde que ondula.
  // Cuando traga a Little Bit, se abre un poco y brilla más.
  let portalFlare = 0;
  function drawPortal(cx, floorY, now) {
    const t = now / 1000, f = portalFlare ? Math.max(0, 1 - (now - portalFlare) / 900) : 0, open = 1 + Math.sin(Math.PI * Math.min(1, (now - portalFlare) / 900)) * .35 * (portalFlare ? 1 : 0);
    const cy = floorY - 30, rx = 17 * open, ry = 30 * open;
    ctx.save();
    // El halo de afuera.
    const halo = ctx.createRadialGradient(cx, cy, ry * .4, cx, cy, ry * 1.9);
    halo.addColorStop(0, `rgba(94,234,212,${.22 + f * .3})`); halo.addColorStop(1, 'rgba(94,234,212,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.9, ry * 1.9, 0, 0, Math.PI * 2); ctx.fill();
    // El cuerpo, con un borde que respira.
    ctx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const a = k / 48 * Math.PI * 2, w = 1 + .07 * Math.sin(a * 3 + t * 2.4) + .05 * Math.sin(a * 5 - t * 3.1);
      const x = cx + Math.cos(a) * rx * w, y = cy + Math.sin(a) * ry * w; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    const body = ctx.createRadialGradient(cx, cy, 1, cx, cy, ry);
    body.addColorStop(0, 'rgba(240,253,250,.95)'); body.addColorStop(.25, 'rgba(94,234,212,.85)'); body.addColorStop(.7, 'rgba(20,120,140,.75)'); body.addColorStop(1, 'rgba(56,90,200,.55)');
    ctx.fillStyle = body; ctx.shadowColor = 'rgba(94,234,212,.9)'; ctx.shadowBlur = 18 + f * 20; ctx.fill(); ctx.shadowBlur = 0;
    // Los brazos del remolino, recortados al cuerpo.
    ctx.clip(); ctx.translate(cx, cy); ctx.scale(rx / ry, 1); ctx.lineCap = 'round';
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u = k / 24, a = arm * Math.PI / 2 - t * (2.6 + f * 4) + u * 5.2, r = ry * (1 - u) * 1.05;
        const x = Math.cos(a) * r, y = Math.sin(a) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = arm % 2 ? 'rgba(11,17,32,.35)' : 'rgba(240,253,250,.55)'; ctx.lineWidth = arm % 2 ? 3 : 1.6; ctx.stroke();
    }
    ctx.restore();
    for (let k = 0; k < 3; k++) { const a = t * 2.2 + k * 2.1, tw = .5 + .5 * Math.sin(t * 5 + k), r = 1.25 + Math.sin(t * 1.3 + k) * .1; sparkle(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 1.5 + tw * 1.8, .5 + .5 * tw, a); }
    text('MCP', cx, floorY - 72, ACCENT, 'center', '600 10px "JetBrains Mono", monospace');
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
    if (all && b.since && !open) text(String(Math.ceil(left)), b.x - 26, b.y + b.d / 2 + 10, ACCENT, 'center', '600 28px "JetBrains Mono", monospace');
  }
  function drawPipe(p, now) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); p.path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    // Igual que las líneas del DAG: un trazo fino, sin halo ni rayas.
    ctx.strokeStyle = 'rgba(94,234,212,.35)'; ctx.lineWidth = 1; ctx.stroke();
    const [x2, y2] = p.path[2], [lx, ly] = p.label || [x2 + 16, y2 - 14];
    text('Airflow · load', lx, ly, ACCENT);
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
    text('id   name        status', t.x + 8, t.y + row - 5, MUTED);
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
  // Una estrellita de cuatro puntas con brillo: de esto están hechos el piso, las paredes y el portal.
  // La estela del puntito en el DAG: chispas que quedan atrás, crecen un poco y se apagan.
  let trail = [], trailAt = 0;
  function drawTrail(now) {
    const dt = Math.min(.05, (now - (trailAt || now)) / 1000); trailAt = now;
    trail = trail.filter(p => (p.t += dt) < p.life).slice(-90);
    for (const p of trail) { p.x += p.vx * dt; p.y += p.vy * dt; const k = p.t / p.life, g = Math.sin(Math.PI * k); sparkle(p.x, p.y, p.r * (.5 + .5 * g), g, p.spin + k, p.tint || 0); }
  }
  // Los tres colores de la cara de Luca: verde, blanco y lavanda, en la misma proporción.
  const TINTS = [['#5eead4', 'rgba(94,234,212,.8)'], ['#e2e8f0', 'rgba(226,232,240,.6)'], ['#a5b4fc', 'rgba(165,180,252,.7)']];
  const tintOf = u => u < .5 ? 0 : u < .8 ? 1 : 2;
  function sparkle(x, y, r, a, spin, tint = 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(spin);
    ctx.shadowColor = TINTS[tint][1]; ctx.shadowBlur = r * 3; ctx.fillStyle = TINTS[tint][0];
    ctx.beginPath(); ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0); ctx.quadraticCurveTo(0, 0, 0, r); ctx.quadraticCurveTo(0, 0, -r, 0); ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.fill(); ctx.restore();
  }
  function starLine(x1, y1, x2, y2, base, now) {
    const horiz = y1 === y2, fx = P.x + S / 2, fy = horiz ? P.y + S : P.y + S / 2, R = horiz ? 110 : 90, step = 11;
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / step)), a0 = ctx.globalAlpha;
    // Solo los puntos de la línea cerca de él: el resto del piso no existe a la vista.
    const along = horiz ? fx - x1 : fy - y1, from = Math.max(0, Math.floor((along - R) / step)), to = Math.min(n, Math.ceil((along + R) / step));
    for (let i = from; i <= to; i++) {
      const u = i / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u;
      const near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / R);
      // Dentro del DAG (o volando hacia él) no hay piso ni paredes: el puntito viaja por sus líneas, sin chispas al costado.
      if (near <= 0 || mode !== 'play' || P.rail || P.dive || P.enter) continue;
      const seed = Math.sin((x1 + i * 7.3) * 12.9898 + (y1 + i * 3.1) * 78.233) * 43758.5, rnd = seed - Math.floor(seed);
      const g = near * near * (3 - 2 * near), far = (1 - g) * (1 - g) * 60, ang = rnd * Math.PI * 2;
      const tw = .7 + .3 * Math.sin(now / 140 + i * 1.9);
      sparkle(x + Math.cos(ang) * far, y + Math.sin(ang) * far - (horiz ? 1 : 0), (1 + g * 3.4) * tw, a0 * Math.min(1, g * 1.4), rnd * 3 + g, tintOf((rnd * 13.7) % 1));
    }
    if (!base) return;
    // Cornisas que hay que ver de antes: unas pocas estrellitas quietas que titilan.
    for (let k = 0; k <= Math.max(1, Math.round(len / 34)); k++) {
      const m = Math.max(1, Math.round(len / 34)), u = k / m, tw = .5 + .5 * Math.sin(now / 520 + k * 2.3 + x1);
      sparkle(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 1.4 + tw * 1.6, a0 * base * (.45 + .55 * tw), k, tintOf(Math.abs(Math.sin(k * 12.9898 + x1 * .37) * 43758.5) % 1));
    }
  }
  function drawPlat(p, now) {
    if (p.crate) return;
    if (p.hidden) { starLine(p.x, p.y, p.x + p.w, p.y, 0, now); return; }
    if (p.kind === 'model') {
      if (p.built) { text(`✓ ${p.label ? p.label() : p.name}`, p.x + 12, p.y + 18, ACCENT); return; }
      ctx.fillStyle = 'rgba(148,163,184,.1)'; ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, p.w - 12, 6, 3); ctx.fill(); ctx.stroke();
      if (p.t) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, (p.w - 12) * Math.min(1, p.t / p.need), 6, 3); ctx.fill(); }
      text(p.label ? p.label() : p.name, p.x + 12, p.y + 20, MUTED);
      if (p.label && !p.built) snowflake(p.x + p.w - 18, p.y + 16, 5, p.t ? ACCENT : MUTED);
      return;
    }
    starLine(p.x, p.y, p.x + p.w, p.y, p.floor ? 0 : p.solid ? .9 : .6, now);
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
      for (const w of level.walls) { const y1 = Math.max(w.y1, top - 20), y2 = Math.min(w.y2, top + H + 20); if (y2 > y1) starLine(w.x, y1, w.x, y2, 0, now); }
      // Los bordes de la pantalla solo aparecen cuando se los toca.
      // Si ahí ya hay una pared, el borde no se dibuja encima: una sola línea de chispas, nunca dos pegadas.
      for (const x of [level.bounds.l, level.bounds.r]) if (!level.walls.some(w => Math.abs(w.x - x) < 30 && w.y1 < P.y + S && w.y2 > P.y)) starLine(x, top, x, top + H, 0, now);
      // Lo que queda lejos del muñequito se apaga, para que el texto de la página se lea tranquilo.
      for (const p of level.plats) {
        if (!seen(p.y)) continue;
        ctx.globalAlpha = fade = p.floor ? 1 : Math.max(0.22, Math.min(1, 1 - (Math.abs(p.y - P.y) - 160) / 260));
        drawPlat(p, now);
      }
      ctx.globalAlpha = fade = 1;
      ctx.restore();
    } else if (level && P.on && !P.on.floor && !P.on.hidden && !P.on.crate) drawPlat(P.on, now);
    if (mode === 'play' && P.rail && !P.rail.to && P.rail.dots && P.rail.dots.length) {
      const r = P.rail, d = r.dots, n = r.at;
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(94,234,212,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, d[d.length - 1].y); ctx.stroke();
      d.forEach((p, k) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = k <= r.ri ? ACCENT : INK; ctx.strokeStyle = k <= r.ri ? ACCENT : MUTED; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
    // La estela del muñequito cuando atraviesa el retrato.
    if (level) drawTrail(now);
    if (gift && (mode === 'play' || mode === 'intro')) {
      const cx = P.x + S / 2, cy = P.y + S / 2;
      let left = 0;
      for (const g of gift.sparks) {
        if (g.done) continue;
        left++;
        const u = (now - g.from) / (g.to - g.from);
        if (u < 0) continue;
        if (u >= 1) { g.done = true; P.squash = Math.max(P.squash, .25); continue; }
        // Curva hacia donde está él ahora: si se mueve, la estrellita lo sigue.
        const mx = (g.x + cx) / 2 + g.bend * .4, my = Math.min(g.y, cy) - 80 - Math.abs(g.bend) * .3;
        const at = v => { const e = 1 - Math.pow(1 - v, 1.3); return [(1 - e) * (1 - e) * g.x + 2 * (1 - e) * e * mx + e * e * cx, (1 - e) * (1 - e) * g.y + 2 * (1 - e) * e * my + e * e * cy]; };
        const [x, y] = at(u), [tx, ty] = at(Math.max(0, u - .14)), e = u; // ritmo parejo: la estela mide lo mismo todo el camino
        // Cada una deja una estela corta hacia atrás: el camino desde la cara se lee de un vistazo.
        ctx.save(); ctx.globalAlpha = .45 * Math.min(1, u * 4); ctx.strokeStyle = TINTS[g.tint][0]; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
        sparkle(x, y, g.r * (1 - e * .3), Math.min(1, u * 4), g.spin + u * 4, g.tint);
      }
      // El halo crece mientras le van llegando y se apaga un momento después del aterrizaje.
      const t = (now - gift.land) / 1000, glow = Math.max(0, Math.min(1, (t + .8) / .8)) * Math.max(0, Math.min(1, (2.6 - t) / .6));
      if (glow > 0) { ctx.save(); const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 1.6); gr.addColorStop(0, `rgba(94,234,212,${.35 * glow})`); gr.addColorStop(1, 'rgba(94,234,212,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, S * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      if (!left && t > 2.6) gift = null;
    }
    P.trail.forEach((t, k) => { ctx.globalAlpha = (k / P.trail.length) * 0.35; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(t[0] + 4, t[1] + 4, S - 8, S - 8, 5); ctx.fill(); });
    ctx.globalAlpha = 1;
    // Esperando, el muñequito se asoma por detrás del título, listo para arrancar. Al terminar queda solo el de la nota.
    // Esperando no se dibuja en ningún otro lado: hasta que se asoma, no está.
    // Esperando no está en la página: aparece solo cuando alguien toca Play.
    if (mode === 'wait') { /* escondido hasta que se pida */ }
    else if (mode === 'wait' && drifting(now)) {
      const cx = drift.x + S * FB() / 2, cy = scrollY + drift.y + S * FB() / 2;
      ctx.save(); ctx.globalAlpha = FA() * Math.min(1, (now - drift.since) / 700) * (W < 768 ? drift.alpha ?? 1 : 1);
      ctx.translate(cx, cy); ctx.rotate(drift.a); ctx.scale(FB(), FB());
      drawPk(-S / 2, -S / 2, now); ctx.restore();
    } else if (mode === 'wait') {
      // Sube desde detrás de las letras, y después cada tanto da un saltito para espiar.
      const rise = 1 - Math.min(1, (now - peekFrom()) / 650), up = (1 - (1 - rise) ** 3) * S * BIG;
      const ws = { ...waitSpot() }; ws.y += up;
      const hop = still ? 0 : (now % 1600 < 520 ? Math.sin((now % 1600) / 520 * Math.PI) * 12 : 0);
      P.face = -1;
      // El recorte solo existe mientras sube: ya arriba, nada lo corta (ni su brillo).
      ctx.save(); if (rise > 0) { ctx.beginPath(); ctx.rect(ws.x - 80, ws.ledge - 160, S * BIG + 160, 160); ctx.clip(); }
      ctx.translate(ws.x + S / 2, ws.y + S - hop); ctx.scale(BIG, BIG); ctx.translate(-(ws.x + S / 2), -(ws.y + S));
      drawPk(ws.x, ws.y, now); ctx.restore();
    } else if (mode !== 'done' && !endAt && seen(P.y)) {
      const k = P.enter ? Math.min(1, P.enter.t) : 0, g = P.grow ? Math.min(1, (now - P.grow) / 350) : 1;
      if (g >= 1) P.grow = 0;
      const sc = P.enter ? 1 - k * .92 : .08 + .92 * (1 - (1 - g) ** 3), rot = P.enter ? k * k * Math.PI * 3 : (1 - g) * -Math.PI;
      if (sc < 1 || rot) { ctx.save(); ctx.translate(P.x + S / 2, P.y + S / 2); ctx.rotate(rot); ctx.scale(sc, sc); drawPk(-S / 2, -S / 2, now); ctx.restore(); }
      else drawPk(P.x, P.y, now);
    }
    labels = labels.filter(l => now < l.until);
    // Los diálogos: globos apilados sobre el muñequito, con su entrada, sin salirse de la pantalla ni tapar el menú.
    ctx.font = `500 ${W < 768 ? 12 : 15}px "JetBrains Mono", monospace`; ctx.textBaseline = 'middle'; // mide con la letra del globo (en el celu es más chica)
    if (mode === 'play' && now < lockUntil) {
      const k = Math.max(0, Math.min(1, (now - lockFrom) / (lockUntil - lockFrom)));
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.beginPath(); ctx.arc(P.x + S / 2, P.y + S / 2, S * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(P.x + S / 2, P.y + S / 2, S * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    }
    if (tip && now >= tip.from && Object.values(keys).some(Boolean)) tip = null;
    if (tip && now >= tip.from && mode === 'play' && !P.rail && !P.dive && !P.enter) {
      // Cada flecha aparece del lado al que apunta: un chevrón fino con brillo, que se asoma hacia ese lado.
      const k = Math.min(1, (now - tip.from) / 260), cx = P.x + S / 2, cy = P.y + S / 2, gap = S * 0.95 + 12;
      const DIRS = { '←': [-1, 0], '→': [1, 0], '↑': [0, -1], '↓': [0, 1] };
      ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ACCENT; ctx.shadowColor = 'rgba(94,234,212,.8)'; ctx.shadowBlur = 8;
      tip.keys.forEach(key => {
        const [ux, uy] = DIRS[key] || [0, 0], t = (now / 900) % 1;
        // Dos chevrones: el de afuera sale despacio y se apaga, el de adentro queda.
        [[0, .9], [t * 8, (1 - t) * .6]].forEach(([push, a]) => {
          const d = gap + push, x = cx + ux * d, y = cy + uy * d, r = 5;
          ctx.globalAlpha = k * a; ctx.beginPath();
          ctx.moveTo(x - ux * r - uy * r, y - uy * r - ux * r); ctx.lineTo(x, y); ctx.lineTo(x - ux * r + uy * r, y - uy * r + ux * r); ctx.stroke();
        });
      });
      ctx.restore();
    }
    // En el celu, mientras recorre tarjetas y pasos, el globo va en la franja libre que la cámara deja entre el menú y
    // lo que se lee, apenas arriba de Little Bit: así no tapa el texto y sigue pegado a él.
    labels.forEach((l, k) => {
      const a = Math.min(1, (l.until - now) / FADE), rise = Math.max(0, Math.min(1, (now - l.from) / POP)), pop = 1 - (1 - rise) ** 3, half = ctx.measureText(l.text).width / 2 + 16;
      const cx = Math.max(half + 8, Math.min(W - half - 8, P.x + S / 2)), up = 0;
      // Si arriba no entra (queda debajo del menú y tapa la línea de él), en el celu el globo va debajo.
      // En el celu, andando por el riel, el globo va siempre debajo de Little Bit: no salta de arriba a abajo mientras baja.
      const below = W < 768 && (P.rail || P.y - 40 < top + 92);
      const y = (below ? P.y + S + 30 : Math.max(top + 92 + up, P.y - 40 - up)) + (1 - pop) * 6;
      // El globo es vidrio de verdad (un elemento de la página, con desenfoque), no un dibujo en el lienzo.
      const el = bubbles[k] || (bubbles[k] = Object.assign(document.createElement('div'), { className: 'pk-bubble' }));
      if (!el.isConnected) document.body.append(el);
      if (el.dataset.text !== l.text) { el.dataset.text = l.text; el.innerHTML = chips(l.text); }
      el.style.translate = `${cx}px ${y}px`; el.style.opacity = a * pop; el.style.scale = 0.97 + pop * 0.03;
    });
    for (let k = labels.length; k < bubbles.length; k++) bubbles[k].style.opacity = 0;
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
  // How I work: cada regla es un puntito sobre la misma línea. Little Bit se para en una y con ↑ y ↓ va de regla en
  // regla cuando quiere: no hay espera.
  const ruleTabs = () => [...document.querySelectorAll('#how-i-work .pr-item')];
  // Mientras el acordeón del celu se acomoda, cada regla se toma en su lugar final: así nada se pasa de largo y vuelve.
  const ruleDots = n => { if (!(n.fold && n.task.id === 'how-i-work' && n.task.open)) return null; const tabs = ruleTabs(), st = tabs[0] && tabs[0].closest('.principles').settle, fin = !!st; return tabs.map((el, k) => { const b = fin ? st.at[k] : box(el); return { x: n.x, y: b.y + Math.min(b.h, 52) / 2 }; }); };
  const liveY = n => { if (!n.fold) return n.y; const b = box(n.task.querySelector('summary')); return b.y + b.h / 2; };
  const showRuleTab = k => { const tab = ruleTabs()[k]; if (tab && !tab.classList.contains('on')) tab.click(); };
  // Las tarjetas de una parada: una sola, o todas las de la fila cuando la parada las junta.
  const cards = n => [n.task, ...(n.mates || [])];
  function railStep(dt, control, now) {
    const r = P.rail;
    // El viaje arranca apenas se toca la flecha y la cámara lo acompaña. Lo único que espera a la cámara es la
    // lectura de una tarea, y nunca para siempre: si el jugador scrolleó con el dedo (la cámara quedó libre) o el
    // celu no deja llegar al lugar exacto, a los 0,9 s corre igual.
    const settled = n => {
      if (camFree || now < swapUntil) return true;
      // Arranca apenas la tarjeta está a la vista: esperar a que la cámara llegue al píxel exacto demoraba la carga,
      // sobre todo en el celu, donde la cámara casi nunca llega justo.
      const t = frameTarget(n), c = n.task && n.task.getBoundingClientRect(), seen = c && c.top >= 50 && c.top < H * .6;
      if (t === null || seen || Math.abs(scrollY - t) <= 40) { r.waitFrom = 0; return true; }
      if (!r.waitFrom) r.waitFrom = now;
      if (now - r.waitFrom > 350) { r.waitFrom = 0; return true; }
      return false;
    };
    if (r.to) {
      let a = r.at, b = r.to;
      // Entre dos desplegables el tramo va de donde quedó en pantalla a su destino ya acomodado.
      if (r.live) { a = r.live.a; b = r.live.b; }
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      // En el DAG de tarjetas ningún tramo tarda más de tres cuartos de segundo (en la compu y en el celu). El resto, a su ritmo.
      r.d += (r.at.dag && r.to.dag ? Math.max(RAIL, len / .75) : RAIL) * dt;
      const u = Math.min(1, r.d / (len || 1));
      P.x = a.x + (b.x - a.x) * u - S / 2; P.y = a.y + (b.y - a.y) * u - S / 2; P.form = 'dot';
      // Lo de dbt lo dice ya en camino, a mitad del primer tramo después de la compuerta.
      if (r.dbt && u >= .5) { r.dbt = false; once('I ❤️ dbt. Raw in, clean out.'); }
      if (Math.random() < .7) trail.push({ x: P.x + S / 2 + (Math.random() - .5) * 6, y: P.y + S / 2 + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 24, vy: (Math.random() - .5) * 24, t: 0, life: .5 + Math.random() * .5, r: 1.6 + Math.random() * 2.2, spin: Math.random() * 3, tint: tintOf(Math.random()) });
      if (u < 1) return;
      const from = r.at, n = r.at = r.to, live = r.live; r.to = null; r.d = 0; r.live = null; r.ri = from && from.y > n.y ? -1 : 0; r.dots = null;
      // Después del acordeón el nodo quedó medido con el otro desplegable: se queda donde terminó el tramo.
      // Un desplegable puede haber quedado medido con el otro abierto: al llegar, su nodo toma el lugar real del título.
      if (n.fold) n.y = liveY(n);
      if (live) P.x = n.x - S / 2; else onNode(n);
      if (n.exit) { P.rail = null; P.vy = 120; P.form = 'pk'; return; }
      // Si la tarea trae frase, un solo anillo cubre las dos cosas: la frase y la lectura.
      if (n.task && !n.fold && n.task.dataset.say) { once(n.task.dataset.say); if (!n.done) hold(n.need * 1000 + 500); }
      if ((n.bus || n.start) && from.gate && from.y < n.y) r.dbt = true;
      if (n.task && !n.done) { r.fresh = !!n.fold; P.form = 'pk'; return; }
      if (n.gate && from.y < n.y && !gateOpen(n)) gateHint(n);
      const ahead = n.links.filter(m => m !== from);
      if (n.links.length === 2 && !n.task && !n.bus && (!n.gate || (from.y <= n.y && gateOpen(n)))) r.to = ahead[0];
      else r.fresh = true;
      if (!r.to) P.form = 'pk';
      return;
    }
    const n = r.at;
    if (n.fold && !n.task.open) n.task.open = true;
    if (n.fold && !n.done) { n.done = true; n.task.classList.add('read'); const line = n.task.dataset.say || "↓ When you're done."; if (!said.has(line)) { said.add(line); say(line, 3500); } }
    const dots = r.dots = ruleDots(n);
    if (dots && dots.length) {
      // Si llegó desde abajo (subiendo desde Education), arranca en la última regla.
      r.ri = r.ri < 0 ? dots.length - 1 : Math.min(r.ri || 0, dots.length - 1); showRuleTab(r.ri);
      P.x = n.x - S / 2; P.y += (dots[r.ri].y - S / 2 - P.y) * Math.min(1, dt * (W < 768 ? 5 : 10));
    }
    if (n.task && !n.done) {
      if (r.readyFor !== n) { if (!settled(n)) return; r.readyFor = n; }
      cards(n).forEach(el => el.classList.add('lit'));
      if (now < lockUntil) { n.t = n.need; return; }
      n.t += dt;
      if (n.t >= n.need) { n.done = true; cards(n).forEach(el => { el.classList.add('read'); el.classList.remove('lit'); }); }
      return;
    }
    if (!control) return;
    // Al frenar en un nodo hay que soltar la tecla para seguir: un toque nunca cruza dos tramos.
    if (r.fresh && !queued) { if (keys.left || keys.right || keys.jump || keys.down) return; r.fresh = false; }
    r.fresh = false;
    const want = keys.left ? 'left' : keys.right ? 'right' : keys.jump ? 'up' : keys.down ? 'down' : queued;
    queued = null;
    if (dots && dots.length && ((want === 'down' && r.ri < dots.length - 1) || (want === 'up' && r.ri > 0))) { r.ri += want === 'down' ? 1 : -1; r.fresh = true; return; }
    const m = want && n.links.find(q => dirOf(n, q) === want);
    if (!m) return;
    if (n.gate && m.y > n.y && !gateOpen(n)) { n.nudge = now; gateHint(n); return; }
    if (n.task) cards(n).forEach(el => el.classList.remove('lit'));
    // Entre desplegables es un acordeón: uno se pliega mientras el otro se abre, en los dos sentidos, sin que la
    // página quede nunca con los dos cerrados. La cámara espera quieta: si persiguiera las alturas a mitad de la
    // animación, saltaría.
    const swap = n.fold && m.fold;
    // Entre How I work y Education el cambio es instantáneo y Little Bit queda quieto en pantalla: la página se acomoda
    // en el mismo cuadro para que su destino (la regla 6 o el título de Education) quede a un saltito de 60 px. Así el
    // tramo es siempre corto, en la compu y en el celu (donde la escena de la regla va debajo y cambia los altos), y
    // después la cámara encuadra con un solo deslizamiento.
    if (swap) {
      swapUntil = now + 120;
      if (swapping) { swapping.cancel(); swapping = null; }
      [n, m].forEach(f => f.task.classList.remove('swap'));
      const up = m.y < n.y, onScreen = P.y - scrollY;
      if (up && m.task.id === 'how-i-work') showRuleTab(ruleTabs().length - 1);
      n.task.open = false; m.task.open = true;
      const d = up ? ruleDots(m) : null, dest = d && d.length ? d[d.length - 1].y : liveY(m);
      scrollTo({ top: Math.max(0, dest - S / 2 - (onScreen + (up ? -60 : 60))), behavior: 'instant' }); expected = scrollY;
      P.y = scrollY + onScreen;
      r.live = { a: { x: n.x, y: P.y + S / 2 }, b: { x: m.x, y: dest } };
    } else {
      if (n.fold) n.task.open = false;
      if (m.fold) m.task.open = true;
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
    const text = `${go ? `${ARROW[dirOf(n, go.first)]} ` : ''}${left} ${left > 1 ? 'cards' : 'card'} left back there.`;
    if (!labels.some(l => l.text === text)) say(text, HOLD);
  }
  // En la portada dice una sola cosa antes de entrar: al acercarse al portal, que está junto a la cara.
  const HANDSOME = "Who's that guy?";
  // La flechita apunta a la cara desde donde está él: en el celu la cara queda arriba; en la compu, al costado.
  const faceArrow = () => { if (!portrait) return '←'; const b = box(portrait), dx = b.x + b.w / 2 - (P.x + S / 2), dy = b.y + b.h * .4 - (P.y + S / 2); return Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? '↑' : '↓') : dx < 0 ? '←' : '→'; };
  const faceLine = f => Math.abs(P.x + S / 2 - (f.x2 - 15)) < 150 ? HANDSOME : null;
  function request() {
    if (P.enter || P.dive || P.ride || endAt) return null;
    if (P.rail) {
      const r = P.rail, n = r.at;
      if (r.to || (n.task && !n.done)) return null;
      if (n.fold) return "↓ When you're done.";
      const go = nextOnRail(n);
      return go && `${ARROW[dirOf(n, go.first)]} ${go.task ? 'More tasks.' : 'I smell a bucket.'}`;
    }
    if (!P.ground || P.form === 'file' || (P.on && P.on.kind === 'model' && !P.on.built)) return null;
    const f = level.face, mc = level.mc, t = level.table;
    if (f && P.y < level.entry.y) { tip = { keys: [toward(f.x2 - 15)], from: performance.now() }; return null; }
    return mc.state.checked ? `${toward(t.x)} Almost there!` : `${toward(mc.x + mc.w / 2)} Exit's this way.`;
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
      if (now - endAt > 7500) finish();
      return;
    }
    if (P.enter) {
      const e = P.enter, f = level.face, to = f.at ? [f.at[0] - S / 2, f.at[1] - S / 2] : e.from;
      e.t += dt / .55; const k = Math.min(1, e.t), ease = k * k * (3 - 2 * k);
      P.x = e.from[0] + (to[0] - e.from[0]) * ease; P.y = e.from[1] + (to[1] - e.from[1]) * ease;
      if (k >= 1) {
        P.enter = null; P.grow = now; P.vx = 0; P.vy = -320;
        P.dive = divePath(f.via ? [f.via[0] - S / 2, f.via[1] - S / 2] : null, [level.entry.x - S / 2, level.entry.y - S / 2]);
      }
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
        onNode(level.entry); P.rail = { at: level.entry, to: null, d: 0 }; once('Ooh, a DAG!');
      }
      return;
    }
    if (P.ride) {
      // Al pasar por las notas baja el ritmo para que se vean, y comenta al pasar sin frenar.
      const nb = $('#notes') && box($('#notes')), inNotes = nb && P.y > nb.y - 40 && P.y < nb.b;
      if (inNotes && nb && P.y > nb.y + 60) once("Notes? I'll read those later.", 2600, false);
      P.ride.d += dt * (inNotes ? 240 : 620);
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
    // Al ver la cara frena derrapando (no en seco, que parece una pared) y recién quieto se da vuelta a mirarla.
    if (P.skid) { const u = (now - P.skid.t0) / 260; if (u < 1) { P.vx = P.skid.v * (1 - u) * (1 - u); if (P.ground && P.vx && Math.random() < .6) trail.push({ x: P.x + S / 2, y: P.y + S - 1, vx: -Math.sign(P.vx) * (10 + Math.random() * 20), vy: -(10 + Math.random() * 20), t: 0, life: .4 + Math.random() * .4, r: 1.4 + Math.random() * 1.8, spin: Math.random() * 3, tint: tintOf(Math.random()) }); } else { P.face = P.skid.look; P.skid = null; } }
    const prevX = P.x;
    P.x += P.vx * dt;
    for (const w of level.walls) {
      if (P.y + S <= w.y1 || P.y >= w.y2) continue;
      if (prevX + S <= w.x && P.x + S > w.x) P.x = w.x - S;
      if (prevX >= w.x && P.x < w.x) P.x = w.x;
    }
    P.x = Math.max(level.bounds.l, Math.min(level.bounds.r - S, P.x));
    // Un salto o una bajada tocados mientras hablaba se cumplen apenas puede moverse.
    if (control && (keys.jump || queued === 'up') && P.ground) { P.vy = -JUMP; P.ground = false; P.squash = -0.7; }
    if (control && (keys.down || queued === 'down') && P.ground && P.on && !P.on.floor) {
      const p = P.on.main || P.on, done = p.ready ? p.ready() : p.need === undefined || p.t >= p.need;
      if (done) { P.dropUntil = now + 260; P.dropFrom = P.on; P.ground = false; keys.down = false; }
    }
    if (control) queued = null;
    const prevBottom = P.y + S;
    P.vy = Math.min(P.vy + GRAVITY * dt, 560);
    P.y += P.vy * dt;
    const was = P.on; P.on = null; P.ground = false;
    if (P.vy < 0) for (const c of level.ceils) if (prevBottom - S >= c.y && P.y < c.y && P.x + S > c.x && P.x < c.x + c.w) { P.y = c.y; P.vy = 0; }
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
    if (control && P.ground && dir) {
      if (Math.random() < .55) trail.push({ x: P.x + S / 2 + (Math.random() - .5) * S * .8, y: P.y + S - 1, vx: -dir * (8 + Math.random() * 18), vy: -(14 + Math.random() * 26), t: 0, life: .55 + Math.random() * .55, r: 1.4 + Math.random() * 2, spin: Math.random() * 3, tint: tintOf(Math.random()) });
    }
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
    // Al acercarse a la cara la mira y pregunta quién es, caminando o en el aire. Sin esa pregunta el portal no abre.
    if (f && control && P.y < level.entry.y && now >= missionUntil) { const t = faceLine(f); if (t && !said.has(t)) { said.add(t); P.skid = { v: P.vx, t0: now, look: (f.x1 + f.x2) / 2 < P.x + S / 2 ? -1 : 1 }; if (!P.vx) P.face = P.skid.look; P.squash = -.35; say(`${faceArrow()} ${t}`, 2200); hold(4400); setTimeout(() => { if (mode === 'play') say(`${faceArrow()} My creator?`, 2600); }, 2100); } } // se frena derrapando y se da vuelta a mirar: se nota que es por la cara, no un choque decirlo no lo deja quieto
    if (f && control && said.has(HANDSOME) && (!P.ground || !f.jump) && P.x + S / 2 > f.x1 && P.x + S / 2 < f.x2 && P.y + S / 2 > f.y1 && P.y + S / 2 < f.y2) {
      P.enter = { t: 0, from: [P.x, P.y] }; portalFlare = now; P.on = null; P.ground = false; P.vy = 0;
      return;
    }
    const mc = level.mc;
    // La caja solo se deja por Monte Carlo: pasar su borde de abajo es haber salido, a cualquier velocidad.
    if (mc && !mc.state.checked && P.y > mc.y) mc.state.checked = true;
    // La tabla recién se ve al avanzar un poco: ahí la encuentra, sin frenar.
    const found = 'My table! Finally!';
    if (mc && mc.state.checked && !said.has(found) && P.x > Math.min(mc.x + mc.w + 100, level.table.x - 40)) { said.add(found); say(found, 5000); }
    // En el celu la tabla queda cerca: al aterrizar frena, la mira y lo dice antes de ir, así no entra sin contexto.
    if (level.table.below && mc && mc.state.checked && !said.has(found) && P.ground) { said.add(found); P.vx = 0; P.face = 1; P.squash = -.35; say(found, 3000); hold(1800); }
    const b = level.bucket, cx = P.x + S / 2;
    const inside = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    if (!inside) b.since = 0; else if (!b.since && b.ready()) { b.since = now; once('S3? Am I in AWS?', 3600, false); }
    const inBucket = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    P.form = inBucket ? 'file' : 'pk';
    if (inBucket && P.y + S > b.y + b.d + 4) { P.ride = { d: 0 }; P.form = 'dot'; }

    const m = level.table;
    if (!won && P.x + S > m.x - 6 && P.x < m.x + m.w + 6 && P.y + S > m.y - 10 && P.y < m.y + m.h) {
      won = true; keys = {}; endAt = now; say("There's no place like home."); P.x = m.x + m.w / 2 - S / 2; P.y = m.y - S; P.vy = 0;
    }
    for (const c of level.checkpoints) if (P.y > c.y + 40) level.respawn = c;
    if (P.y > level.docH + 60) { const c = level.respawn || level.checkpoints[0]; P.x = c.x; P.y = c.y + 30; P.vy = 0; }
  }

  // ---------- cámara: sigue al muñequito pero deja leer ----------
  function frameTarget(n) {
    const open = n && n.fold && n.task.open && box(n.task);
    if (!n || !(open || n.frame)) return null;
    let [y1, y2] = open ? [open.y, open.b] : n.frame;
    const nav = 64, max = document.documentElement.scrollHeight - H;
    // En el celu lo que se ve termina en los botones, no en el borde: el cuadro se centra en ese hueco. Si con el
    // título de la sección no entra, se encuadra la tarjeta sola, entera.
    const padEl = W < 768 && document.querySelector('.pad:not([hidden])'), low = padEl ? padEl.getBoundingClientRect().top : H, margin = padEl ? 12 : 40;
    if (padEl && !open && n.task && y2 - y1 + margin >= low - nav) { const c = box(n.task); y1 = Math.min(y2, c.y - 8); }
    const t = y2 - y1 + margin < low - nav ? (y1 + y2) / 2 - (low + nav) / 2 : y1 - nav - 24;
    // El cuadro manda, pero el nodo queda siempre a la vista, con lugar arriba para los globos y abajo para los botones.
    const room = padEl ? nav + 70 : Math.max(nav + 90, Math.min(H * 0.3, 190)), floorRoom = W < 760 ? 150 : 90;
    return Math.max(0, Math.min(max, Math.min(n.y - room, Math.max(n.y - (H - floorRoom), t))));
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
    // En las reglas de How I work también se centra el desplegable abierto, pero sin perder de vista a Little Bit.
    let framed = P.rail ? frameTarget(P.rail.to || P.rail.at) : null;
    if (framed !== null && (P.rail.to || (P.rail.dots && P.rail.dots.length))) {
      const room = Math.max(64 + 90, Math.min(H * 0.3, 190)), floorRoom = W < 760 ? 150 : 90;
      framed = Math.max(P.y - (H - floorRoom), Math.min(P.y - room, framed));
    }
    if (framed !== null) target = framed;
    // En el celu, en las reglas de How I work, la escena va debajo de la regla elegida: la regla queda arriba, justo
    // debajo del menú, y su escena entera a la vista sobre los controles de abajo.
    let ease = 7;
    if (W < 768 && P.rail && !P.rail.to && P.rail.dots && P.rail.dots[P.rail.ri]) { target = P.rail.dots[P.rail.ri].y - 64 - 70; ease = 3; } // calmo: que se note el cambio de regla
    // Igual en un desplegable sin reglas (Education): su título arriba, debajo del menú, y el contenido a la vista.
    else if (W < 768 && P.rail && !P.rail.to && P.rail.at.fold && !P.rail.dots) target = box(P.rail.at.task.querySelector('summary')).y - 64 - 52;
    if (target === null) return;
    scrollTo(0, Math.max(0, scrollY + (target - scrollY) * Math.min(1, dt * ease)));
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
  // Un desplegable figura cerrado antes de terminar de plegarse: se mide recién cuando terminó la animación.
  let pendingBuild = false, settleAt = 0;
  const foldOpen = () => [...document.querySelectorAll(FOLDS)].some(f => f.open);
  const remeasure = () => {
    if (!level) return;
    if (foldOpen() || (P.rail && P.rail.to) || performance.now() < Math.max(swapUntil, settleAt)) { pendingBuild = true; return; }
    pendingBuild = false; const snap = snapshot(); rebuild(); apply(snap);
  };
  // Si se entra a un proyecto y se vuelve, el muñequito y lo ya leído siguen donde estaban.
  const SAVE = 'pk-progress', FOLDS = '#more .fold', TASKS = `#experience .card.big, #projects .card, ${FOLDS}, #more .edu`;
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
  addEventListener('pagehide', () => { const snap = (mode === 'wait' && !paused) || mode === 'intro' ? null : snapshot(); try { if (snap) sessionStorage.setItem(SAVE, JSON.stringify(snap)); } catch (e) {} });
  function restore() {
    let snap = null;
    try { snap = JSON.parse(sessionStorage.getItem(SAVE) || 'null'); } catch (e) {}
    if (!snap) return;
    const cards = document.querySelectorAll(TASKS);
    snap.reads.forEach(k => { if (cards[k]) cards[k].classList.add('read'); });
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    void document.body.offsetHeight;
    rebuild(); apply(snap); mode = 'idle';
    // Si la partida estaba en pausa, vuelve a flotar como después de salir (no quieto donde quedó): un toque la retoma.
    if (snap.done) finish(); else if (snap.playing) start(); else { mode = 'play'; stop(); }
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
    mode = 'play'; paused = false; keys = {}; camFree = false; expected = scrollY;
    document.body.classList.add('playing'); pad.hidden = !touch; hint.classList.remove('on');
  }
  // Salir del juego no lo deja quieto donde estaba: vuelve a flotar por la pantalla y guarda la partida.
  // Tocarlo de nuevo retoma desde el mismo lugar.
  let paused = false;
  function stop() {
    if (mode !== 'play') return;
    mode = 'wait'; paused = true; keys = {}; labels = [];
    drift.ready = true; drift.since = 0;
    drift.x = Math.max(24, Math.min(W - S * FB() - 24, P.x)); drift.y = Math.max(90, Math.min(H - S * FB() - 110, P.y - scrollY));
    document.documentElement.style.scrollBehavior = '';
    document.body.classList.remove('playing'); pad.hidden = true;
  }
  // Vuelve todo al estado de la página recién cargada: el muñequito espera junto al botón y no queda nada leído.
  function reset() {
    try { sessionStorage.removeItem(SAVE); } catch (e) {}
    document.querySelectorAll(TASKS).forEach(el => el.classList.remove('read', 'lit'));
    won = false; endAt = 0; lastSaid = null; said.clear(); P.fast = false; document.body.classList.remove('ran'); if (note) note.hidden = true; labels = []; P.ride = null; P.rail = null; P.dive = null; P.enter = null; P.grow = 0; P.form = 'pk'; P.vy = 0; P.on = null;
    keys = {}; mode = 'wait'; paused = false; tip = null;
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
    note.innerHTML = `<span class="agent-dot" aria-hidden="true"></span><p><b>Little Bit · agent</b>Thanks for the ride! I found <code>contacts</code> and saved a row for you. Luca is just one message away.<small>number of rows inserted: 1</small></p><button type="button" class="again">↺ Play again</button>`;
    note.hidden = false;
    note.querySelector('.again').addEventListener('click', restart);
    const hi = $('#contact .btn'); hi.classList.remove('wiggle'); void hi.offsetWidth; hi.classList.add('wiggle');
    // En el celu, al terminar el juego se va el espacio extra del contacto y la página se corre: la cámara baja al
    // contacto para que se lea el mensaje del agente, con el título arriba.
    if (W < 768) { const t = box($('#contact h2')), n = box(note); let top = t.y - 80; if (n.b > top + H - 20) top = n.b - H + 20; scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }
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
    // Unos segundos sin moverse para que la misión se lea: después aparecen las teclas para moverse.
    start(); P.squash = 1;
    const now = performance.now(), face = portrait && box(portrait), pre = face && !still ? GIFT_MS : 0;
    // Si aterrizó sin cruzar la cara, el regalo sale recién ahora. El globo espera a que le llegue la última.
    if (pre && !gift) gift = makeGift(face, now, now + 600);
    const wait = gift ? Math.max(0, Math.max(...gift.sparks.map(g => g.to)) - now) + 350 : 0;
    missionUntil = Infinity; tip = null;
    converse([...(pre ? [{ html: GIFT, btn: 'Hmm…' }] : []), { html: MISSION, btn: "Let's go" }], now + (pre ? wait : 0));
    if (touch) { pad.classList.remove('pulse'); void pad.offsetWidth; pad.classList.add('pulse'); }
  }
  // Abrir el mail (o apretar una flecha mientras espera) hace la entrada; después solo retoma el juego.
  const activate = () => { if (mode === 'done') reset(); if (mode === 'wait') { if (paused) start(); else beginIntro(); } else if (mode !== 'intro') start(); };

  // La entrada: sale disparado del sobre, cruza el retrato de punta a punta moviendo las rayas y cae sobre
  // el título. El camino es una curva suave que pasa por unos puntos fijos (Catmull-Rom).
  function along(points, t, lens) {
    const n = points.length - 1;
    if (lens) { const total = lens[n], d = t * total; let j = 0; while (j < n - 1 && lens[j + 1] < d) j++; t = (j + (d - lens[j]) / ((lens[j + 1] - lens[j]) || 1)) / n; }
    const i = Math.min(n - 1, Math.floor(t * n)), u = t * n - i;
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
    const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  function runIntro(now) {
    if (now < intro.t0) return;
    const k = Math.min(1, (now - intro.t0) / intro.ms), e = intro.lens ? k * k * (3 - 2 * k) : 1 - Math.pow(1 - k, 1.6);
    // El camino está en coordenadas de pantalla con la página arriba de todo. Desde lejos, la página va subiendo
    // mientras él vuela: llega arriba justo cuando él llega al costado de la cara, y desde ahí todo es el mismo vuelo.
    let [x, y] = along(intro.points, e, intro.lens);
    if (intro.from) {
      const c = Math.min(1, k / intro.k0), s = intro.from * (1 - c * c * (3 - 2 * c));
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, s); y += s;
    }
    const vx = x - P.x, vy = y - P.y;
    P.x = x; P.y = y; P.face = vx >= 0 ? 1 : -1;
    P.trail.push([x, y]); if (P.trail.length > 10) P.trail.shift();
    if (window.__portraitPoke && portrait) {
      const r = portrait.getBoundingClientRect(), sx = x + S / 2, sy = y + S / 2 - scrollY;
      if (sx > r.left - 20 && sx < r.right + 20 && sy > r.top - 20 && sy < r.bottom + 20) {
        window.__portraitPoke(sx, sy, vx * 2.2, vy * 2.2);
        // Al cruzar la cara arranca el regalo: las estrellitas lo persiguen el resto del vuelo y las últimas le llegan justo al aterrizar.
        if (!gift) { const land = intro.t0 + intro.ms; gift = makeGift(box(portrait), now, land); }
      }
      else window.__portraitPoke(null);
    }
    if (k === 1) endIntro();
  }
  // El vuelo de siempre, desde donde esté Little Bit: sube un poco, recorre la cara y cae en el título.
  // Una curva sin rectas ni rulos por unos pocos puntos clave (Catmull-Rom centrípeta), muestreada fina para que
  // el vuelo vaya a velocidad pareja a lo largo de ella.
  function smoothPath(keys, per = 28) {
    const out = [keys[0]], d = (a, b) => Math.max(1e-3, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), .5));
    for (let i = 0; i < keys.length - 1; i++) {
      const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
      const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let k = 1; k <= per; k++) {
        const t = t1 + (t2 - t1) * k / per, L = (a, b, ta, tb) => [0, 1].map(c => ((tb - t) * a[c] + (t - ta) * b[c]) / (tb - ta || 1));
        const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, 0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    return out;
  }
  // El vuelo: un saltito para arrancar, una curva amplia por arriba hasta el costado izquierdo de la cara, la cruza de
  // una sola pasada hacia la derecha y baja al título. Desde lejos la página sube a la vez y termina justo cuando él
  // llega a la cara.
  function planIntro(from = 0, start = [P.x, P.y]) {
    const spot = home(), r = box(portrait), out = start;
    // Entra por la izquierda como una hamaca: baja, toca fondo y sube cruzando la cara en diagonal, sin giros cerrados.
    const enter = [r.x - 80, r.y + r.h * .5];
    const keys = [out, [out[0] - 30, out[1] - 70], [(out[0] + enter[0]) / 2, Math.min(out[1] - 70, r.y + r.h * .12)], enter,
      [r.x + r.w * .05, r.y + r.h * .78], [r.x + r.w * .5, r.y + r.h * .5], [r.r + 20, r.y + r.h * .3], [spot.x, spot.y]];
    const points = smoothPath(keys), lens = points.reduce((acc, p, k) => (k ? [...acc, acc[k - 1] + Math.hypot(p[0] - points[k - 1][0], p[1] - points[k - 1][1])] : [0]), []);
    const total = lens[lens.length - 1];
    if (!from) { intro = { t0: performance.now(), ms: Math.max(2100, Math.min(3200, total / .8)), points, lens }; return; }
    // Cuándo llega al costado de la cara: ahí la página tiene que haber terminado de subir.
    const at = lens[3 * 28] / total;
    let k0 = .5; for (let lo = 0, hi = 1, n = 0; n < 30; n++) { k0 = (lo + hi) / 2; if (k0 * k0 * (3 - 2 * k0) < at) lo = k0; else hi = k0; }
    intro = { t0: performance.now(), ms: Math.max(2600, Math.min(4200, total / .75)), points, lens, from, k0: Math.max(.25, k0) };
  }
  function beginIntro() {
    relayout();
    // Sale desde donde estaba flotando y pasa por la cara antes de aterrizar en el título.
    const ws = drifting(performance.now()) ? { x: drift.x + S * FB() / 2 - S / 2, y: scrollY + drift.y + S * FB() / 2 - S / 2 } : waitSpot();
    hint.classList.remove('on');
    // Sin movimiento, o si la cara no está a la vista, aterriza directo.
    const face = portrait && box(portrait);
    if (!face) { endIntro(); return; }
    const away = face.b < scrollY || face.y > scrollY + innerHeight;
    if (still) { if (away) scrollTo({ top: 0, behavior: 'instant' }); endIntro(); return; }
    P.x = ws.x; P.y = ws.y; mode = 'intro';
    // Desde lejos vuela de verdad: la página sube a la vez, de forma pareja, y termina justo cuando él llega a la cara.
    if (away) { planIntro(scrollY, [ws.x, Math.max(80, Math.min(innerHeight - 120, ws.y - scrollY))]); return; }
    planIntro();
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    if (mode === 'intro' && intro) runIntro(now);
    else if (level && mode !== 'wait' && mode !== 'done') { if (pendingBuild) remeasure(); step(dt, now, mode === 'play' && now >= lockUntil); if (mode === 'play') { follow(dt); nudge(now); } }
    if (P.trail.length && mode !== 'intro') P.trail.shift();
    draw(now);
    // El botón invisible sobre el muñequito: para tocarlo en el celu o llegar con Tab.
    const floating = drifting(now);
    if (floating && !still) moveDrift(dt);
    const ws = floating ? { x: drift.x + S * FB() / 2 - S / 2, y: scrollY + drift.y + S * FB() - S } : waitSpot(), waiting = mode === 'wait', showHit = mode === 'idle', big = S * (floating ? FB() : BIG) + 24;
    if (mode === 'wait') hint.textContent = floating ? asks[(W < 768 && drift.cycle ? drift.cycle.n : Math.floor(Math.max(0, now - drift.since - 900) / (TALK + QUIET))) % asks.length] : (touch ? "Hi, I'm Little Bit. Tap me!" : "Hi, I'm Little Bit. Click me!");
    document.body.classList.toggle('pk-floating', floating);
    hit.style.display = showHit ? '' : 'none';
    // Se mueven con translate (fracciones de píxel en la placa de video), no con left/top, que saltan de a un píxel.
    if (waiting) Object.assign(hit.style, { left: '0px', top: '0px', translate: `${ws.x + S / 2 - big / 2}px ${ws.y + S + 6 - big}px`, width: `${big}px`, height: `${big}px` });
    else if (showHit) Object.assign(hit.style, { left: '0px', top: '0px', translate: `${P.x - 10}px ${P.y - 10}px`, width: '44px', height: '44px' });
    // El globito mientras espera, y la misión sobre el muñequito al aterrizar.
    const said = now - drift.since - 300, asking = floating && said > 0 && (W < 768 ? (drift.alpha ?? 0) > .95 && drift.cycle && now - Math.max(drift.cycle.from, drift.since + 300) < 5500 : said % (TALK + QUIET) < TALK); // en el celu habla al aparecer // en el celu, 4 s cada 16: se ve, pero no molesta
    hint.classList.toggle('on', false && peekFrom() !== null && now >= peekFrom() + 300 && (floating ? asking : ws.y > scrollY && ws.y < scrollY + H));
    if (waiting) {
      // Al costado si entra; en pantallas angostas, arriba del muñequito.
      const side = !floating && ws.x + S * BIG + 230 < W;
      hint.classList.toggle('lane', floating && !!lane);
      hint.style.maxWidth = floating && lane ? `${lane[1] - lane[0]}px` : '';
      hint.classList.toggle('side', side);
      hint.style.left = '0px'; hint.style.top = '0px';
      const hw = hint.offsetWidth, lo = floating && lane ? lane[0] : 8, hi = floating && lane ? lane[1] : W - 8;
      hint.style.translate = `${side ? ws.x + S / 2 + S * (floating ? FB() : BIG) / 2 + 14 : Math.max(lo + hw / 2, Math.min(hi - hw / 2, ws.x + S / 2))}px ${side ? ws.y + S - S * (floating ? FB() : BIG) / 2 : ws.y + S - S * (floating ? FB() : BIG) - 14}px`;
    }
    help.classList.toggle('on', !!level && (mode === 'play' || mode === 'idle'));
    const lost = mode === 'play' && camFree && (P.y + S < scrollY + 40 || P.y > scrollY + H - 40);
    awaySince = lost ? awaySince || now : 0;
    const lonely = lost && now - awaySince > 7000;
    if (lonely && !away.classList.contains('on')) away.querySelector('p').textContent = P.y < scrollY ? "Psst… I'm up here! ↑" : "Psst… I'm down here! ↓";
    away.classList.toggle('on', lonely);
    const talk = mode === 'play' && !!talkSteps && now >= talkFrom;
    mission.classList.toggle('on', talk);
    if (talk) { mission.style.left = `${Math.max(170, Math.min(W - 170, P.x + S / 2))}px`; mission.style.top = `${P.y - 16}px`; }
    requestAnimationFrame(frame);
  }

  // ---------- controles ----------
  // Un toque guardado mientras el muñequito habla: así ninguna tecla se pierde.
  const DIR = { left: 'left', right: 'right', jump: 'up', down: 'down' };
  const KEY = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', ArrowDown: 'down', s: 'down' };
  addEventListener('keydown', event => {
    // Con un visor abierto (las capturas en grande), las teclas son del visor.
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (mode === 'intro') { if (k) event.preventDefault(); return; }
    if (mode === 'play') {
      if (event.key === 'Escape') { reset(); return; } // salir es empezar de cero, igual que la ✕
      if (talkSteps && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (!event.repeat) advance(); return; }
      if (k && talking()) { event.preventDefault(); return; }
      if (k) { if (!event.repeat) { letGo(); queued = DIR[k] || null; } keys[k] = true; camFree = false; event.preventDefault(); missionUntil = Math.min(missionUntil, Math.max(performance.now(), lockUntil) + 800); }
      else if (['PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) camFree = true;
      return;
    }
    // Las flechas solo arrancan el juego si no estás usando unas pestañas o escribiendo.
    const el = document.activeElement;
    if ((k === 'left' || k === 'right') && !(el && el.closest('[role="tablist"], input, textarea, select, [contenteditable]'))) { const fresh = mode === 'wait' || mode === 'done'; if (fresh) return; activate(); if (!fresh) keys[k] = true; event.preventDefault(); }
  });
  addEventListener('keyup', event => { const k = KEY[event.key.length === 1 ? event.key.toLowerCase() : event.key]; if (k) keys[k] = false; });
  hit.addEventListener('click', activate);
  // El juego arranca solo si alguien lo pide.
  document.querySelectorAll('[data-pk-play]').forEach(b => b.addEventListener('click', activate));
  // Un click sobre el muñequito mientras se juega repite lo último que dijo; si todavía no dijo nada, la misión.
  document.addEventListener('click', event => {
    if (mode !== 'play' || Math.hypot(event.clientX - P.x - S / 2, event.clientY + scrollY - P.y - S / 2) > 34) return;
    if (lastSaid) { labels = []; say(lastSaid); } else if (!talkSteps) converse([{ html: MISSION, btn: "Let's go" }]);
  });
  // Scrollear no corta el juego: la página se mira libre y el muñequito espera donde está. La cámara vuelve a
  // seguirlo con la próxima tecla.
  const look = () => { if (mode === 'play') camFree = true; };
  addEventListener('wheel', look, { passive: true });
  addEventListener('touchmove', event => { if (!pad.contains(event.target)) look(); }, { passive: true });
  addEventListener('scroll', () => { if (mode === 'play' && Math.abs(scrollY - expected) > 40) look(); }, { passive: true });
  pad.querySelectorAll('[data-k]').forEach(button => {
    const k = button.dataset.k;
    const on = event => { event.preventDefault(); if (talking()) return; letGo(); queued = DIR[k] || null; keys[k] = true; camFree = false; missionUntil = Math.min(missionUntil, Math.max(performance.now(), lockUntil) + 800); button.setPointerCapture?.(event.pointerId); };
    const off = () => { keys[k] = false; };
    button.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, off));
  });
  // La ✕ sale del juego y la próxima partida empieza de cero (quien vuelve puede ser otra persona). Responde al
  // soltar el dedo y también al click: en iPhone el click a veces no llega después de tocar las flechas.
  ['pointerup', 'click'].forEach(type => pad.querySelector('.x').addEventListener(type, event => { event.preventDefault(); if (mode === 'play') reset(); }));
  // Salir del todo: el muñequito vuelve a esperar junto al botón, como al cargar la página.
  help.querySelector('.exit').addEventListener('click', event => { event.stopPropagation(); reset(); });
  away.querySelector('.back').addEventListener('click', event => { event.stopPropagation(); camFree = false; awaySince = 0; });
  away.querySelector('.quit').addEventListener('click', event => { event.stopPropagation(); reset(); });
  document.querySelectorAll('.restart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); restart(); }));
  // Con la pestaña oculta la página puede achicarse a cero: medir ahí rompe el nivel. Se mide al volver, si cambió.
  // También se vuelve a medir antes de arrancar o de la entrada: si la página cargó oculta, el alto guardado
  // podía ser 0 y el muñequito aparecía en cualquier lado.
  let measured = '';
  function relayout() {
    if (document.hidden || !innerWidth || !innerHeight || measured === `${innerWidth}x${innerHeight}`) return;
    measured = `${innerWidth}x${innerHeight}`;
    resize(); remeasure();
  }
  addEventListener('resize', relayout);
  // Mientras se juega, los desplegables son tareas del DAG: los abre y los cierra el muñequito, no el mouse.
  document.addEventListener('click', event => {
    if (!document.body.classList.contains('playing') || !event.target.closest('.fold summary, a[href$="#how-i-work"], a[href$="#education"]')) return;
    event.preventDefault(); event.stopPropagation();
    say('It opens when I get there.', 2400);
  }, true);
  document.addEventListener('toggle', () => { settleAt = performance.now() + 700; remeasure(); }, true);
  document.addEventListener('visibilitychange', relayout);

  // Para probarlo desde afuera.
  window.__pk = { railAt: id => { const n = level.nodes.find(q => q.fold && q.task.id === id); P.rail = { at: n, to: null, d: 0 }; P.dive = null; onNode(n); return !!n; }, rail: () => P.rail && { at: level.nodes.indexOf(P.rail.at), moving: !!P.rail.to, ri: P.rail.ri, dots: P.rail.dots && P.rail.dots.length, y: Math.round(P.y), on: document.querySelector("#how-i-work .pr-item.on .tx b")?.textContent }, intro: () => intro && { ms: intro.ms, points: (intro.points || []).map(p => p.map(Math.round)) }, introAt: k => { const e = intro.lens ? k * k * (3 - 2 * k) : 1 - Math.pow(1 - k, 1.6), [x, y] = along(intro.points, e, intro.lens), c = intro.from ? Math.min(1, k / intro.k0) : 1, sc = intro.from ? intro.from * (1 - c * c * (3 - 2 * c)) : 0; return [Math.round(x), Math.round(y), Math.round(sc)]; }, drift: () => ({ ...drift }), free: () => freeSpot(S * FB()),  level: () => level, activate, state: () => ({ lock: Math.round(lockUntil - performance.now()), keys: Object.keys(keys).filter(k => keys[k]).join(), labels: labels.map(l => l.text.slice(0, 20)).join('|'), dive: !!P.dive, enter: P.enter && +P.enter.t.toFixed(2), mode, x: Math.round(P.x), y: Math.round(P.y), form: P.form, ride: !!P.ride, won, on: P.on && (P.on.kind || (P.on.floor ? 'floor' : 'ledge')), scrollY }), start, stop, keys: k => Object.assign(keys, k), place: (x, y) => { P.x = x; P.y = y; P.vy = 0; }, sim: (ms, lock) => { let t = performance.now(); for (let k = 0; k < ms / 16; k++) { t += 16; step(0.016, t, mode === 'play' && (!lock || t >= lockUntil)); if (mode === 'play') follow(0.016); } return window.__pk.state(); } };

  relayout();
  if (document.readyState === 'complete') restore(); else addEventListener('load', restore);
  // La prueba automática (selftest.ps1) entra con #selftest y recorre el juego sola.
  if (location.hash === '#selftest') { const t = document.createElement('script'); t.src = 'selftest.js'; document.body.append(t); }
  last = performance.now(); requestAnimationFrame(frame);
})();
