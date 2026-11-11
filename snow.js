// Fondo: el cielo de una noche que nieva. Estrellas que titilan, constelaciones que son agentes (un centro con sus
// herramientas, y llamadas que van y vuelven) y cada tanto una estrella fugaz. Por delante, la nevada de datos:
// puntitos (registros) y copos de seis puntas (Snowflake) que caen y se mecen, algunos en el color de acento;
// cerca del cursor se apartan y brillan. Detrás del texto la nieve se aclara.
(() => {
  const small = matchMedia('(max-width: 760px)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // El vidrio líquido: un ruido suave y lento desplaza lo que se ve a través de las tarjetas. Solo Chromium sabe
  // usar un filtro SVG como fondo de un elemento; en el resto no se agrega nada y queda el vidrio limpio.
  // Apagado: recalcular la refracción de cada tarjeta en cada cuadro no deja llegar a 60 fps con el cielo en movimiento.
  if (false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="n"/>'
      + '<feGaussianBlur in="n" stdDeviation="3" result="s"/>'
      + '<feDisplacementMap in="SourceGraphic" in2="s" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.append(svg);
    document.documentElement.classList.add('lg-liquid');
  }
  // El menú se vuelve vidrio recién cuando la página pasa por debajo.
  const nav = document.querySelector('.nav');
  if (nav) { const glass = () => nav.classList.toggle('scrolled', scrollY > 8); addEventListener('scroll', glass, { passive: true }); glass(); }
  // Mientras la página se mueve, el vidrio pasa a su versión liviana (ver style.css).
  let still_ = 0;
  addEventListener('scroll', () => { document.documentElement.classList.add('is-scrolling'); clearTimeout(still_); still_ = setTimeout(() => document.documentElement.classList.remove('is-scrolling'), 180); }, { passive: true });
  // El vidrio responde al mouse: un reflejo que lo sigue y una inclinación chiquita hacia él.
  if (matchMedia('(hover: hover)').matches && !still) {
    // Los desplegables responden igual que las tarjetas; su reflejo va en el fondo, porque su ::before ya es el filo de luz.
    document.querySelectorAll('.card, .agent-note, .art-visual, .fold summary').forEach(el => {
      el.classList.add(el.matches('summary') ? 'glass-tilt' : 'glass-live');
      el.addEventListener('pointermove', event => {
        const r = el.getBoundingClientRect(), x = (event.clientX - r.left) / r.width, y = (event.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
        el.style.setProperty('--ry', `${(x - 0.5) * 3}deg`); el.style.setProperty('--rx', `${(0.5 - y) * 3}deg`);
        el.classList.add('glint');
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('glint'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'pipelines';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, flakes = [], agents = [], stars = [], twinkle = [], zones = [];
  const sky = document.createElement('canvas');
  // Cuánto acompaña el cielo al scroll: poco, porque está lejos.
  const SKY = 0.22;
  // Las referencias personales no se ven todas juntas: van una por una, alternando márgenes, en un cielo propio
  // más largo que la pantalla que pasa un poco más rápido que las estrellas. Aparece una cada pantalla y media, más o menos.
  const REFS = 0.4;
  let refs = [], refsH = 1;
  // Las constelaciones se reparten a lo largo de todo lo que se scrollea, para que pasen todas, de a una, hasta el
  // final de la página. Se vuelve a medir al terminar de cargar, cuando la página ya tiene su alto real.
  const spreadRefs = () => {
    if (!refs.length) return;
    const span = Math.max(height, (document.documentElement.scrollHeight - height) * REFS + height * .9), step = Math.max(height * .42, span / refs.length);
    refs.forEach((f, k) => { f.y = zones[k].y = (k + .5) * step; });
    refsH = Math.max(height, refs.length * step);
  };
  addEventListener('load', () => spreadRefs());

  // Semilla fija: la nevada arranca igual en cada visita.
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function build() {
    // El fondo es difuso: a resolución simple se ve igual y cuesta la cuarta parte.
    const dpr = 1;
    width = innerWidth; height = innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 11;
    const count = Math.round(width * height / (small ? 9000 : 15000));
    // Las estrellas lejanas: puntitos quietos que titilan y se mueven más lento que la página, para dar profundidad.
    stars = Array.from({ length: Math.round(width * height / (small ? 2600 : 3200)) }, () => ({
      x: rand() * width, y: rand() * height, r: 0.35 + rand() * 0.75, a: 0.12 + rand() * 0.4, tw: 0.4 + rand() * 1.6, ph: rand() * 6.3, blue: rand() < 0.3,
    }));
    // Las estrellas quietas se pintan una sola vez en una imagen que después solo se desplaza; titilan solo las más
    // brillantes, que son pocas.
    sky.width = width; sky.height = height;
    let sk = sky.getContext('2d');
    sk.clearRect(0, 0, width, height);
    for (const st of stars) { sk.globalAlpha = st.a * .8; sk.fillStyle = st.blue ? '#a5b4fc' : '#e2e8f0'; sk.fillRect(st.x, st.y, st.r * 2, st.r * 2); }
    twinkle = stars.filter(st => st.a > .44);
    // Referencias personales dibujadas como en una carta del cielo: trazo fino, estrellas brillantes en los
    // vértices. Se dibujan una sola vez en `sky`.
    const bright = (x, y, r, halo = '165,180,252') => {
      const g = sk.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, 'rgba(241,245,249,.95)'); g.addColorStop(.25, `rgba(${halo},.35)`); g.addColorStop(1, `rgba(${halo},0)`);
      sk.globalAlpha = 1; sk.fillStyle = g; sk.beginPath(); sk.arc(x, y, r * 4, 0, Math.PI * 2); sk.fill();
    };
    const ink = (a = .26, c = '165,180,252') => { sk.globalAlpha = 1; sk.strokeStyle = `rgba(${c},${a})`; sk.lineWidth = 1; sk.lineJoin = sk.lineCap = 'round'; };
    // Un dibujo: una lista de trazos (cada uno, puntos en unidades) más las estrellas que se marcan.
    const figure = (ox, oy, u, paths, marks) => {
      ink(); sk.beginPath();
      for (const path of paths) path.forEach(([x, y], k) => k ? sk.lineTo(ox + x * u, oy + y * u) : sk.moveTo(ox + x * u, oy + y * u));
      sk.stroke();
      marks.forEach(([x, y, r = 1.5]) => bright(ox + x * u, oy + y * u, r));
    };
    const ring = (cx, cy, r, n = 28) => Array.from({ length: n + 1 }, (_, k) => [cx + Math.cos(k / n * Math.PI * 2) * r, cy + Math.sin(k / n * Math.PI * 2) * r]);
    zones = []; refs = [];
    const at = (fx, fy, mx, my, r = small ? 40 : 56) => {
      const k = refs.length, R = small ? 70 : 90, c = document.createElement('canvas'); c.width = c.height = R * 2;
      // En pantallas anchas, en los márgenes; en el celu, cerca de los bordes.
      const x = k % 2 ? width * (small ? .84 : .93) : width * (small ? .16 : .07), y = 0;
      refs.push({ c, x, y, R }); zones.push({ x, y, r }); sk = c.getContext('2d');
      return [R, R];
    };

    // La Cruz del Sur: sus cinco estrellas en la forma real.
    {
      const [cx, cy] = at(.1, .24, .82, .22), u = small ? 30 : 44;
      const st = [[.05, -1, 2.6], [0, 1, 3], [-.6, .12, 2.4], [.52, -.22, 2], [.28, .38, 1.3]];
      ink(.18); sk.beginPath();
      for (const [a, b] of [[0, 1], [2, 3]]) { sk.moveTo(cx + st[a][0] * u, cy + st[a][1] * u); sk.lineTo(cx + st[b][0] * u, cy + st[b][1] * u); }
      sk.stroke(); st.forEach(([x, y, r]) => bright(cx + x * u, cy + y * u, r));
    }
    // Las Tres Marías: el cinturón de Orión, como se lo nombra en Argentina.
    {
      const [mx, my] = at(.86, .7, .2, .74), step = small ? 18 : 24;
      [0, 1, 2].forEach(k => bright(mx + (k - 1) * step, my - (k - 1) * step * .42, 2.2 - k * .15));
    }
    // La bandera argentina como constelación: el contorno y las dos franjas en trazo fino, estrellas celestes
    // en las esquinas y el sol, una estrella dorada, en el medio.
    {
      const [fx, fy] = at(.9, .3, .84, .44), u = small ? 14 : 18;
      figure(fx, fy, u, [[[-1, -.62], [1, -.62], [1, .62], [-1, .62], [-1, -.62]], [[-1, -.2], [1, -.2]], [[-1, .2], [1, .2]]], []);
      [[-1, -.62], [1, -.62], [1, .62], [-1, .62]].forEach(([x, y]) => bright(fx + x * u, fy + y * u, 1.1, '116,172,223'));
      bright(fx, fy, 1.3, '246,180,14');
    }
    // Un mate con la bombilla.
    figure(...at(.07, .78, .14, .9), small ? 18 : 24,
      [[[-.62, -.2], [-.72, .25], [-.55, .7], [-.2, .95], [.2, .95], [.55, .7], [.72, .25], [.62, -.2]],
       [[-.68, -.2], [.68, -.2]], [[.1, -.15], [.62, -1.05], [.8, -1.12]]],
      [[-.62, -.2], [.62, -.2], [0, .95, 1.3], [.8, -1.12, 1.8]]);
    // Un caza TIE: dos alas hexagonales, el brazo y la cabina redonda.
    {
      const [tx, ty] = at(.74, .13, .6, .1), u = small ? 14 : 18;
      const wing = sx => [[sx, -1], [sx + .18 * Math.sign(sx), -.5], [sx + .18 * Math.sign(sx), .5], [sx, 1], [sx - .18 * Math.sign(sx), .5], [sx - .18 * Math.sign(sx), -.5], [sx, -1]];
      figure(tx, ty, u, [wing(-1.2), wing(1.2), [[-1.2, 0], [-.42, 0]], [[.42, 0], [1.2, 0]], ring(0, 0, .42)],
        [[0, 0, 1.6], [-1.2, -1], [-1.2, 1], [1.2, -1], [1.2, 1]]);
    }
    // Un café: la taza con su asa y dos hilos de vapor.
    figure(...at(.05, .5, .1, .42), small ? 15 : 20,
      [[[-.7, -.4], [-.55, .7], [.55, .7], [.7, -.4], [-.7, -.4]], Array.from({ length: 11 }, (_, k) => { const a = -Math.PI / 2 + k / 10 * Math.PI; return [.62 + Math.cos(a) * .32, .12 + Math.sin(a) * .3]; }),
       [[-.2, -.6], [-.05, -.85], [-.2, -1.1]], [[.2, -.6], [.35, -.85], [.2, -1.1]]],
      [[-.7, -.4], [.7, -.4], [-.2, -1.1, 1.2], [.2, -1.1, 1.2]]);
    // Una medialuna: la curva de afuera, la de adentro y sus pliegues.
    figure(...at(.93, .88, .55, .84), small ? 15 : 20,
      [[[-1, .3], [-.72, -.22], [-.28, -.5], [.28, -.5], [.72, -.22], [1, .3]], [[1, .3], [.5, .06], [0, -.04], [-.5, .06], [-1, .3]],
       [[-.5, -.37], [-.32, .02]], [[0, -.5], [0, -.04]], [[.5, -.37], [.32, .02]]],
      [[-1, .3], [1, .3], [0, -.5, 1.3]]);
    // Un libro abierto: dos páginas que se curvan hacia el lomo.
    figure(...at(.2, .9, .86, .9), small ? 14 : 19,
      [[[0, -.5], [-.5, -.66], [-1, -.5], [-1, .6], [-.5, .45], [0, .6], [.5, .45], [1, .6], [1, -.5], [.5, -.66], [0, -.5], [0, .6]],
       [[-.8, -.2], [-.2, -.15]], [[.2, -.15], [.8, -.2]], [[-.8, .1], [-.2, .15]], [[.2, .15], [.8, .1]]],
      [[-1, -.5], [1, -.5], [-1, .6], [1, .6]]);
    // Una guitarra, un poco inclinada: el cuerpo de dos curvas, la boca, el mástil y la cabeza.
    {
      const tilt = .45, c = Math.cos(tilt), sn = Math.sin(tilt), rot = pts => pts.map(([x, y, r]) => [x * c - y * sn, x * sn + y * c, ...(r ? [r] : [])]);
      const half = y => Math.max(Math.sqrt(Math.max(0, .25 - (y - .55) ** 2)), Math.sqrt(Math.max(0, .1296 - (y + .2) ** 2)), y > -.45 && y < .95 ? .27 : 0);
      const ys = Array.from({ length: 31 }, (_, k) => -.56 + k / 30 * 1.61), body = [...ys.map(y => [half(y), y]), ...ys.reverse().map(y => [-half(y), y])];
      body.push(body[0]);
      figure(...at(.95, .5, .9, .6), small ? 20 : 26,
        // La silueta es una sola línea: dos curvas unidas por la cintura, como el cuerpo de una guitarra criolla.
        [rot(body), rot(ring(0, .1, .12, 16)), rot([[-.18, .72], [.18, .72]]),
         rot([[-.07, -.56], [-.07, -1.5]]), rot([[.07, -.56], [.07, -1.5]]), rot([[-.07, -.8], [.07, -.8]]), rot([[-.07, -1.1], [.07, -1.1]]),
         rot([[-.07, -1.5], [-.14, -1.82], [.14, -1.82], [.07, -1.5]]), rot([[0, .72], [0, -1.5]])],
        rot([[0, 1.05, 1.3], [0, -1.82, 1.3], [-.55, .5, 1], [.55, .5, 1]]));
    }
    spreadRefs();
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

  // Las constelaciones viven en el cielo: se mueven más lento que la página, como algo muy lejano. Más o menos
  // una cada pantalla y media, alternando márgenes. Cada una: un centro y 4 o 5 herramientas alrededor.
  function buildAgents() {
    // Con la pestaña en segundo plano la ventana puede medir 0 de alto: se toma una pantalla común.
    const docH = document.documentElement.scrollHeight, n = Math.max(2, Math.round(docH / ((innerHeight || 800) * 1.5)));
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    agents = Array.from({ length: n }, (_, k) => {
      const side = k % 2 ? 1 : 0, margin = Math.max(90, (width - 1200) / 2);
      const x = side ? width - margin * (0.35 + r() * 0.4) : margin * (0.35 + r() * 0.4);
      const sky = (innerHeight || 800) * 0.7 + (docH - (innerHeight || 800)) * SKY, y = (k + 0.5 + (r() - 0.5) * 0.5) * sky / n;
      const count = 4 + Math.round(r());
      const tools = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + r() * 0.8, d = 34 + r() * 30;
        return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
      });
      return { x, y, tools, call: null, next: 2000 + r() * 6000 };
    });
  }
  // Las referencias del cielo se mueven con el fondo y los agentes con otra velocidad: cuando un agente pasa
  // cerca de una, se desvanece, así nunca quedan pegados.
  function apart(x, y) {
    const off = scrollY * REFS;
    let k = 1;
    for (const z of zones) {
      const zy = ((z.y - off) % refsH + refsH) % refsH, d = Math.hypot(x - z.x, y - zy) - z.r - 40;
      k = Math.min(k, Math.max(0, Math.min(1, d / 50)));
    }
    return k * k * (3 - 2 * k);
  }
  function drawAgents(t) {
    ctx.lineWidth = 1;
    for (const g of agents) {
      const off = scrollY * SKY, gy = g.y - off;
      if (gy < -120 || gy > height + 120) continue;
      const fade = apart(g.x, gy);
      if (!fade) continue;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgba(94,234,212,.14)'; ctx.beginPath();
      for (const p of g.tools) { ctx.moveTo(g.x, gy); ctx.lineTo(p.x, p.y - off); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(203,213,225,.35)';
      for (const p of g.tools) { ctx.beginPath(); ctx.arc(p.x, p.y - off, 1.6, 0, Math.PI * 2); ctx.fill(); }
      const glow = 0.45 + Math.sin(t / 900 + g.x) * 0.15;
      ctx.fillStyle = `rgba(94,234,212,${glow})`; ctx.beginPath(); ctx.arc(g.x, gy, 3, 0, Math.PI * 2); ctx.fill();
      // Una llamada: un pulso que sale del centro hacia una herramienta y vuelve.
      if (!g.call && t > g.next) g.call = { to: g.tools[Math.floor(Math.random() * g.tools.length)], t0: t };
      if (g.call) {
        const u = (t - g.call.t0) / 1400;
        if (u >= 1) { g.call = null; g.next = t + 3000 + Math.random() * 7000; ctx.globalAlpha = 1; continue; }
        const k = u < 0.5 ? u * 2 : 2 - u * 2, p = g.call.to;
        ctx.fillStyle = 'rgba(94,234,212,.9)'; ctx.beginPath(); ctx.arc(g.x + (p.x - g.x) * k, gy + (p.y - g.y) * k, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // La máscara: la página entera a un cuarto de tamaño, con un rectángulo difuso por cada bloque de texto.
  const SCALE = 0.25, PAD = 10, SOFT = 44;
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const BLOCKS = 'main h1, main h2, main h3, main p, main ul, main ol, main img, main .cta, main .email, main .tabs, main .principles, main .card, main .stat, main .flow, main .facts, main .art-visual, main header, footer';
  function paintMask() {
    const docH = document.documentElement.scrollHeight;
    mask.width = Math.ceil(innerWidth * SCALE); mask.height = Math.ceil(docH * SCALE);
    mctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    // Detrás del texto la nieve se aclara pero no desaparece: el espacio sigue siendo uno solo.
    mctx.fillStyle = mctx.shadowColor = 'rgba(0,0,0,.55)';
    mctx.shadowBlur = SOFT * SCALE;
    for (const el of document.querySelectorAll(BLOCKS)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      mctx.fillRect(r.left - PAD, r.top + scrollY - PAD, r.width + PAD * 2, r.height + PAD * 2);
    }
  }
  let pending = 0;
  const repaint = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { paintMask(); buildAgents(); if (still) draw(0, 0); }); };

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

  // La estrella fugaz: cada 8 a 18 segundos cruza en diagonal, de arriba a la derecha hacia abajo a la izquierda, con su estela.
  let comet = null, nextComet = 6000;
  function drawComet(t, dt) {
    if (!comet && t > nextComet) {
      const speed = 620 + Math.random() * 260, angle = Math.PI * (0.78 + Math.random() * 0.08);
      comet = { x: width * (0.45 + Math.random() * 0.55), y: -20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, flag: Math.random() < 1 / 3 };
    }
    if (!comet) return;
    comet.x += comet.vx * dt; comet.y += comet.vy * dt;
    const len = 160, sp = Math.hypot(comet.vx, comet.vy), tx = comet.x - comet.vx / sp * len, ty = comet.y - comet.vy / sp * len;
    const tail = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
    tail.addColorStop(0, 'rgba(94,234,212,.85)'); tail.addColorStop(1, 'rgba(94,234,212,0)');
    // Una de cada tres estrellas fugaces es la bandera: tres franjas paralelas, celeste, blanca y celeste.
    if (comet.flag) {
      const nx = -comet.vy / sp, ny = comet.vx / sp;
      [[-2.4, '116,172,223'], [0, '255,255,255'], [2.4, '116,172,223']].forEach(([o, c]) => {
        const g = ctx.createLinearGradient(comet.x, comet.y, tx, ty); g.addColorStop(0, `rgba(${c},.9)`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(comet.x + nx * o, comet.y + ny * o); ctx.lineTo(tx + nx * o, ty + ny * o); ctx.stroke();
      });
    } else {
      ctx.strokeStyle = tail; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(tx, ty); ctx.stroke();
    }
    ctx.fillStyle = '#e6fffb'; ctx.shadowColor = 'rgba(94,234,212,.9)'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(comet.x, comet.y, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    if (comet.x < -len || comet.y > height + len) { comet = null; nextComet = t + 8000 + Math.random() * 10000; }
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
    // Solo la nieve se aclara detrás del texto. El cielo se pinta después, por detrás de todo y entero: si la
    // máscara lo tocara, quedarían rectángulos oscuros recortados sobre las estrellas.
    if (mask.width && mask.height) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, scrollY * SCALE, width * SCALE, height * SCALE, 0, 0, width, height);
    }
    ctx.globalCompositeOperation = 'destination-over';
    if (dt) drawComet(t, dt);
    drawAgents(t);
    const off = ((scrollY * 0.12) % height + height) % height;
    for (const s of twinkle) {
      const y = ((s.y - off) % height + height) % height;
      ctx.globalAlpha = s.a * (0.35 * Math.sin(t / 1000 * s.tw + s.ph)) + .15;
      ctx.fillStyle = s.blue ? '#a5b4fc' : '#e2e8f0'; ctx.fillRect(s.x - .5, y - .5, s.r * 2 + 1, s.r * 2 + 1);
    }
    ctx.globalAlpha = 1;
    for (const f of refs) {
      const y = ((f.y - scrollY * REFS) % refsH + refsH) % refsH;
      for (const yy of [y, y - refsH]) if (yy > -f.R && yy < height + f.R) ctx.drawImage(f.c, f.x - f.R, yy - f.R);
    }
    ctx.drawImage(sky, 0, off, width, height - off, 0, 0, width, height - off);
    if (off) ctx.drawImage(sky, 0, 0, width, off, 0, height - off, width, off);
    ctx.globalCompositeOperation = 'source-over';
  }

  let last = 0;
  function frame(t) { const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; draw(t, dt); requestAnimationFrame(frame); }
  build(); paintMask(); buildAgents();
  addEventListener('resize', () => { build(); repaint(); });
  addEventListener('load', repaint);
  if (document.fonts) document.fonts.ready.then(repaint);
  if ('ResizeObserver' in window) new ResizeObserver(repaint).observe(document.body);
  if (still) { draw(0, 0); addEventListener('scroll', () => draw(0, 0), { passive: true }); } else requestAnimationFrame(frame);
})();

// La estela del cursor: al mover el mouse quedan estrellitas de los colores de la cara que se apagan solas. El
// puntero es el del navegador, así que la estela nunca lo demora. Solo con mouse y si no se pidió menos movimiento.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const TINTS = ['#5eead4', '#5eead4', '#e2e8f0', '#a5b4fc'];
  let lx = 0, ly = 0, at = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - at < 45 || Math.hypot(e.clientX - lx, e.clientY - ly) < 14) return;
    at = now; lx = e.clientX; ly = e.clientY;
    const s = document.createElement('i'); s.className = 'spark';
    s.style.left = `${e.clientX + (Math.random() - .5) * 8}px`; s.style.top = `${e.clientY + (Math.random() - .5) * 8}px`;
    s.style.setProperty('--c', TINTS[Math.floor(Math.random() * TINTS.length)]); s.style.setProperty('--dx', `${(Math.random() - .5) * 14}px`);
    s.addEventListener('animationend', () => s.remove()); document.body.append(s);
  }, { passive: true });
})();
