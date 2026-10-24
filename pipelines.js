// Fondo: tramos de pipeline muy tenues, con codos rectos, y paquetes de datos que los recorren despacio.
(() => {
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
    const count = Math.max(4, Math.round(height / 150));
    pipes = Array.from({ length: count }, (_, i) => {
      let x = -20, y = (i + 0.5) * height / count + (rand() - 0.5) * 40;
      const points = [[x, y]];
      while (x < width + 20) {
        x += 140 + rand() * 260; points.push([x, y]);
        y = Math.max(20, Math.min(height - 20, y + (rand() - 0.5) * 160)); points.push([x, y]);
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

  function at(pipe, d) {
    d = ((d % pipe.total) + pipe.total) % pipe.total;
    const s = pipe.segments.find(seg => d <= seg.start + seg.length) || pipe.segments[pipe.segments.length - 1];
    const k = s.length ? (d - s.start) / s.length : 0;
    return [s.ax + (s.bx - s.ax) * k, s.ay + (s.by - s.ay) * k];
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(148,163,184,.07)';
    for (const pipe of pipes) {
      ctx.beginPath();
      pipe.points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,.12)';
      for (let k = 1; k < pipe.points.length - 1; k += 2) { const [x, y] = pipe.points[k]; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      const head = pipe.offset + t / 1000 * pipe.speed;
      for (let k = 0; k < 6; k++) {
        const [x, y] = at(pipe, head - k * 5);
        ctx.fillStyle = `rgba(94,234,212,${0.32 - k * 0.05})`;
        ctx.beginPath(); ctx.arc(x, y, 2 - k * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function frame(t) { draw(t); requestAnimationFrame(frame); }
  build();
  addEventListener('resize', build);
  if (still) draw(0); else requestAnimationFrame(frame);
})();
