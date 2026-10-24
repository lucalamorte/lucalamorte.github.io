// Game mode: un juego de plataformas sobre la portada. Un paquete de datos salta entre tramos de
// pipeline y junta los registros; los tramos salen del propio contenido (título, texto, botón).
(() => {
  const hero = document.querySelector('.hero');
  const toggle = document.getElementById('play');
  if (!hero || !toggle) return;
  // Sin teclado no hay juego: en pantallas táctiles el botón no aparece.
  if (matchMedia('(pointer: coarse)').matches) { toggle.hidden = true; return; }

  const status = document.getElementById('play-status');
  const canvas = document.createElement('canvas');
  canvas.className = 'play-layer';
  hero.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const ACCENT = '#5eead4', LINE = 'rgba(148,163,184,.55)', INK = '#0b1120';
  const GRAVITY = 1900, JUMP = 760, SPEED = 320, SIZE = 26, RECORDS = 5;

  let playing = false, width = 0, height = 0, platforms = [], records = [], player, keys = {}, last = 0;

  // Los tramos: el borde de arriba de cada bloque de la portada más unos escalones repartidos.
  function layout() {
    const box = hero.getBoundingClientRect();
    width = box.width; height = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const local = el => { const r = el.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, w: r.width }; };
    const blocks = ['.hero h1', '.hero .intro p', '.hero .cta .btn'].map(s => hero.querySelector(s)).filter(Boolean).map(local);
    const steps = [0.18, 0.34, 0.5].map((fx, i) => ({ x: width * fx, y: height * (0.72 - i * 0.16), w: width * 0.12 }));
    platforms = [...blocks, ...steps, { x: 0, y: height - 8, w: width }];
    const tops = platforms.slice(0, -1);
    records = Array.from({ length: RECORDS }, (_, i) => {
      const p = tops[(i * 2 + 1) % tops.length];
      return { x: p.x + p.w * (0.25 + 0.5 * ((i * 37) % 10) / 10), y: p.y - 34, got: false };
    });
    player = { x: 24, y: height - 8 - SIZE, vx: 0, vy: 0, ground: true };
  }

  function say(text) { if (status) status.textContent = text; }
  function score() { return records.filter(r => r.got).length; }

  function step(dt) {
    player.vx = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    player.x = Math.max(0, Math.min(width - SIZE, player.x + player.vx * SPEED * dt));
    if ((keys.ArrowUp || keys.w || keys[' ']) && player.ground) { player.vy = -JUMP; player.ground = false; }
    const prevBottom = player.y + SIZE;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    player.ground = false;
    // Tramos de un solo sentido: se aterriza desde arriba y se los atraviesa desde abajo.
    for (const p of platforms) {
      const bottom = player.y + SIZE;
      if (player.vy >= 0 && prevBottom <= p.y + 1 && bottom >= p.y && player.x + SIZE > p.x && player.x < p.x + p.w) {
        player.y = p.y - SIZE; player.vy = 0; player.ground = true;
      }
    }
    for (const r of records) {
      if (!r.got && Math.abs(player.x + SIZE / 2 - r.x) < 20 && Math.abs(player.y + SIZE / 2 - r.y) < 22) {
        r.got = true;
        const n = score();
        say(n === RECORDS ? 'All records loaded. Pipeline is green.' : `${n} / ${RECORDS} records loaded`);
      }
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t / 40;
    for (const p of platforms.slice(0, -1)) {
      ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const r of records) {
      if (r.got) continue;
      const bob = Math.sin(t / 300 + r.x) * 3;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(r.x, r.y - 5 + bob, 7, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x - 7, r.y - 5 + bob); ctx.lineTo(r.x - 7, r.y + 5 + bob);
      ctx.ellipse(r.x, r.y + 5 + bob, 7, 2.5, 0, Math.PI, 0, true); ctx.lineTo(r.x + 7, r.y - 5 + bob); ctx.stroke();
    }
    // El jugador: un paquete con ojos que miran hacia donde va.
    const { x, y } = player;
    ctx.shadowColor = ACCENT; ctx.shadowBlur = 16;
    ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(x, y, SIZE, SIZE, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = INK; const look = player.vx * 2;
    ctx.fillRect(x + 6 + look, y + 8, 4, 6); ctx.fillRect(x + 16 + look, y + 8, 4, 6);
  }

  function frame(now) {
    if (!playing) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    step(dt); draw(now);
    requestAnimationFrame(frame);
  }

  function start() {
    playing = true; layout(); keys = {};
    hero.classList.add('playing'); toggle.classList.add('on'); toggle.setAttribute('aria-pressed', 'true');
    say(`← → to move · space to jump · esc to quit · 0 / ${RECORDS} records`);
    last = performance.now(); requestAnimationFrame(frame);
  }
  function stop() {
    playing = false; ctx.clearRect(0, 0, width, height);
    hero.classList.remove('playing'); toggle.classList.remove('on'); toggle.setAttribute('aria-pressed', 'false'); say('');
  }

  toggle.addEventListener('click', () => (playing ? stop() : start()));
  addEventListener('keydown', event => {
    if (!playing) return;
    if (event.key === 'Escape') { stop(); return; }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'].includes(key)) { keys[key] = true; event.preventDefault(); }
  });
  addEventListener('keyup', event => { keys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
  addEventListener('resize', () => { if (playing) layout(); });
})();
