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
  pad.innerHTML = '<button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="right" aria-label="Right">▶</button><button type="button" data-k="jump" class="jump" aria-label="Jump">▲</button><button type="button" class="x" aria-label="Stop playing">✕</button>';
  document.body.append(canvas, hit, hint, mission, help, pad);

  let fade = 1, mode = 'wait', missionUntil = 0, opened = 0, W = 0, H = 0, level = null, keys = {}, last = 0, labels = [], expected = -1, intro = null, won = false;
  const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, on: null, face: 1, squash: 0, form: 'pk', ride: null, dropUntil: 0, trail: [] };

  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const home = () => { const b = box($('.hero h1')); return { x: b.x + 6, y: b.y + 4 - S }; };
  // El sobre espera al lado del primer botón de la portada.
  const envelope = () => { const b = box($('.hero .cta .btn')); return { x: b.r + 22, y: b.b - 32, w: 46, h: 32 }; };
  // Un cartelito que flota sobre el muñequito o sobre una pieza.
  const say = (text, x = P.x + S / 2, y = P.y - 14, ms = 2000) => { labels = labels.filter(l => l.text !== text); labels.push({ text, x, y, until: performance.now() + ms }); };

  // ---------- el nivel ----------
  function build() {
    W = document.documentElement.clientWidth;
    const plats = [], things = [], checkpoints = [];
    const h = box(hero), colL = Math.max(16, h.x), colR = Math.min(W - 16, h.r);
    const ledge = (x, y, w, extra = {}) => { const p = { x, y, w, solid: true, ...extra }; plats.push(p); return p; };
    // Un piso de lado a lado con huecos: por ahí se baja.
    const floor = (y, gaps = [], extra = {}) => {
      let x = -60;
      for (const [gx, gw] of [...gaps, [W + 60, 0]]) { if (gx > x) ledge(x, y, gx - x, { floor: true, ...extra }); x = gx + gw; }
      gaps.forEach(([gx, gw]) => things.push({ draw: now => drawGap(gx + gw / 2, y, now) }));
    };

    // Portada: el título, el texto y el botón son plataformas.
    const h1 = box($('.hero h1')), hp = box($('.hero .intro p')), cta = box($('.hero .cta'));
    ledge(h1.x, h1.y + 4, Math.min(h1.w, 440)); ledge(hp.x, hp.y, hp.w); ledge(cta.x, cta.y, cta.w);
    floor(h.b - 8, [[colR - 150, 100]]);

    // About: todo pasa adentro de AWS, y la única salida es el bucket de S3.
    const ab = box($('#about')), grid = box($('.about-grid')), photo = box($('.photo'));
    things.push({ draw: () => { dashedBox(grid.x - 18, grid.y - 22, grid.w + 36, grid.h + 44, 26); text('AWS', grid.x - 4, grid.y - 28, ACCENT); } });
    ledge(photo.x, photo.y, photo.w, { land: () => say("that's Luca") });
    const fy = ab.b - 6, bw = 84, bx = Math.max(colL + 30, 24);
    floor(fy, [[bx, bw]]);
    const PERIOD = 5000, OPEN = 900;
    const gateOpen = now => now % PERIOD > PERIOD - OPEN;
    const gate = ledge(bx + 4, fy + 48, bw - 8, { tick: now => { gate.solid = !gateOpen(now); }, land: () => say('stored in S3 as a file') });
    const bucket = { x: bx, y: fy, w: bw, d: 52 };
    things.push({ draw: now => drawBucket(bucket, gateOpen(now), now, PERIOD, OPEN) });

    // Experience: la tarea de Airflow carga el archivo por el margen y Monte Carlo lo revisa a mitad de camino.
    const exp = box($('#experience')), tl = box($('.tablist'));
    // El warehouse queda en el hueco libre bajo las pestañas, arriba del piso.
    const mx = Math.max(colL - 30, 10), wy = exp.b - 72, wx = tl.x;
    const top = wy - 240;
    const path = [[bx + bw / 2, fy + 56], [bx + bw / 2, fy + 70], [mx, fy + 70], [mx, top], [wx + 28, top], [wx + 28, top + 30]];
    const scan = [mx, (fy + 70 + top) / 2];
    const pipe = { path, scan, mouth: [bx + bw / 2, fy + 56] };
    things.push({ draw: now => drawPipe(pipe, now) });

    // Snowflake: adentro, dbt construye los modelos en orden (raw, staging, mart) y el warehouse escala
    // mientras lo usas y se suspende solo cuando lo dejas.
    const sfW = Math.max(210, Math.min(tl.w + 28, W - wx - 16));
    things.push({ draw: () => { dashedBox(wx - 14, top - 18, sfW, wy - top + 46, 18); snowflake(wx + 2, top - 26, 5, ACCENT); text('Snowflake', wx + 12, top - 22, ACCENT); } });
    const models = [['raw.orders', 0], ['stg_orders', 1], ['fct_orders', 2]];
    models.forEach(([name, k]) => {
      const m = ledge(wx + (k % 2 ? 70 : 0), top + 60 + k * 50, 118, { kind: 'model', name, built: false });
      m.land = () => { if (!m.built) { m.built = true; say(k === 0 ? `dbt: ${name} loaded` : `dbt run · ${name} ✓`, m.x + m.w / 2, m.y - 14, 1500); } };
    });
    const SIZES = ['XS', 'S', 'M', 'L', 'XL'], maxW = sfW - 28;
    const wh = ledge(wx, wy, 56, { size: 0, idle: 0, grow: 0, kind: 'warehouse' });
    wh.land = () => say(wh.size ? 'warehouse resumed' : 'Snowflake: warehouse running');
    wh.stand = dt => { wh.idle = 0; wh.grow += dt; if (wh.grow > 0.55 && wh.size < SIZES.length - 1) { wh.size++; wh.grow = 0; say(`scaled up to ${SIZES[wh.size]}`, wh.x + wh.w / 2, wh.y - 16, 900); } };
    wh.tick = (now, dt) => {
      if (P.on !== wh) { wh.grow = 0; wh.idle += dt; if (wh.idle > 1.6 && wh.size) { wh.size = 0; say('auto-suspended · $0', wh.x + 40, wh.y - 16, 1400); } }
      const target = 56 + (maxW - 56) * wh.size / (SIZES.length - 1);
      wh.w += (target - wh.w) * Math.min(1, dt * 6);
    };
    wh.label = () => SIZES[wh.size];
    // El piso es la línea de una planta, en tiempo real: te lleva hacia la salida.
    // El hueco de salida queda justo arriba del chat de Nutrigordo, el primer producto.
    const card0 = $('#projects .card'), c0 = card0 ? box(card0) : { r: colR, w: 200 };
    const gx = Math.min(W - 100, Math.max(colL, c0.r - Math.min(170, c0.w * 0.8) / 2 - 45)), ey = exp.b - 6;
    ledge(-60, ey, gx + 60, { floor: true, belt: 70 });
    ledge(gx + 90, ey, W - gx - 30, { floor: true, belt: -70 });
    things.push({ draw: now => { drawGap(gx + 45, ey, now); drawBelt(colL - 10, gx - 6, ey, now, 1); drawBelt(gx + 96, Math.max(gx + 140, colR), ey, now, -1); } });

    // Projects: tres productos, cada uno con su mecánica.
    const cards = [...document.querySelectorAll('#projects .card')].map(box);
    if (cards[0]) {
      // Nutrigordo: le escribís y el chat te contesta con una burbuja nueva.
      const c = cards[0], w = Math.min(170, c.w * 0.8);
      const lines = [['2 eggs and toast', 'me'], ['✓ logged · 412 kcal', 'bot'], ['and a coffee', 'me'], ['✓ 418 kcal today', 'bot']];
      const bubbles = lines.map(([t, who], k) => ledge(who === 'me' ? c.r - w : c.x, c.y + 64 + k * 60, w, { kind: 'bubble', text: t, who, shown: k === 0 ? 1 : 0, solid: k === 0 }));
      bubbles.forEach((b, k) => { b.land = () => { const next = bubbles[k + 1]; if (next && !next.solid) { next.typing = performance.now(); setTimeout(() => { next.solid = true; }, 700); } }; });
    }
    if (cards[1]) {
      // PrimeroLab: la flashcard se da vuelta, desaparece y vuelve cada vez más tarde.
      const c = cards[1], w = Math.min(150, c.w * 0.62);
      [0, 1].forEach(k => {
        const f = ledge(k ? c.r - w : c.x, c.y + c.h * (0.55 + k * 0.22), w, { kind: 'card', q: k ? 'Q: what is RAG?' : 'Q: SQL JOIN?', a: k ? 'A: search + generate ✓' : 'A: match rows ✓', flip: 0, gone: 0, gap: 2 });
        f.stand = dt => { if (!f.gone) { f.flip = Math.min(1, f.flip + dt * 1.6); if (f.flip === 1 && !f.away) { f.away = performance.now() + 500; } } };
        f.tick = now => {
          if (f.away && now > f.away && !f.gone) { f.gone = now + f.gap * 1000; f.solid = false; say(`see you in ${f.gap}s`, f.x + f.w / 2, f.y - 14, 1400); f.gap *= 2; f.away = 0; }
          if (f.gone && now > f.gone) { f.gone = 0; f.solid = true; f.flip = 0; }
        };
      });
    }
    if (cards[2]) {
      // DataChinchilla: el camino sale de tu CV. Los pasos que ya tienes quedan tachados y no frenan.
      const c = cards[2];
      const have = [1, 4];
      for (let k = 0; k < 6; k++) {
        const s = ledge(c.x + (k % 2 ? c.w * 0.5 : 4), c.y + c.h * 0.42 + k * 44, Math.min(70, c.w * 0.4), { kind: 'step', have: have.includes(k), solid: !have.includes(k), n: k + 1 });
        if (k === 0) s.land = () => say('your path, from your CV');
        if (k === 5) s.land = () => say('only what you were missing');
      }
    }
    const pr = box($('#projects'));
    floor(pr.b - 6, [[colR - 100, 90]]);

    // How I work: cada regla es un escalón. Pisarla la abre, para leerla con calma.
    const rows = [...document.querySelectorAll('.pr-item')];
    rows.forEach((row, k) => {
      const b = box(row), part = k % 2 ? [b.x + b.w * 0.3, b.w * 0.7] : [b.x, b.w * 0.7];
      ledge(part[0], b.y, part[1], { kind: 'rule', land: () => { row.click(); say(row.querySelector('.n em').textContent.toLowerCase()); } });
    });
    const how = box($('#principles'));
    floor(how.b - 6, [[colL + 10, 90]]);

    // Education: cada credencial se sella al pisarla.
    const items = [...document.querySelectorAll('#education .list li')];
    items.forEach((li, k) => {
      const b = box(li), part = k % 2 ? [b.x + b.w * 0.35, b.w * 0.65] : [b.x, b.w * 0.65];
      const cred = li.querySelector('.cred');
      const words = k === 0 ? 'class of 2026' : li.textContent.includes('English') ? 'hello · hola' : cred ? 'verified ✓' : 'done ✓';
      ledge(part[0], b.y, part[1], { kind: 'row', land: () => { li.classList.remove('stamp'); void li.offsetWidth; li.classList.add('stamp'); say(words); } });
    });
    const ed = box($('#education'));
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
    return { plats, things, pipe, bucket, mailbox, checkpoints, colL, colR, docH: document.documentElement.scrollHeight };
  }

  // ---------- dibujo ----------
  function text(t, x, y, color = MUTED, align = 'left', font = MONO) {
    ctx.font = font; ctx.textAlign = align;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(t, x, y);
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function dashedBox(x, y, w, h, r) { ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(94,234,212,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); ctx.setLineDash([]); }
  function drawGap(x, y, now) { const k = Math.sin(now / 250) * 3; text('↓', x, y + 4 + k, ACCENT, 'center', '14px "JetBrains Mono", monospace'); }
  function drawBucket(b, open, now, period, openFor) {
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(b.x - 6, b.y); ctx.lineTo(b.x + 6, b.y + b.d); ctx.lineTo(b.x + b.w - 6, b.y + b.d); ctx.lineTo(b.x + b.w + 6, b.y); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y, b.w / 2 + 6, 5, 0, 0, Math.PI * 2); ctx.stroke();
    if (open) { ctx.fillStyle = INK; ctx.fillRect(b.x + 8, b.y + b.d - 2, b.w - 16, 4); }
    text('S3', b.x + b.w / 2, b.y + b.d / 2 + 6, ACCENT, 'center');
    // El DAG de Airflow: sus tareas se encienden en orden y, cuando le toca correr, se abre la compuerta.
    const cx = b.x + b.w + 22, cy = b.y + 22, left = (period - openFor - (now % period)) / 1000;
    const lit = open ? 3 : Math.floor((now % period) / (period - openFor) * 3);
    const nodes = [[cx, cy], [cx + 22, cy - 9], [cx + 22, cy + 9], [cx + 44, cy]];
    ctx.strokeStyle = MUTED; ctx.lineWidth = 1.2; ctx.beginPath();
    [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([a, z]) => { ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[z][0], nodes[z][1]); }); ctx.stroke();
    nodes.forEach(([x, y], k) => { const on = (k === 0 ? 1 : k === 3 ? 3 : 2) <= lit; ctx.fillStyle = on ? ACCENT : INK; ctx.strokeStyle = on ? ACCENT : MUTED; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    text(open ? 'Airflow: DAG running' : `Airflow: next run ${Math.max(0, left).toFixed(0)}s`, cx + 54, cy + 4, open ? ACCENT : MUTED);
  }
  function drawPipe(p, now) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); p.path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(94,234,212,.14)'; ctx.lineWidth = 20; ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -now / 30; ctx.stroke(); ctx.setLineDash([]);
    const [x2, y2] = p.path[2];
    text('Airflow · load', x2 + 16, y2 - 14, ACCENT);
    const [sx, sy] = p.scan, k = (Math.sin(now / 300) + 1) / 2;
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(sx - 16, sy - 20, 32, 40, 8); ctx.stroke();
    ctx.globalAlpha = 0.5 + k * 0.5; ctx.beginPath(); ctx.moveTo(sx - 13, sy - 16 + k * 32); ctx.lineTo(sx + 13, sy - 16 + k * 32); ctx.stroke(); ctx.globalAlpha = 1;
    // La etiqueta va del lado del margen cuando hay lugar, para no tapar el texto.
    if (sx > 120) text('Monte Carlo', sx - 22, sy + 4, ACCENT, 'right'); else text('Monte Carlo', sx + 22, sy + 4, ACCENT);
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
    if (p.kind === 'warehouse') {
      const on = p.size > 0;
      ctx.fillStyle = on ? 'rgba(94,234,212,.22)' : 'rgba(148,163,184,.12)'; ctx.strokeStyle = on ? ACCENT : MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 7, 3); ctx.fill(); ctx.stroke();
      snowflake(p.x + 10, p.y + 18, 6, on ? ACCENT : MUTED);
      text(`warehouse ${p.label()}`, p.x + 22, p.y + 22, on ? ACCENT : MUTED);
      return;
    }
    if (p.kind === 'model') {
      ctx.fillStyle = p.built ? 'rgba(94,234,212,.18)' : 'rgba(148,163,184,.1)'; ctx.strokeStyle = p.built ? ACCENT : MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 6, 3); ctx.fill(); ctx.stroke();
      text(`${p.built ? '✓ ' : ''}${p.name}`, p.x + 4, p.y + 20, p.built ? ACCENT : MUTED);
      return;
    }
    if (p.kind === 'bubble') {
      if (!p.solid && !p.typing) return;
      const typing = !p.solid, me = p.who === 'me';
      ctx.fillStyle = BG; ctx.strokeStyle = me ? ACCENT : MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 26, 10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); if (me) { ctx.moveTo(p.x + p.w - 14, p.y + 26); ctx.lineTo(p.x + p.w - 4, p.y + 34); ctx.lineTo(p.x + p.w - 24, p.y + 26); } else { ctx.moveTo(p.x + 14, p.y + 26); ctx.lineTo(p.x + 4, p.y + 34); ctx.lineTo(p.x + 24, p.y + 26); }
      ctx.fill(); ctx.stroke();
      if (typing) { for (let k = 0; k < 3; k++) { ctx.fillStyle = MUTED; ctx.globalAlpha = fade * (0.4 + 0.6 * ((Math.floor(now / 200) % 3) === k)); ctx.beginPath(); ctx.arc(p.x + 16 + k * 9, p.y + 13, 2.5, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = fade; }
      else text(p.text, p.x + 10, p.y + 17, me ? ACCENT : '#e2e8f0');
      return;
    }
    if (p.kind === 'card') {
      if (p.gone) { ctx.globalAlpha = fade * 0.25; ctx.setLineDash([3, 4]); ctx.strokeStyle = MUTED; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 28, 6); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = fade; return; }
      const k = Math.abs(Math.cos(p.flip * Math.PI)), back = p.flip > 0.5;
      ctx.save(); ctx.translate(0, p.y + 14); ctx.scale(1, Math.max(0.08, k)); ctx.translate(0, -14);
      ctx.fillStyle = BG; ctx.strokeStyle = back ? ACCENT : MUTED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, 0, p.w, 28, 6); ctx.fill(); ctx.stroke();
      text(back ? p.a : p.q, p.x + p.w / 2, 18, back ? ACCENT : '#e2e8f0', 'center');
      ctx.restore();
      return;
    }
    if (p.kind === 'step') {
      ctx.globalAlpha = fade * (p.have ? 0.35 : 1);
      ctx.fillStyle = p.have ? 'rgba(148,163,184,.15)' : 'rgba(94,234,212,.18)'; ctx.strokeStyle = p.have ? MUTED : ACCENT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 10, 5); ctx.fill(); ctx.stroke();
      if (p.have) text('✓ have it', p.x + p.w / 2, p.y + 24, MUTED, 'center');
      ctx.globalAlpha = fade;
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
    } else if (level && P.on && !P.on.floor) drawPlat(P.on, now);
    // La estela del muñequito cuando atraviesa el retrato.
    P.trail.forEach((t, k) => { ctx.globalAlpha = (k / P.trail.length) * 0.35; ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(t[0] + 4, t[1] + 4, S - 8, S - 8, 5); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (mode === 'wait' || opened) drawEnvelope(envelope(), now);
    if (mode !== 'wait' && !(mode === 'intro' && intro && now < intro.t0) && seen(P.y)) drawPk(P.x, P.y, now);
    labels = labels.filter(l => now < l.until);
    // Los cartelitos nunca se salen de la pantalla.
    ctx.font = MONO;
    for (const l of labels) {
      const k = Math.min(1, (l.until - now) / 300), half = ctx.measureText(l.text).width / 2 + 8;
      ctx.globalAlpha = k; text(l.text, Math.max(half, Math.min(W - half, l.x)), l.y - (1 - k) * 6, ACCENT, 'center'); ctx.globalAlpha = 1;
    }
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
    if (P.ride) {
      P.ride.d += dt * 620;
      const [x, y, end] = rideTo(P.ride.d);
      P.x = x - S / 2; P.y = y - S / 2;
      if (!P.ride.scanned && Math.abs(y - level.pipe.scan[1]) < 12 && Math.abs(x - level.pipe.scan[0]) < 12) { P.ride.scanned = true; say('Monte Carlo: fresh, schema ok ✓', x + 70, y - 24, 1800); }
      if (end) { P.ride = null; P.form = 'pk'; P.vy = 0; say('loaded into Snowflake'); }
      return;
    }
    for (const p of level.plats) if (p.tick) p.tick(now, dt);
    const dir = control ? ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) : 0;
    if (dir) P.face = dir;
    P.vx = dir * SPEED + (P.on && P.on.belt ? P.on.belt : 0);
    P.x += P.vx * dt;
    if (P.x > W) P.x -= W + S;
    if (P.x < -S) P.x += W + S;
    if (control && keys.jump && P.ground) { P.vy = -JUMP; P.ground = false; P.squash = -0.7; }
    if (control && keys.down && P.ground && P.on && !P.on.floor) { P.dropUntil = now + 220; P.ground = false; }
    const prevBottom = P.y + S;
    P.vy = Math.min(P.vy + GRAVITY * dt, 1300);
    P.y += P.vy * dt;
    const was = P.on; P.on = null; P.ground = false;
    if (P.vy >= 0) {
      for (const p of level.plats) {
        if (!p.solid) continue;
        if (now < P.dropUntil && !p.floor && p === was) continue;
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

    const b = level.bucket, cx = P.x + S / 2;
    const inBucket = cx > b.x && cx < b.x + b.w && P.y + S > b.y - 2 && P.y < b.y + b.d + 20;
    if (P.form !== 'mail') P.form = inBucket ? 'file' : 'pk';
    if (inBucket && P.y + S > b.y + b.d + 4) { P.ride = { d: 0 }; P.form = 'dot'; say('Airflow: load task running', P.x + 90, P.y, 1500); }

    const m = level.mailbox;
    if (!won && P.x + S > m.x - 6 && P.x < m.x + m.w + 6 && P.y + S > m.y - 10 && P.y < m.y + m.h) {
      won = true; P.form = 'mail'; say('delivered! now send the real one', m.x + m.w / 2, m.y - 24, 4000);
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
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
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
  window.__pk = { activate, state: () => ({ mode, x: Math.round(P.x), y: Math.round(P.y), form: P.form, ride: !!P.ride, won, on: P.on && (P.on.kind || (P.on.floor ? 'floor' : 'ledge')), scrollY }), start, stop, keys: k => Object.assign(keys, k), place: (x, y) => { P.x = x; P.y = y; P.vy = 0; }, sim: ms => { let t = performance.now(); for (let k = 0; k < ms / 16; k++) { t += 16; step(0.016, t, mode === 'play'); } return window.__pk.state(); } };

  resize();
  last = performance.now(); requestAnimationFrame(frame);
})();
