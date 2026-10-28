// Fondo: una nevada tenue de datos. Puntitos (registros) y copos de seis puntas (Snowflake) que caen despacio
// y se mecen; algunos en el color de acento. Cerca del cursor se apartan y brillan. Detrás de cada bloque de
// texto se desvanecen con un borde suave, así la lectura queda limpia.
(() => {
  const small = matchMedia('(max-width: 760px)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'pipelines';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, flakes = [];

  // Semilla fija: la nevada arranca igual en cada visita.
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = innerWidth; height = innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 11;
    const count = Math.round(width * height / (small ? 26000 : 15000));
    flakes = Array.from({ length: count }, () => {
      const flake = rand() < 0.32;
      return {
        x: rand() * width, y: rand() * height,
        r: flake ? 3 + rand() * 4 : 0.8 + rand() * 1.4,
        flake, accent: rand() < 0.25,
        fall: 6 + rand() * 14, sway: 6 + rand() * 14, phase: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * 0.4, alpha: 0.18 + rand() * 0.32, dx: 0, dy: 0,
      };
    });
  }

  // La máscara: la página entera a un cuarto de tamaño, con un rectángulo difuso por cada bloque de texto.
  const SCALE = 0.25, PAD = 10, SOFT = 44;
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const BLOCKS = 'main h1, main h2, main h3, main p, main ul, main ol, main img, main .cta, main .email, main .tabs, main .principles, main .card, main .stat, main .flow, main .facts, main .art-visual, main header, footer';
  function paintMask() {
    const docH = document.documentElement.scrollHeight;
    mask.width = Math.ceil(innerWidth * SCALE); mask.height = Math.ceil(docH * SCALE);
    mctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    mctx.fillStyle = mctx.shadowColor = '#000';
    mctx.shadowBlur = SOFT * SCALE;
    for (const el of document.querySelectorAll(BLOCKS)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      mctx.fillRect(r.left - PAD, r.top + scrollY - PAD, r.width + PAD * 2, r.height + PAD * 2);
    }
  }
  let pending = 0;
  const repaint = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { paintMask(); if (still) draw(0, 0); }); };

  const cursor = { x: 0, y: 0, on: false };
  addEventListener('pointermove', event => { cursor.x = event.clientX; cursor.y = event.clientY; cursor.on = event.pointerType === 'mouse'; }, { passive: true });
  document.addEventListener('pointerleave', () => { cursor.on = false; });

  function snowflake(x, y, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot + k * Math.PI / 3, cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      ctx.moveTo(x - cx, y - cy); ctx.lineTo(x + cx, y + cy);
    }
    ctx.stroke();
  }

  function draw(t, dt) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    for (const f of flakes) {
      if (dt) {
        f.y += f.fall * dt;
        if (f.y > height + 10) { f.y = -10; f.x = Math.random() * width; }
        // El cursor los aparta con suavidad y después vuelven a su caída.
        if (cursor.on) {
          const ddx = f.x + f.dx - cursor.x, ddy = f.y + f.dy - cursor.y, d = Math.hypot(ddx, ddy);
          if (d < 120) { const k = (1 - d / 120) * 60 * dt; f.dx += ddx / (d || 1) * k; f.dy += ddy / (d || 1) * k; }
        }
        f.dx *= 0.96; f.dy *= 0.96;
      }
      const x = f.x + f.dx + Math.sin(t / 1000 * 0.6 + f.phase) * f.sway, y = f.y + f.dy;
      const near = cursor.on ? Math.max(0, 1 - Math.hypot(x - cursor.x, y - cursor.y) / 160) : 0;
      const a = Math.min(1, f.alpha + near * 0.6);
      const color = f.accent || near > 0.3 ? `rgba(94,234,212,${a})` : `rgba(203,213,225,${a * 0.8})`;
      if (f.flake) { ctx.strokeStyle = color; ctx.lineWidth = 1.1; snowflake(x, y, f.r * (1 + near * 0.4), f.phase + t / 1000 * f.spin); }
      else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill(); }
    }
    if (mask.height) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, scrollY * SCALE, width * SCALE, height * SCALE, 0, 0, width, height);
    }
  }

  let last = 0;
  function frame(t) { const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; draw(t, dt); requestAnimationFrame(frame); }
  build(); paintMask();
  addEventListener('resize', () => { build(); repaint(); });
  addEventListener('load', repaint);
  if (document.fonts) document.fonts.ready.then(repaint);
  if ('ResizeObserver' in window) new ResizeObserver(repaint).observe(document.body);
  if (still) { draw(0, 0); addEventListener('scroll', () => draw(0, 0), { passive: true }); } else requestAnimationFrame(frame);
})();
