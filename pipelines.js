// Fondo: tramos de pipeline muy tenues, con codos rectos, y paquetes de datos que los recorren despacio.
// Detrás de cada bloque de texto se desvanecen con un borde suave, así se ven en los márgenes y entre secciones.
(() => {
  // En el celu la pantalla es casi toda texto: ahí el fondo sería ruido.
  if (matchMedia('(max-width: 760px)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'pipelines';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pipes = [], width = 0, height = 0;

  // Semilla fija: el dibujo es el mismo en cada visita.
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = innerWidth; height = innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 7;
    const count = Math.max(3, Math.round(height / 300));
    pipes = Array.from({ length: count }, (_, i) => {
      let x = -20, y = (i + 0.5) * height / count + (rand() - 0.5) * 60;
      const points = [[x, y]];
      while (x < width + 20) {
        x += 160 + rand() * 280; points.push([x, y]);
        y = Math.max(20, Math.min(height - 20, y + (rand() - 0.5) * 180)); points.push([x, y]);
      }
      const segments = [];
      let total = 0;
      for (let k = 1; k < points.length; k++) {
        const [ax, ay] = points[k - 1], [bx, by] = points[k];
        const length = Math.hypot(bx - ax, by - ay);
        segments.push({ ax, ay, bx, by, length, start: total });
        total += length;
      }
      return { points, segments, total, speed: 30 + rand() * 40, offset: rand() * total };
    });
  }

  // La máscara: la página entera a un cuarto de tamaño, con un rectángulo difuso por cada bloque de texto.
  const SCALE = 0.25, PAD = 10, SOFT = 44;
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const BLOCKS = 'main h1, main h2, main h3, main p, main ul, main ol, main img, main canvas, main .cta, main .email, main .tabs, main .principles, main .card, main .flow, main .facts, main .art-visual, main header, footer';
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
  const repaint = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { paintMask(); if (still) draw(0); }); };

  function at(pipe, d) {
    d = ((d % pipe.total) + pipe.total) % pipe.total;
    const s = pipe.segments.find(seg => d <= seg.start + seg.length) || pipe.segments[pipe.segments.length - 1];
    const k = s.length ? (d - s.start) / s.length : 0;
    return [s.ax + (s.bx - s.ax) * k, s.ay + (s.by - s.ay) * k];
  }

  function draw(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(148,163,184,.08)';
    for (const pipe of pipes) {
      ctx.beginPath();
      pipe.points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,.14)';
      for (let k = 1; k < pipe.points.length - 1; k += 2) { const [x, y] = pipe.points[k]; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      const head = pipe.offset + t / 1000 * pipe.speed;
      for (let k = 0; k < 6; k++) {
        const [x, y] = at(pipe, head - k * 5);
        ctx.fillStyle = `rgba(94,234,212,${0.34 - k * 0.05})`;
        ctx.beginPath(); ctx.arc(x, y, 2 - k * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (mask.height) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, scrollY * SCALE, width * SCALE, height * SCALE, 0, 0, width, height);
    }
  }

  function frame(t) { draw(t); requestAnimationFrame(frame); }
  build(); paintMask();
  addEventListener('resize', () => { build(); repaint(); });
  addEventListener('load', repaint);
  if (document.fonts) document.fonts.ready.then(repaint);
  if ('ResizeObserver' in window) new ResizeObserver(repaint).observe(document.body);
  if (still) { draw(0); addEventListener('scroll', () => draw(0), { passive: true }); } else requestAnimationFrame(frame);
})();
