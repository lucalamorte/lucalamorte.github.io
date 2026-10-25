// El portfolio como nivel. Al lado del botón de la portada espera un mensaje para Luca: el de quien visita.
// Al enviarlo, el muñequito (ese mensaje) sale disparado del sobre, cruza el retrato de Luca, cae sobre el
// título y cuenta su misión: llegar a la casilla de Luca viajando por el mismo camino que sus datos. Se mueve con ← → ↑ o con los controles del celu; scrollear o Esc lo pausa.
// Es un dato que viaja por el stack hasta llegar al contacto, y cada pieza hace lo que hace de verdad:
// todo pasa en AWS, S3 lo guarda como archivo, el DAG de Airflow lo deja pasar a horario y lo carga,
// Monte Carlo lo revisa, en Snowflake dbt lo transforma de raw a mart, el warehouse escala mientras
// lo usas y el hueco te deja justo arriba del primer producto, el chat de Nutrigordo contesta, las flashcards de PrimeroLab vuelven
// más tarde, DataChinchilla salta los pasos que ya tienes, las reglas de How I work se abren al pisarlas
// y las credenciales se sellan.
// Los costados no son paredes: lo que sale por un lado entra por el otro.
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
  hit.type = 'button'; hit.className = 'pk-hit'; hit.setAttribute('aria-label', 'Send a message to Luca and play the portfolio as a game');
  const hint = document.createElement('span');
  hint.className = 'pk-hint'; hint.textContent = touch ? 'message for Luca · tap to send' : 'message for Luca · click to send';
  // La misión, con las teclas para moverse, en un globo sobre el muñequito.
  const mission = document.createElement('div');
  mission.className = 'pk-say'; mission.setAttribute('role', 'status');
  mission.innerHTML = `<p>Hi! I'm your message to Luca. To reach his inbox I travel the way his data does. Take me there.</p>${touch ? '<p class="go">use the buttons below ↓</p>' : '<p class="go"><kbd>←</kbd><kbd>→</kbd> move <kbd>↑</kbd> jump</p>'}`;
  const help = document.createElement('p');
  help.className = 'play-help'; help.textContent = '← → move · ↑ jump · ↓ drop · scroll to read · esc';
  const pad = document.createElement('div');
  pad.className = 'pad'; pad.hidden = true;
  pad.innerHTML = '<button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="right" aria-label="Right">▶</button><button type="button" data-k="down" class="down" aria-label="Go down">▼</button><button type="button" data-k="jump" class="jump" aria-label="Jump">▲</button><button type="button" class="x" aria-label="Stop playing">✕</button>';
  document.body.append(canvas, hit, hint, mission, help, pad);

  let fade = 1, mode = 'wait', missionUntil = 0, opened = 0, W = 0, H = 0, level = null, keys = {}, last = 0, labels = [], expected = -1, intro = null, won = false;
  const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, on: null, face: 1, squash: 0, form: 'pk', ride: null, dropUntil: 0, trail: [] };

  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const home = () => { const b = box($('.hero h1')); return { x: b.x + 6, y: b.y + 4 - S }; };
  // El sobre espera al lado del primer botón de la portada.
  const envelope = () => { const b = box($('.hero .cta .btn')); return { x: b.r + 22, y: b.b - 32, w: 46, h: 32 }; };
  // Un cartelito que flota sobre el muñequito o sobre una pieza.
  // Los diálogos siempre salen justo arriba del muñequito y lo siguen mientras se mueve.
  const readyHint = () => say(touch ? '▼ when you are ready' : '↓ when you are ready', 2200);
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
    // Lectura obligada: paredes a los costados de una lista y cada fila es un piso. Mientras se lee, una
    // barrita se llena; recién entonces se baja con ↓ (o se abre sola si es auto). Con ↑ se vuelve a la de arriba.
    const chute = (els, top, seconds, onLand, auto = false) => {
      const first = box(els[0]), lastRow = box(els[els.length - 1]);
      walls.push({ x: first.x - 4, y1: top, y2: lastRow.b }, { x: first.r + 4, y1: top, y2: lastRow.b });
      els.forEach((el, k) => {
        const b = box(el);
        const p = ledge(first.x - 4, b.y, first.w + 8, { kind: 'read', t: 0, need: seconds, land: () => onLand(el, k), tick: () => { p.y = el.getBoundingClientRect().top + scrollY; } });
        p.stand = dt => { if (p.t >= p.need) return; p.t += dt; if (p.t >= p.need) { if (auto) p.solid = false; else readyHint(); } };
      });
      return first;
    };

    // Portada: el título es el piso, sin línea encima, y no hay ningún hueco. La única salida es la cara de
    // Luca: al entrar el muñequito se zambulle, cruza la cabeza (las rayas se ondulan) y sale por abajo.
    const h1 = box($('.hero h1')), fig = portrait ? box(portrait) : null;
    let face = null;
    if (fig && fig.b > h1.y) {
      // Con el retrato al costado, los hombros son un piso de lado a lado.
      ledge(h1.x, h1.y + 4, W + 60 - h1.x, { hidden: true, floor: true });
      ledge(-60, fig.y + fig.h * 0.8, W + 120, { hidden: true, floor: true });
    } else {
      // En el celu el retrato queda arriba del título: se salta desde el título hacia la cara.
      ledge(h1.x, h1.y + 4, h1.w, { hidden: true, floor: true });
      floor(h.b - 8);
    }
    if (fig) {
      face = { x1: fig.x + fig.w * 0.3, x2: fig.x + fig.w * 0.7, y1: fig.y + fig.h * 0.08, y2: fig.y + fig.h * (fig.b > h1.y ? 0.62 : 0.74), ex: fig.x + fig.w * 0.42, ey: h.b + 10 };
      // Un anillo que late en la cara marca por dónde se pasa.
      things.push({ draw: now => {
        if (P.y > h.b) return;
        const r = 26 + Math.sin(now / 300) * 4;
        ctx.globalAlpha = 0.5; ctx.setLineDash([4, 6]); ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(fig.x + fig.w * 0.5, fig.y + fig.h * 0.36, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      } });
    }

    // About: todo pasa adentro de AWS. Los párrafos se leen de a uno, entre paredes: al caer en uno se
    // ilumina y el muñequito reacciona. El DAG de Airflow tiene una tarea por párrafo y no corre hasta que los tres estén leídos.
    const ab = box($('#about')), grid = box($('.about-grid'));
    things.push({ draw: () => { dashedBox(grid.x - 18, grid.y - 22, grid.w + 36, grid.h + 44, 26); text('AWS', grid.x - 4, grid.y - 28, ACCENT); } });
    const paras = [...document.querySelectorAll('#about .about-grid p:not(.tech-label)')];
    const REACT = ['interesting… 65M profiles', '10 plants, 5 countries. noted', 'three live products? ok, impressed'];
    const reads = { done: paras.filter(el => el.classList.contains('read')).length, total: paras.length };
    if (paras.length) chute(paras, ab.y + 40, 2.2, (el, k) => {
      if (!el.classList.contains('read')) { el.classList.add('read'); reads.done++; }
      say(reads.done === reads.total && k === paras.length - 1 ? 'all read. Airflow can run now ↓' : REACT[k] || 'noted', 2400);
    });
    const fy = ab.b - 6, bw = 84, bx = Math.max(colL + 30, 24);
    floor(fy, [[bx, bw]]);
    const PERIOD = 5000, OPEN = 900;
    const ready = () => reads.done >= reads.total;
    const gateOpen = now => ready() && now % PERIOD > PERIOD - OPEN;
    const gate = ledge(bx + 4, fy + 48, bw - 8, { tick: now => { gate.solid = !gateOpen(now); }, land: () => say(ready() ? 'stored in S3. waiting for the next Airflow run' : 'Airflow is waiting: read about Luca first ↑', 2600) });
    const bucket = { x: bx, y: fy, w: bw, d: 52 };
    things.push({ draw: now => drawBucket(bucket, gateOpen(now), now, PERIOD, OPEN, reads) });

    // Experience: la tarea de Airflow carga el archivo por el margen hasta Snowflake (extract y load).
    const exp = box($('#experience')), tl = box($('.tablist'));
    // El warehouse queda en el hueco libre bajo las pestañas, arriba del piso.
    const mx = Math.max(colL - 30, 10), wy = exp.b - 72, wx = tl.x;
    const top = wy - 240;
    const path = [[bx + bw / 2, fy + 56], [bx + bw / 2, fy + 70], [mx, fy + 70], [mx, top], [wx + 28, top], [wx + 28, top + 30]];
    const pipe = { path, mouth: [bx + bw / 2, fy + 56] };
    things.push({ draw: now => drawPipe(pipe, now) });

    // Snowflake es una caja cerrada: las paredes no dejan salir. Adentro, las capas de dbt van de pared a
    // pared y se construyen de a una (raw, staging, mart): no se puede saltear ninguna. Al fondo, la salida
    // pasa por Monte Carlo, que revisa los datos ya transformados. El warehouse escala mientras lo usas.
    const sfW = Math.max(210, Math.min(tl.w + 28, W - wx - 16)), boxL = wx - 14, boxR = boxL + sfW, boxB = wy + 28;
    walls.push({ x: boxL, y1: top - 180, y2: boxB }, { x: boxR, y1: top - 180, y2: boxB });
    const models = [['raw.orders', 0.8], ['stg_orders', 1.4], ['fct_orders', 1.4]].map(([name, need], k) => {
      const m = ledge(boxL + 2, top + 60 + k * 50, sfW - 4, { kind: 'model', name, t: 0, need, built: false });
      m.land = () => { if (!m.built) say(k === 0 ? 'loaded into raw' : `dbt run · ${name}…`, 1400); };
      m.stand = dt => {
        if (m.built) return;
        m.t += dt;
        if (m.t >= m.need) { m.built = true; say(k === 2 ? 'dbt build done ✓' : `${name} ✓`, 1400); readyHint(); }
      };
      return m;
    });
    const hatch = { x: boxR - 74, w: 58 };
    ledge(boxL, boxB, hatch.x - boxL, { floor: true, land: () => say('the way out is Monte Carlo →', 1800) });
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
    const SIZES = ['XS', 'S', 'M', 'L', 'XL'], maxW = sfW - 28;
    const wh = ledge(wx, wy, 56, { size: 0, idle: 0, grow: 0, kind: 'warehouse' });
    wh.land = () => say(wh.size ? 'warehouse resumed' : 'warehouse running · it scales while you use it', 2200);
    wh.stand = dt => { wh.idle = 0; wh.grow += dt; if (wh.grow > 0.55 && wh.size < SIZES.length - 1) { wh.size++; wh.grow = 0; say(`warehouse scaled up to ${SIZES[wh.size]}`, 900); } };
    wh.tick = (now, dt) => {
      if (P.on !== wh) { wh.grow = 0; wh.idle += dt; if (wh.idle > 1.6 && wh.size) { wh.size = 0; } }
      const target = 56 + (maxW - 56) * wh.size / (SIZES.length - 1);
      wh.w += (target - wh.w) * Math.min(1, dt * 6);
    };
    wh.label = () => SIZES[wh.size];
    // El piso es la línea de una planta, en tiempo real: te lleva hacia la salida.
    // El hueco de salida cae sobre la primera tarjeta de Projects.
    const card0 = $('#projects .card'), c0 = card0 ? box(card0) : { r: colR, w: 200 };
    const gx = Math.min(W - 100, Math.max(colL, c0.x + c0.w / 2 - 45)), ey = exp.b - 6;
    ledge(-60, ey, gx + 60, { floor: true, belt: 70 });
    ledge(gx + 90, ey, W - gx - 30, { floor: true, belt: -70 });
    things.push({ draw: now => { drawGap(gx + 45, ey, now); drawBelt(colL - 10, gx - 6, ey, now, 1); drawBelt(gx + 96, Math.max(gx + 140, colR), ey, now, -1); } });

    // Projects: entre paredes, el borde de arriba de cada tarjeta es el piso. Al pisarla se enciende como
    // en hover y el muñequito usa el producto mientras la lee. Una fila se abre recién cuando se leyeron
    // todas sus tarjetas, así que hay que pasar por cada una.
    const cardEls = [...document.querySelectorAll('#projects .card')];
    const USE = [['2 eggs and toast', 'logged · 412 kcal ✓'], ['what is RAG?', 'search + generate ✓ · see you in 3 days'], ['I want to be a data engineer', 'your path: 23 steps, only what you miss']];
    if (cardEls.length) {
      const gridBox = box($('#projects .projects'));
      walls.push({ x: gridBox.x - 4, y1: box($('#projects')).y + 40, y2: gridBox.b }, { x: gridBox.r + 4, y1: box($('#projects')).y + 40, y2: gridBox.b });
      const byRow = new Map();
      cardEls.forEach((el, k) => {
        const c = box(el), key = Math.round(c.y);
        const p = ledge(c.x - (c.x - gridBox.x < 20 ? 4 : 8), c.y, c.w + 16, { kind: 'read', t: 0, need: 2.4, row: key, land: () => {
          cardEls.forEach(other => other.classList.toggle('lit', other === el));
          const [ask, answer] = USE[k] || ['', ''];
          if (ask && !el.dataset.used) { el.dataset.used = '1'; say(ask, 1300); setTimeout(() => say(answer, 2600), 1100); }
        } });
        p.stand = dt => {
          if (p.t >= p.need) return;
          p.t += dt;
          if (p.t < p.need) return;
          const mates = byRow.get(key);
          if (mates.every(q => q.t >= q.need)) readyHint();
          else say('now the one next to it →', 1600);
        };
        p.ready = () => byRow.get(key).every(q => q.t >= q.need);
        byRow.set(key, [...(byRow.get(key) || []), p]);
      });
    }
    const rows = [...document.querySelectorAll('.pr-item')], how = box($('#principles'));
    const list = rows.length ? box(rows[0]) : { x: colL, w: 200 };
    // Projects se deja por un hueco justo arriba de la lista de reglas.
    const pr = box($('#projects'));
    floor(pr.b - 6, [[list.x + list.w / 2 - 45, 90]]);
    // How I work: seis reglas, de la 1 a la 6. Al caer en una se abre su escena para leerla.
    if (rows.length) chute(rows, how.y + 40, 2.6, row => row.click());
    floor(how.b - 6, [[list.x + list.w / 2 - 45, 90]]);

    // Education: lo mismo, fila por fila; cada credencial se sella al leerla.
    const items = [...document.querySelectorAll('#education .list li')], ed = box($('#education'));
    if (items.length) chute(items, ed.y + 40, 1.2, (li, k) => {
      li.classList.remove('stamp'); void li.offsetWidth; li.classList.add('stamp');
      say(k === 0 ? 'class of 2026' : li.textContent.includes('English') ? 'hello · hola' : li.querySelector('.cred') ? 'verified ✓' : 'done ✓', 1600);
    }, true);
    floor(ed.b - 6, [[(colL + colR) / 2 - 45, 90]]);

    // Contacto: el buzón es la meta.
    // La fila de botones ocupa todo el ancho: se mide desde el primer botón hasta el último.
    const ct = box($('#contact')), btn = box($('#contact .btn')), lastBtn = box($('#contact .cta .btn:last-child'));
    const right = lastBtn.r + 40 + 40 < W ? lastBtn.r + 40 : Math.max(8, btn.x - 60);
    ledge(Math.min(btn.x, right) - 80, btn.b, Math.max(lastBtn.r, right + 32) - Math.min(btn.x, right) + 160);
    const mailbox = { x: right, y: btn.b - 44, w: 32, h: 44, flag: 0 };
    things.push({ draw: now => drawMailbox(mailbox, now) });
    floor(ct.b - 20, []);

    for (const id of ['about', 'experience', 'projects', 'principles', 'education', 'contact']) { const b = box(document.getElementById(id)); checkpoints.push({ y: b.y, x: colL + 30 }); }
    return { plats, things, walls, face, mc: level_mc, pipe, bucket, mailbox, checkpoints, colL, colR, docH: document.documentElement.scrollHeight };
  }

  // ---------- dibujo ----------
  function text(t, x, y, color = MUTED, align = 'left', font = MONO) {
    ctx.font = font; ctx.textAlign = align;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(t, x, y);
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function dashedBox(x, y, w, h, r) { ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(94,234,212,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); ctx.setLineDash([]); }
  function drawGap(x, y, now) { const k = Math.sin(now / 250) * 3; text('↓', x, y + 4 + k, ACCENT, 'center', '14px "JetBrains Mono", monospace'); }
  function drawBucket(b, open, now, period, openFor, reads) {
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(b.x - 6, b.y); ctx.lineTo(b.x + 6, b.y + b.d); ctx.lineTo(b.x + b.w - 6, b.y + b.d); ctx.lineTo(b.x + b.w + 6, b.y); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y, b.w / 2 + 6, 5, 0, 0, Math.PI * 2); ctx.stroke();
    if (open) { ctx.fillStyle = INK; ctx.fillRect(b.x + 8, b.y + b.d - 2, b.w - 16, 4); }
    text('S3', b.x + b.w / 2, b.y + b.d / 2 + 6, ACCENT, 'center');
    // El DAG de Airflow: una tarea por párrafo leído; con las tres hechas corre a horario y abre la compuerta.
    const cx = b.x + b.w + 22, cy = b.y + 22, left = (period - openFor - (now % period)) / 1000;
    const all = reads.done >= reads.total;
    const nodes = [[cx, cy], [cx + 22, cy - 9], [cx + 22, cy + 9], [cx + 44, cy]];
    ctx.strokeStyle = MUTED; ctx.lineWidth = 1.2; ctx.beginPath();
    [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([a, z]) => { ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[z][0], nodes[z][1]); }); ctx.stroke();
    nodes.forEach(([x, y], k) => { const on = k === 3 ? open : k === 0 ? reads.done >= 1 : k === 1 ? reads.done >= 2 : all; ctx.fillStyle = on ? ACCENT : INK; ctx.strokeStyle = on ? ACCENT : MUTED; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    text(!all ? `Airflow: read about Luca first · ${reads.done}/${reads.total}` : open ? 'Airflow: DAG running' : `Airflow: next run ${Math.max(0, left).toFixed(0)}s`, cx + 54, cy + 4, open ? ACCENT : MUTED);
  }
  function drawPipe(p, now) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); p.path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(94,234,212,.14)'; ctx.lineWidth = 20; ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -now / 30; ctx.stroke(); ctx.setLineDash([]);
    const [x2, y2] = p.path[2];
    text('Airflow · load', x2 + 16, y2 - 14, ACCENT);
  }
  function drawBelt(x1, x2, y, now, dir) {
    ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y + 7); ctx.lineTo(x2, y + 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(94,234,212,.4)'; ctx.setLineDash([4, 10]); ctx.lineDashOffset = -dir * now / 1000 * 70;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.setLineDash([]);
    for (const gx of [x1 + 8, x2 - 8]) {
      ctx.save(); ctx.translate(gx, y + 4); ctx.rotate(dir * now / 400); ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(8, 0); ctx.stroke(); }
      ctx.restore();
    }
    if (dir > 0) text('plant line · real-time', x1 + 22, y + 22, MUTED);
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
    if (p.kind === 'warehouse') {
      const on = p.size > 0;
      ctx.fillStyle = on ? 'rgba(94,234,212,.22)' : 'rgba(148,163,184,.12)'; ctx.strokeStyle = on ? ACCENT : MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 7, 3); ctx.fill(); ctx.stroke();
      snowflake(p.x + 10, p.y + 18, 6, on ? ACCENT : MUTED);
      text(`warehouse ${p.label()}`, p.x + 22, p.y + 22, on ? ACCENT : MUTED);
      return;
    }
    if (p.kind === 'model') {
      if (p.built) {
        ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(94,234,212,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x + 8, p.y + 3); ctx.lineTo(p.x + p.w - 8, p.y + 3); ctx.stroke(); ctx.setLineDash([]);
        text(`✓ ${p.name}`, p.x + 12, p.y + 18, ACCENT);
        return;
      }
      ctx.fillStyle = 'rgba(148,163,184,.1)'; ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, p.w - 12, 6, 3); ctx.fill(); ctx.stroke();
      if (p.t) { ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(p.x + 6, p.y, (p.w - 12) * Math.min(1, p.t / p.need), 6, 3); ctx.fill(); }
      text(p.name, p.x + 12, p.y + 20, MUTED);
      return;
    }
    if (p.kind === 'read') {
      if (!p.t || !p.solid) return;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x + 4, p.y); ctx.lineTo(p.x + 4 + (p.w - 8) * Math.min(1, p.t / p.need), p.y); ctx.stroke();
      return;
    }
    if (p.floor) { ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); return; }
    ctx.strokeStyle = p.solid ? LINE : 'rgba(94,234,212,.15)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawEnvelope(e, now) {
    const open = opened ? Math.min(1, (now - opened) / 300) : 0;
    const gone = opened ? Math.min(1, Math.max(0, (now - opened - 2600) / 600)) : 0;
    if (gone >= 1) return;
    const hop = opened || still ? 0 : (now % 1800 < 500 ? Math.sin((now % 1800) / 500 * Math.PI) * 7 : 0);
    const x = e.x, y = e.y - hop;
    ctx.globalAlpha = 1 - gone;
    ctx.fillStyle = INK; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.shadowColor = ACCENT; ctx.shadowBlur = opened ? 0 : 12;
    ctx.beginPath(); ctx.roundRect(x, y, e.w, e.h, 4); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    // La solapa: cerrada apunta hacia abajo, abierta se da vuelta hacia arriba.
    const tip = y + e.h * 0.55 - open * e.h * 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + e.w / 2, tip); ctx.lineTo(x + e.w, y); ctx.stroke();
    if (!opened) {
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x + e.w - 2, y + 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('1', x + e.w - 2, y + 5.5);
    } else if (now - opened < 700) {
      // El disparo: un anillo que se abre desde la boca del sobre.
      const k = (now - opened - 250) / 450;
      if (k > 0) { ctx.globalAlpha = (1 - k) * (1 - gone); ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(x + e.w / 2, y, 6 + k * 28, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPk(x, y, now) {
    if (P.form === 'dot') { ctx.shadowColor = ACCENT; ctx.shadowBlur = 14; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(x + S / 2, y + S / 2, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; return; }
    if (P.form === 'file') {
      ctx.fillStyle = INK; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 15, y); ctx.lineTo(x + 21, y + 6); ctx.lineTo(x + 21, y + S); ctx.lineTo(x + 3, y + S); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ACCENT; [9, 14, 19].forEach(ly => ctx.fillRect(x + 7, y + ly, 10, 2));
      return;
    }
    if (P.form === 'mail') {
      ctx.fillStyle = INK; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(x, y + 6, S, 16); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + S / 2, y + 15); ctx.lineTo(x + S, y + 6); ctx.stroke();
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
    if (mode === 'wait' || opened) drawEnvelope(envelope(), now);
    if (mode !== 'wait' && !(mode === 'intro' && intro && now < intro.t0) && seen(P.y)) drawPk(P.x, P.y, now);
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
      P.x = d.a[0] + (d.b[0] - d.a[0]) * e; P.y = d.a[1] + (d.b[1] - d.a[1]) * e;
      if (window.__portraitPoke) window.__portraitPoke(P.x + S / 2, P.y + S / 2 - scrollY, (P.x - px) * 3, (P.y - py) * 3);
      if (d.t === 1) { P.dive = null; P.vy = 200; if (window.__portraitPoke) window.__portraitPoke(null); }
      return;
    }
    if (P.ride) {
      P.ride.d += dt * 620;
      const [x, y, end] = rideTo(P.ride.d);
      P.x = x - S / 2; P.y = y - S / 2;
      if (end) { P.ride = null; P.form = 'pk'; P.vy = 0; say('loaded into Snowflake'); }
      return;
    }
    for (const p of level.plats) if (p.tick) p.tick(now, dt);
    const dir = control ? ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) : 0;
    if (dir) P.face = dir;
    P.vx = dir * SPEED + (P.on && P.on.belt ? P.on.belt : 0);
    const prevX = P.x;
    P.x += P.vx * dt;
    for (const w of level.walls) {
      if (P.y + S <= w.y1 || P.y >= w.y2) continue;
      if (prevX + S <= w.x && P.x + S > w.x) P.x = w.x - S;
      if (prevX >= w.x && P.x < w.x) P.x = w.x;
    }
    if (P.x > W) P.x -= W + S;
    if (P.x < -S) P.x += W + S;
    if (control && keys.jump && P.ground) { P.vy = -JUMP; P.ground = false; P.squash = -0.7; }
    if (control && keys.down && P.ground && P.on && !P.on.floor) {
      const p = P.on, done = p.ready ? p.ready() : p.need === undefined || p.t >= p.need;
      if (done) { P.dropUntil = now + 260; P.dropFrom = p; P.ground = false; keys.down = false; }
      else if (now > (P.nagUntil || 0)) { P.nagUntil = now + 1500; say(p.ready ? 'read every card in this row first' : 'still reading…', 1400); }
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
      P.dive = { t: 0, a: [P.x, P.y], b: [f.ex - S / 2, f.ey] }; P.on = null; P.ground = false;
      say("through Luca's head ↓", 1500);
      return;
    }
    const mc = level.mc;
    if (mc && !mc.state.checked && P.x + S / 2 > mc.x && P.x + S / 2 < mc.x + mc.w && P.y > mc.y - 4 && P.y < mc.y + 40) { mc.state.checked = true; say('Monte Carlo: fresh, schema ok ✓', 2000); }
    const b = level.bucket, cx = P.x + S / 2;
    const inBucket = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    if (P.form !== 'mail') P.form = inBucket ? 'file' : 'pk';
    if (inBucket && P.y + S > b.y + b.d + 4) { P.ride = { d: 0 }; P.form = 'dot'; say('Airflow: load task running', 1500); }

    const m = level.mailbox;
    if (!won && P.x + S > m.x - 6 && P.x < m.x + m.w + 6 && P.y + S > m.y - 10 && P.y < m.y + m.h) {
      won = true; P.form = 'mail'; say('delivered! now send the real one', 4000);
      const hi = $('#contact .btn'); hi.classList.remove('wiggle'); void hi.offsetWidth; hi.classList.add('wiggle');
      setTimeout(() => { stop(); P.form = 'pk'; P.x = m.x + m.w / 2 - S / 2; P.y = m.y - S; P.vy = 0; }, 1600);
    }
    for (const c of level.checkpoints) if (P.y > c.y + 40) level.respawn = c;
    if (P.y > level.docH + 60) { const c = level.respawn || level.checkpoints[0]; P.x = c.x; P.y = c.y + 30; P.vy = 0; say('back on track'); }
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
  function start() {
    if (mode === 'play') return;
    document.querySelectorAll('.reveal').forEach(el => { el.style.transition = 'none'; el.classList.add('in'); });
    void document.body.offsetHeight;
    document.documentElement.style.scrollBehavior = 'auto';
    if (mode === 'intro') endIntro();
    rebuild();
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
    const spot = home(), env = envelope();
    opened = performance.now(); hint.classList.remove('on');
    // Sin movimiento, o si el sobre ya no está a la vista, aterriza directo.
    if (still || !portrait || env.y < scrollY || env.y > scrollY + H) { endIntro(); return; }
    const r = box(portrait), out = [env.x + env.w / 2 - S / 2, env.y - S];
    P.x = out[0]; P.y = out[1];
    const points = [out, [out[0] - 20, out[1] - 160], [r.r - r.w * 0.12, r.y + r.h * 0.5], [r.x + r.w * 0.15, r.y + r.h * 0.42], [r.x + r.w * 0.5, r.y + r.h * 0.02], [spot.x, spot.y]];
    // La solapa se abre primero; el disparo sale a los 300 ms.
    intro = { t0: opened + 300, ms: 2100, points };
    mode = 'intro';
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    if (mode === 'intro' && intro) runIntro(now);
    else if (level && mode !== 'wait') { step(dt, now, mode === 'play'); if (mode === 'play') follow(dt); }
    if (P.trail.length && mode !== 'intro') P.trail.shift();
    draw(now);
    // El botón invisible sobre el muñequito: para tocarlo en el celu o llegar con Tab.
    const env = envelope(), showHit = mode === 'idle' || mode === 'wait';
    hit.style.display = showHit ? '' : 'none';
    if (mode === 'wait') Object.assign(hit.style, { left: `${env.x - 10}px`, top: `${env.y - 14}px`, width: `${env.w + 20}px`, height: `${env.h + 24}px` });
    else if (showHit) Object.assign(hit.style, { left: `${P.x - 10}px`, top: `${P.y - 10}px`, width: '44px', height: '44px' });
    // El globito del mail mientras espera, y la misión sobre el muñequito al aterrizar.
    hint.classList.toggle('on', mode === 'wait' && env.y > scrollY && env.y < scrollY + H);
    if (mode === 'wait') { hint.style.left = `${env.x + env.w / 2}px`; hint.style.top = `${env.y - 16}px`; }
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
  addEventListener('resize', () => { resize(); if (level) { rebuild(); P.on = null; } });

  // Para probarlo desde afuera.
  window.__pk = { activate, state: () => ({ dive: !!P.dive, mode, x: Math.round(P.x), y: Math.round(P.y), form: P.form, ride: !!P.ride, won, on: P.on && (P.on.kind || (P.on.floor ? 'floor' : 'ledge')), scrollY }), start, stop, keys: k => Object.assign(keys, k), place: (x, y) => { P.x = x; P.y = y; P.vy = 0; }, sim: ms => { let t = performance.now(); for (let k = 0; k < ms / 16; k++) { t += 16; step(0.016, t, mode === 'play'); } return window.__pk.state(); } };

  resize();
  last = performance.now(); requestAnimationFrame(frame);
})();
