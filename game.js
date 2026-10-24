// Game mode: un nivel que recorre el portfolio de arriba a abajo con el stack de Luca como escenario.
// Se baja por huecos y tubos: el bucket de S3 lleva a la pipeline de Azure Data Factory, Hightouch
// lanza hacia los proyectos, los escalones son el ciclo de vida y la meta es el contacto.
// Los costados no son paredes: lo que sale por un lado entra por el otro.
(() => {
  const toggle = document.getElementById('play');
  if (!toggle) return;
  // Se juega con teclado: en pantallas táctiles el botón no aparece.
  if (matchMedia('(pointer: coarse)').matches) { toggle.hidden = true; return; }

  const status = document.getElementById('play-status');
  const canvas = document.createElement('canvas');
  canvas.className = 'play-layer';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const ACCENT = '#5eead4', MUTED = '#94a3b8', LINE = 'rgba(148,163,184,.6)', INK = '#0b1120', RED = '#f87171';
  const GRAVITY = 1900, JUMP = 760, SPEED = 330, SIZE = 26, MONO = '11px "JetBrains Mono", monospace';

  let playing = false, won = false, W = 0, platforms = [], decor = [], records = [], pipes = [], springs = [];
  let player, keys = {}, last = 0, toast = null, goal = null;

  const $ = s => document.querySelector(s);
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY, r: r.right }; };
  // Un piso de lado a lado con un hueco: es la única forma de bajar, salvo por un tubo.
  const floor = (y, gapX, gapW, label) => {
    if (gapW) { platforms.push({ x: -40, y, w: gapX + 40 }, { x: gapX + gapW, y, w: W - gapX - gapW + 40 }); decor.push({ kind: 'gap', x: gapX, y, w: gapW, label }); }
    else platforms.push({ x: -40, y, w: W + 80 });
  };
  const ledge = (x, y, w, label, extra = {}) => { const p = { x, y, w, label, ...extra }; platforms.push(p); return p; };
  const record = (x, y) => records.push({ x, y, got: false });

  function build() {
    W = document.documentElement.clientWidth;
    platforms = []; decor = []; records = []; pipes = []; springs = [];
    const hero = box($('.hero')), col = { l: hero.x, r: hero.r };
    const cx = (col.l + col.r) / 2;

    // Portada: el título, el texto y los botones son plataformas; se baja por la derecha.
    ['.hero h1', '.hero .intro p', '.hero .cta'].forEach(s => { const b = box($(s)); ledge(b.x, b.y, b.w); });
    record(box($('.hero h1')).x + 40, box($('.hero h1')).y - 34);
    floor(hero.b - 30, col.r - 160, 90, 'jump down');

    // About: adentro de AWS. Snowflake corre ahí, y el bucket de S3 es la salida.
    const about = box($('#about'));
    decor.push({ kind: 'cloud', x: col.l - 24, y: about.y + 20, w: col.r - col.l + 48, h: about.h - 40, label: 'AWS' });
    const snow = ledge(cx + 40, about.y + about.h * 0.45, 200, 'Snowflake', { icon: 'snow' });
    record(snow.x + 100, snow.y - 34);
    ledge(col.l + 30, about.y + about.h * 0.7, 150, 'S3');
    floor(about.b - 26, col.l + 40, 80, 'S3 bucket');
    decor.push({ kind: 'bucket', x: col.l + 40, y: about.b - 26, w: 80 });

    // Experience: el bucket cae en la boca de la pipeline de Azure Data Factory, que cruza el piso.
    const exp = box($('#experience'));
    const proj = box($('#projects'));
    const start = { x: col.l + 80, y: exp.y + 70 };
    const path = [[start.x, start.y], [col.r - 60, start.y], [col.r - 60, exp.y + exp.h * 0.6], [col.l + 160, exp.y + exp.h * 0.6], [col.l + 160, proj.y + 70]];
    pipes.push({ path, mouth: start, label: 'Azure Data Factory', check: 2 });
    record(col.r - 100, exp.y + exp.h * 0.6 - 60);
    ledge(col.r - 230, exp.y + exp.h * 0.6 - 30, 140, 'Control-M', { blink: true });
    floor(exp.b - 20, 0, 0);

    // Projects: la pipeline sale sobre Hightouch, que lanza hacia los tres productos.
    springs.push({ x: col.l + 130, y: proj.y + 150, w: 60, label: 'Hightouch → marketing' });
    ledge(col.l + 110, proj.y + 150, 100);
    const cards = [...document.querySelectorAll('#projects .card')].map(box);
    if (cards[0]) ledge(cards[0].x + 20, cards[0].y + 30, cards[0].w * 0.5, 'Telegram', { move: 70, icon: 'plane' });
    if (cards[1]) ledge(cards[1].x + 20, cards[1].y + cards[1].h * 0.35, cards[1].w * 0.55, 'flashcard', { flip: true });
    if (cards[2]) [0, 1, 2].forEach(k => ledge(cards[2].x + 10 + k * cards[2].w * 0.32, cards[2].y + cards[2].h * (0.25 + k * 0.18), 44, k === 0 ? 'path' : ''));
    if (cards[0]) record(cards[0].x + cards[0].w * 0.3, cards[0].y);
    if (cards[2]) record(cards[2].x + cards[2].w * 0.75, cards[2].y + cards[2].h * 0.4);
    floor(proj.b - 20, col.r - 120, 90, '');

    // How I work: seis escalones, uno por etapa del ciclo de vida.
    const how = box($('#principles'));
    ['Define', 'Design', 'Build', 'Ship', 'Run', 'Learn'].forEach((stage, k) => {
      const x = col.r - 150 - k * ((col.r - col.l - 200) / 5);
      ledge(x, how.y + 90 + k * (how.h - 160) / 6, 110, stage);
    });
    record(col.l + 80, how.y + how.h - 130);
    floor(how.b - 20, col.l + 20, 90, '');

    // Education: Control-M aparece y desaparece según su horario.
    const edu = box($('#education'));
    const cm = ledge(cx - 60, edu.y + edu.h * 0.5, 130, 'Control-M', { blink: true });
    record(cm.x + 65, cm.y - 34);
    floor(edu.b - 16, cx + 160, 90, '');

    // Contacto: el buzón es la meta.
    const contact = box($('#contact'));
    const btn = box($('#contact .btn'));
    goal = { x: btn.r + 30, y: btn.y + btn.h - 34, w: 40, h: 34 };
    floor(contact.b - 30, 0, 0);
    ledge(btn.x - 40, btn.y + btn.h, btn.w + 140);

    player = { x: col.l + 20, y: hero.b - 30 - SIZE, vx: 0, vy: 0, ground: false, pipe: null, stand: 0, on: null };
  }

  const say = text => { if (status) status.textContent = text; };
  const got = () => records.filter(r => r.got).length;
  const flash = (text, ms = 1600) => { toast = { text, until: performance.now() + ms }; };
  const solid = (p, now) => !(p.blink && (now % 2600) > 1600) && !(p.flip && p.flipped && now < p.flipped);

  function step(dt, now) {
    if (player.pipe) {
      const pipe = player.pipe;
      pipe.t += dt * 900;
      let d = pipe.t, k = 1;
      for (; k < pipe.path.length; k++) {
        const [ax, ay] = pipe.path[k - 1], [bx, by] = pipe.path[k], len = Math.hypot(bx - ax, by - ay);
        if (d <= len) { player.x = ax + (bx - ax) * d / len - SIZE / 2; player.y = ay + (by - ay) * d / len - SIZE / 2; break; }
        d -= len;
      }
      if (k === pipe.check && !pipe.checked) { pipe.checked = true; flash('Monte Carlo: quality check passed'); }
      if (k >= pipe.path.length) { player.pipe = null; player.vy = 200; flash('Out of the pipeline'); }
      return;
    }
    player.vx = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    player.x += player.vx * SPEED * dt;
    // Sin paredes: se sale por un costado y se entra por el otro.
    if (player.x > W) player.x -= W + SIZE;
    if (player.x < -SIZE) player.x += W + SIZE;
    if ((keys.ArrowUp || keys.w || keys[' ']) && player.ground) { player.vy = -JUMP; player.ground = false; }
    const prevBottom = player.y + SIZE;
    player.vy = Math.min(player.vy + GRAVITY * dt, 1400);
    player.y += player.vy * dt;
    if (player.on && player.on.move) player.x += Math.cos(now / 700) * player.on.move * dt * 1.4;
    player.ground = false; const was = player.on; player.on = null;
    for (const p of platforms) {
      const px = p.move ? p.x + Math.sin(now / 700) * p.move : p.x;
      if (!solid(p, now)) continue;
      if (player.vy >= 0 && prevBottom <= p.y + 2 && player.y + SIZE >= p.y && player.x + SIZE > px && player.x < px + p.w) {
        player.y = p.y - SIZE; player.vy = 0; player.ground = true; player.on = p;
      }
    }
    // Una flashcard se da vuelta si te quedas parado encima.
    if (player.on && player.on === was && player.on.flip) {
      player.stand += dt;
      if (player.stand > 0.7) { player.on.flipped = now + 1500; player.stand = 0; flash('Flipped! Spaced repetition says: see you later'); }
    } else player.stand = 0;
    for (const s of springs) {
      if (player.vy >= 0 && Math.abs(player.y + SIZE - s.y) < 6 && player.x + SIZE > s.x && player.x < s.x + s.w) { player.vy = -JUMP * 1.55; player.ground = false; flash('Hightouch: synced to marketing'); }
    }
    for (const pipe of pipes) {
      if (Math.abs(player.x + SIZE / 2 - pipe.mouth.x) < 30 && Math.abs(player.y + SIZE / 2 - pipe.mouth.y) < 30) { player.pipe = { ...pipe, t: 0, checked: false }; flash('Into the Azure Data Factory pipeline'); }
    }
    for (const r of records) {
      if (!r.got && Math.abs(player.x + SIZE / 2 - r.x) < 22 && Math.abs(player.y + SIZE / 2 - r.y) < 24) { r.got = true; say(`${got()} / ${records.length} records loaded · esc to quit`); }
    }
    if (!won && goal && player.x + SIZE > goal.x - 10 && player.x < goal.x + goal.w + 10 && player.y + SIZE > goal.y - 10 && player.y < goal.y + goal.h + 10) {
      won = true; say(`You made it, with ${got()} / ${records.length} records. Now say hi!`); flash('Delivered. Say hi!', 4000);
      document.querySelector('#contact .btn').classList.add('wiggle');
    }
  }

  function text(t, x, y, color = MUTED, align = 'left') { ctx.font = MONO; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, y); }

  function draw(now) {
    const top = scrollY, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -top);
    const seen = (y, h = 0) => y + h > top - 80 && y < top + H + 80;
    for (const d of decor) {
      if (d.kind === 'cloud' && seen(d.y, d.h)) {
        ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(94,234,212,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, 28); ctx.stroke(); ctx.setLineDash([]);
        text(d.label, d.x + 18, d.y + 22, ACCENT);
      }
      if (d.kind === 'bucket' && seen(d.y)) {
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(d.x - 6, d.y - 22); ctx.lineTo(d.x + 4, d.y + 6); ctx.lineTo(d.x + d.w - 4, d.y + 6); ctx.lineTo(d.x + d.w + 6, d.y - 22); ctx.stroke();
        text('S3 bucket', d.x + d.w / 2, d.y + 22, ACCENT, 'center');
      }
      if (d.kind === 'gap' && d.label && seen(d.y)) text(`↓ ${d.label}`, d.x + d.w / 2, d.y - 10, MUTED, 'center');
    }
    for (const pipe of pipes) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(94,234,212,.18)'; ctx.lineWidth = 22;
      ctx.beginPath(); pipe.path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -now / 25; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(pipe.mouth.x, pipe.mouth.y, 16, 0, Math.PI * 2); ctx.strokeStyle = ACCENT; ctx.lineWidth = 3; ctx.stroke();
      text(pipe.label, pipe.mouth.x + 26, pipe.mouth.y - 18, ACCENT);
      const [mx, my] = pipe.path[pipe.check - 1];
      text('Monte Carlo ✓', mx - 10, my - 18, ACCENT, 'right');
    }
    for (const s of springs) {
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 6; k++) ctx.lineTo(s.x + s.w / 2 + (k % 2 ? 10 : -10), s.y + 12 - k * 2);
      ctx.stroke(); ctx.fillStyle = ACCENT; ctx.fillRect(s.x, s.y - 3, s.w, 3);
      text(s.label, s.x + s.w / 2, s.y + 30, ACCENT, 'center');
    }
    ctx.lineWidth = 2;
    for (const p of platforms) {
      if (!seen(p.y)) continue;
      const px = p.move ? p.x + Math.sin(now / 700) * p.move : p.x;
      const on = solid(p, now);
      ctx.globalAlpha = on ? 1 : 0.18;
      ctx.strokeStyle = p.label ? ACCENT : LINE; ctx.setLineDash(p.blink ? [4, 4] : [8, 6]);
      ctx.beginPath(); ctx.moveTo(px, p.y); ctx.lineTo(px + p.w, p.y); ctx.stroke(); ctx.setLineDash([]);
      if (p.label) text(p.icon === 'snow' ? `❄ ${p.label}` : p.icon === 'plane' ? `➤ ${p.label}` : p.label, px + 4, p.y + 16, ACCENT);
      ctx.globalAlpha = 1;
    }
    for (const r of records) {
      if (r.got || !seen(r.y)) continue;
      const y = r.y + Math.sin(now / 300 + r.x) * 3;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(r.x, y - 5, 7, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x - 7, y - 5); ctx.lineTo(r.x - 7, y + 5); ctx.ellipse(r.x, y + 5, 7, 2.5, 0, Math.PI, 0, true); ctx.lineTo(r.x + 7, y - 5); ctx.stroke();
    }
    if (goal && seen(goal.y)) {
      ctx.strokeStyle = won ? ACCENT : MUTED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(goal.x, goal.y, goal.w, goal.h * 0.6, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goal.x + goal.w / 2, goal.y + goal.h * 0.6); ctx.lineTo(goal.x + goal.w / 2, goal.y + goal.h + 8); ctx.stroke();
      ctx.fillStyle = won ? ACCENT : RED; ctx.fillRect(goal.x + goal.w - 6, goal.y - 8, 3, 14); ctx.fillRect(goal.x + goal.w - 6, goal.y - 8, 10, 6);
      text('finish', goal.x + goal.w / 2, goal.y - 14, won ? ACCENT : MUTED, 'center');
    }
    if (!player.pipe) {
      const { x, y } = player;
      ctx.shadowColor = ACCENT; ctx.shadowBlur = 16; ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.roundRect(x, y, SIZE, SIZE, 6); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = INK; const look = player.vx * 2;
      ctx.fillRect(x + 6 + look, y + 8, 4, 6); ctx.fillRect(x + 16 + look, y + 8, 4, 6);
    } else {
      ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(player.x + SIZE / 2, player.y + SIZE / 2, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (toast && now < toast.until) {
      ctx.font = '600 14px Inter, sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(toast.text).width + 32;
      ctx.fillStyle = 'rgba(11,17,32,.9)'; ctx.fillRect(W / 2 - tw / 2, 84, tw, 34);
      ctx.fillStyle = ACCENT; ctx.fillText(toast.text, W / 2, 106);
    }
  }

  // La pantalla sigue al jugador mientras baja por la página.
  function follow() { scrollTo(0, Math.max(0, player.y - innerHeight * 0.45)); }

  function frame(now) {
    if (!playing) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    step(dt, now); follow(); draw(now);
    requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const block = event => { if (playing) event.preventDefault(); };
  function start() {
    // Todo visible desde el arranque, para medir bien dónde va cada plataforma.
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    document.documentElement.style.scrollBehavior = 'auto';
    playing = true; won = false; keys = {}; resize(); build();
    document.body.classList.add('playing'); toggle.classList.add('on'); toggle.setAttribute('aria-pressed', 'true');
    say(`← → move · space jump · esc quit · 0 / ${records.length} records`);
    flash('Get to the contact section. Sides wrap around.', 3000);
    last = performance.now(); requestAnimationFrame(frame);
  }
  function stop() {
    playing = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.documentElement.style.scrollBehavior = '';
    document.body.classList.remove('playing'); toggle.classList.remove('on'); toggle.setAttribute('aria-pressed', 'false'); say('');
  }

  toggle.addEventListener('click', () => (playing ? stop() : start()));
  addEventListener('keydown', event => {
    if (!playing) return;
    if (event.key === 'Escape') { stop(); return; }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w', 'PageDown', 'PageUp'].includes(key)) { keys[key] = true; event.preventDefault(); }
  });
  addEventListener('keyup', event => { keys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
  addEventListener('wheel', block, { passive: false });
  addEventListener('resize', () => { if (playing) { resize(); build(); } });
})();
