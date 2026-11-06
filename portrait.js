/* Retrato de rayas: la foto convertida en filas de rayitas que se comportan como una tela.
   - Cada raya está atada a su lugar con un resorte y unida a sus vecinas de la fila: un empujón
     se propaga como una onda y vuelve rebotando.
   - El cursor arrastra las rayas en la dirección y con la velocidad con que se mueve: rápido deja estela.
   - Los rasgos (ojos, boca, contorno) son puntos que se encienden.
   - Al cargar, el retrato se arma: datos sueltos que caen a su fila, de arriba abajo, y recién ahí son rayas.
   - Game mode: cada fila es un registro; se desordenan y se cargan pasando el cursor. */
(() => {
  const DATA = {"cols":58,"grid":["..........................................................","..........................675687..........................","......................8854222334467.......................",".....................74322112213333489....................","....................722221111212343237....................","...................622210101113323322256..................","..................62212110122233321332127.................",".................7211111112223245323331147................",".................4221111101134344433211115................",".................2122221112245555555322114................",".................1122232233456667777643213................",".................1122344455566677888754322................",".................1233455566666678898766532................",".................2345554556666677888888643................",".................3345544455555567788898754................",".................4445544445555567778999864................",".................4444544455655677778999876................",".................5445544455666678777889976................",".................544321124566666434568898.................",".................554345532356777655799988.................","................6754332211235896213669998..5..............","...............33454312011124895323658988777..............","...............33344232211233796335877888887..............","...............33444332222333798545667998786..............","................3344443233333799755678998565..............","................244444333333367987667999864...............","................334444333233468877778999846...............",".................3444443323247887678899988................",".................4444443322147557578999988................",".................444444442224787657899998.................","..................44444433225477667999998.................","...................444433333547876799999..................","...................444434432455576799999..................","...................444443223224544789999..................","....................44442323345687799999..................","....................444433345567778999873.................","....................5444334455677889988761................","....................13443344556789998887413...............","...................102344344566899987756212...............","..................10023343456678898884342123..............","..................100324433566677888634411122.............","................1111032444445567899853531112212...........","..............11001105244444567889863562112221113.........","............111000011734555566888853367211222112123.......","..........1110000001175455556677654357921222111211123.....","........11110000001128735555566544437992122211211111233...","......111100000000112883455555544434799212212211111111234.","....111100000000000025853445444444477991122221121111111224","...1110000000000000012688644555446965691232211211111111122","..11100000000000000013355654455589855571232101211111111122",".211000000000000000013334564444999665551331012211111111112","2100000000000000000012434565444898665531320022111111111111","1000000000000000000001344566444796665512300122111111111112","0000000000000000000001245466644787656222201221111111111112","0000000000000000000000145557754877665122102211111111111111","0000000000000000000000135557766877762221012211111111111111","0000000000000000000000125566778777741220122111111111111011","0000000000000000000000013566798877622200221111111111111011"],"edges":["0000000000000000000000000000000000000000000000000000000000","0000000000000000000000000013223200000000000000000000000000","0000000000000000000000145643333433100000000000000000000000","0000000000000000000001752123233423534000000000000000000000","0000000000000000000055222122343423336400000000000000000000","0000000000000000000352121112244344332341000000000000000000","0000000000000000003422221233455343554425200000000000000000","0000000000000000003111222323344424344421610000000000000000","0000000000000000032211222223447333323422440000000000000000","0000000000000000032211222233343433443221120000000000000000","0000000000000000022111223424322122233432110000000000000000","0000000000000000011231222232311111122343210000000000000000","0000000000000000012321111111111111122223300000000000000000","0000000000000000022221111111111111112333310000000000000000","0000000000000000011200001111111111111123310000000000000000","0000000000000000011100000111111111011112310000000000000000","0000000000000000001000101111111111111102300000000000000000","0000000000000000001012222111011246664211200000000000000000","0000000000000000001156665321111377556511200000000000000000","0000000000000000001334665243233476443110300000000000000000","0000000000000000211214544222442853887310300000000000000000","0000000000000001361123522121552833998411344400000000000000","0000000000000000231122221121452633584210222200000000000000","0000000000000000331111111210451351232210163300000000000000","0000000000000000141101111100452233222110177200000000000000","0000000000000000141001111111341331212211184000000000000000","0000000000000000041000001211343231112101292000000000000000","0000000000000000031000011212356553111101140000000000000000","0000000000000000011000012233549852221001110000000000000000","0000000000000000001100011211542321310001000000000000000000","0000000000000000000000111113562112210000000000000000000000","0000000000000000000100101114664331210000000000000000000000","0000000000000000000000113342433562210010000000000000000000","0000000000000000000000125323445466410100000000000000000000","0000000000000000000000012223234533310112000000000000000000","0000000000000000000000111122223211111158900000000000000000","0000000000000000000021000122111121101378910000000000000000","0000000000000000000015000111211221113367920000000000000000","0000000000000000000115111012111211122476421000000000000000","0000000000000000000124201012112211324663323000000000000000","0000000000000000001125211112112222225344224100000000000000","0000000000000000011135211112112321135534134111100000000000","0000000000000001002255421111111111354544123111111000000000","0000000000000010001266821101121114536275121111211210000000","0000000000010100001366941001111244115486131122211121100000","0000000001100001001367932101122320142586131222221011121000","0000000111000001101366732100111100163386232232311101012200","0000011100000001100169595210001001496495222233221011111122","0000111000000001100131738931000028851994312232210000011112","0000000000000001110032375551000573511393312312111011011111","0010000000000001110013112251002812511193214122111101101110","3100000000000000100014113124011816101173141221111110111100","1100000000000000100113311313200834110542141311110010010010","0000000000000000000001411221411852211731413121110001000111","0000000000000000000001422240142931217312422111100001101111","0000000000000000000001261132148231137214131110101001011011","0000000000000000000110152123144120183132321111011100001011","0100000000000000000000125112441221551322211111111111111111"]};
  const canvas = document.getElementById('portrait');
  if (!canvas) return;
  // Se dibuja en una capa más grande que el retrato: si el cursor empuja las rayas hacia afuera, salen del cuadro
  // sin cortarse en línea recta. El canvas original queda igual (mide, recibe el mouse y lo usa el juego).
  const ink = document.createElement('canvas');
  ink.className = 'portrait-ink'; ink.setAttribute('aria-hidden', 'true');
  canvas.after(ink);
  const ctx = ink.getContext('2d');
  let margin = 0;
  const toggle = document.getElementById('game');
  const status = document.getElementById('game-status');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5eead4';

  // Física: cuánto tira el resorte, cuánto frena, cuánto se contagian las vecinas, cuánto arrastra el cursor.
  const SPRING = .035, DAMPING = .9, COUPLING = .24, DRAG = 1.1, REACH = .24;
  // El armado: cuánto tarda cada dato en llegar y cuánto se reparte la largada entre la primera fila y la última.
  const LAND = .9, SWEEP = .8;

  const points = [];
  const at = new Map();
  DATA.grid.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === '.') return;
    const p = { r, c, tone: +ch / 9, edge: +DATA.edges[r][c] / 9, ox: 0, oy: 0, vx: 0, vy: 0, sx: Math.random() - .5, sy: Math.random() - .5, delay: r / DATA.grid.length * SWEEP + Math.random() * .25 };
    at.set(r * 1000 + c, p);
    points.push(p);
  }));
  points.forEach(p => { p.left = at.get(p.r * 1000 + p.c - 1); p.right = at.get(p.r * 1000 + p.c + 1); });
  const rows = [...new Set(points.map(p => p.r))].map(r => ({ r, x: 0, y: 0, vx: 0, vy: 0, loaded: true }));
  const rowOf = new Map(rows.map(row => [row.r, row]));

  let size = 0, step = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    margin = size * .3;
    canvas.width = canvas.height = 1;
    ink.width = ink.height = Math.round((size + margin * 2) * dpr);
    Object.assign(ink.style, { left: `${canvas.offsetLeft - margin}px`, top: `${canvas.offsetTop - margin}px`, width: `${size + margin * 2}px`, height: `${size + margin * 2}px` });
    step = size / DATA.cols;
  }

  // El cursor: dónde está y a qué velocidad se mueve.
  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false, seen: 0 };
  function track(event) {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    if (pointer.active) { pointer.vx = x - pointer.x; pointer.vy = y - pointer.y; }
    pointer.x = x; pointer.y = y; pointer.active = true; pointer.seen = performance.now();
  }
  // El mouse se sigue en toda la ventana: la cara reacciona también cuando pasa cerca por afuera de su cuadro.
  addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const box = canvas.getBoundingClientRect(), pad = box.width * .3;
    const near = event.clientX > box.left - pad && event.clientX < box.right + pad && event.clientY > box.top - pad && event.clientY < box.bottom + pad;
    if (near) { track(event); wake(); } else if (pointer.active) { pointer.active = false; pointer.vx = pointer.vy = 0; }
  }, { passive: true });
  canvas.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse') track(event); });
  canvas.addEventListener('pointerdown', track);
  // Con el dedo el gesto termina enseguida: las rayas siguen reaccionando un instante, para que el toque se vea.
  const release = event => {
    const off = () => { pointer.active = false; pointer.vx = pointer.vy = 0; };
    if (event.pointerType === 'mouse') return; setTimeout(() => { if (performance.now() - pointer.seen > 350) off(); }, 400);
  };
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('pointercancel', release);
  // En el celu el dedo barre de costado sin que la página se mueva; hacia arriba o abajo sigue siendo scroll.
  canvas.style.touchAction = 'pan-y';

  // ---------- game mode ----------
  let playing = false, started = 0, loadedCount = rows.length;
  function say(text) { if (status) status.textContent = text; }
  function startGame() {
    playing = true; started = performance.now(); loadedCount = 0;
    rows.forEach(row => {
      row.loaded = false;
      row.x = (Math.random() - .5) * size * .9; row.y = (Math.random() - .5) * size * .9;
      const speed = size * (.0016 + Math.random() * .0024), angle = Math.random() * Math.PI * 2;
      row.vx = Math.cos(angle) * speed; row.vy = Math.sin(angle) * speed;
    });
    canvas.style.touchAction = 'none';
    say(`0 / ${rows.length} rows loaded. Sweep the cursor over the records to load them.`);
  }
  function stopGame(done) {
    playing = false; canvas.style.touchAction = 'pan-y';
    rows.forEach(row => { row.loaded = true; });
    say(done ? `Pipeline complete: ${rows.length} rows loaded in ${((performance.now() - started) / 1000).toFixed(1)} s.` : '');
    if (toggle) { toggle.setAttribute('aria-pressed', 'false'); toggle.classList.remove('on'); }
  }
  if (toggle) toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    toggle.classList.toggle('on', on);
    on ? startGame() : stopGame(false);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && playing) stopGame(false); });
  function moveRows() {
    const half = size / 2;
    rows.forEach(row => {
      if (row.loaded) { row.x *= .86; row.y *= .86; return; }
      row.x += row.vx; row.y += row.vy;
      if (Math.abs(row.x) > half * .9) { row.vx *= -1; row.x = Math.sign(row.x) * half * .9; }
      if (Math.abs(row.y) > half * .9) { row.vy *= -1; row.y = Math.sign(row.y) * half * .9; }
    });
  }

  // ---------- física ----------
  function simulate() {
    const radius = size * REACH;
    // Si el cursor se quedó quieto, ya no arrastra.
    if (performance.now() - pointer.seen > 60) { pointer.vx *= .7; pointer.vy *= .7; }
    for (const p of points) {
      const row = rowOf.get(p.r);
      const hx = (p.c + .5) * step + row.x, hy = (p.r + .5) * step + row.y;
      // Resorte hacia su lugar y contagio de las vecinas de la fila: así la fila ondula como una tela.
      let ax = -p.ox * SPRING, ay = -p.oy * SPRING;
      const l = p.left || p, r = p.right || p;
      ax += (l.ox + r.ox - 2 * p.ox) * COUPLING;
      ay += (l.oy + r.oy - 2 * p.oy) * COUPLING;
      if (pointer.active) {
        const dx = hx + p.ox - pointer.x, dy = hy + p.oy - pointer.y, d = Math.hypot(dx, dy);
        if (d < radius) {
          const fall = 1 - d / radius;
          // Arrastre en la dirección del movimiento, más un leve empujón hacia afuera.
          ax += pointer.vx * fall * fall * DRAG + (dx / (d || 1)) * fall * step * .08;
          ay += pointer.vy * fall * fall * DRAG + (dy / (d || 1)) * fall * step * .08;
          if (playing && !row.loaded && d < radius * .4) {
            row.loaded = true; loadedCount++;
            say(`${loadedCount} / ${rows.length} rows loaded.`);
            if (loadedCount === rows.length) stopGame(true);
          }
        }
      }
      p.vx = (p.vx + ax) * DAMPING; p.vy = (p.vy + ay) * DAMPING;
    }
    const limit = step * 9;
    for (const p of points) {
      p.ox = Math.max(-limit, Math.min(limit, p.ox + p.vx));
      p.oy = Math.max(-limit, Math.min(limit, p.oy + p.vy));
    }
  }

  // ---------- dibujo ----------
  let born = null, age = still ? Infinity : 0, formed = false;
  // 0 mientras el dato anda suelto, 1 cuando llegó a su lugar.
  const landed = p => { const k = Math.max(0, Math.min(1, (age - p.delay) / LAND)); return 1 - (1 - k) ** 3; };
  function position(p, t) {
    const row = rowOf.get(p.r), loose = (1 - landed(p)) * size;
    const x = (p.c + .5) * step + row.x + p.ox + p.sx * loose;
    let y = (p.r + .5) * step + row.y + p.oy + p.sy * loose;
    if (!still) y += Math.sin(p.c * .25 + t * 1.3 + p.r * .08) * step * .14;
    return [x, y];
  }
  function frame(time) {
    const t = time / 1000;
    if (born === null) born = time;
    if (!still) age = (time - born) / 1000;
    // Con la figura armada puede escribirse el título. Si la pestaña estaba oculta, el armado espera a que se vea.
    if (!formed && age >= SWEEP + .25 + LAND) { formed = true; dispatchEvent(new Event('portrait-formed')); }
    if (playing) moveRows(); else rows.forEach(row => { row.x *= .86; row.y *= .86; });
    simulate();
    ctx.setTransform(dpr, 0, 0, dpr, margin * dpr, margin * dpr);
    ctx.clearRect(-margin, -margin, size + margin * 2, size + margin * 2);
    ctx.lineCap = 'round';
    let moving = playing;
    for (const p of points) {
      const [x, y] = position(p, t);
      const arrived = landed(p);
      if (arrived < 1) {
        ctx.globalAlpha = .2 + arrived * .5; ctx.fillStyle = accent;
        ctx.fillRect(x - step * .1, y - step * .1, step * .2, step * .2);
        continue;
      }
      const row = rowOf.get(p.r);
      const pending = playing && !row.loaded;
      const stretch = Math.min(1, Math.hypot(p.ox, p.oy) / (step * 2.5));
      if (stretch > .02) moving = true;
      const lit = Math.min(1, p.edge * .8 + stretch);
      ctx.globalAlpha = pending ? .5 : Math.min(1, .2 + p.tone * .5 + lit * .45);
      ctx.fillStyle = ctx.strokeStyle = pending ? '#94a3b8' : accent;
      if (!pending && p.edge > .62) {
        // Rasgo: una crucecita, como en la referencia.
        const s = step * (.16 + lit * .14);
        ctx.fillRect(x - s, y - s * .35, s * 2, s * .7);
        ctx.fillRect(x - s * .35, y - s, s * .7, s * 2);
        continue;
      }
      // La raya apunta hacia la vecina de la derecha: si la fila ondula, la raya la sigue.
      const next = p.right ? position(p.right, t) : [x + step, y];
      const fx = x + (next[0] - x) * .5, fy = y + (next[1] - y) * .5;
      ctx.lineWidth = step * (.13 + p.tone * .07);
      ctx.beginPath(); ctx.moveTo(x - (fx - x) * .1, y - (fy - y) * .1); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!still || moving || pointer.active) requestAnimationFrame(frame);
    else running = false;
  }

  let running = false;
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  canvas.addEventListener('pointermove', wake);
  canvas.addEventListener('pointerdown', wake);
  if (toggle) toggle.addEventListener('click', wake);
  // El muñequito del juego atraviesa el retrato: empuja las rayas igual que el cursor.
  window.__portraitPoke = (clientX, clientY, vx, vy) => {
    if (clientX === null) { pointer.active = false; pointer.vx = pointer.vy = 0; return; }
    const box = canvas.getBoundingClientRect();
    pointer.x = clientX - box.left; pointer.y = clientY - box.top;
    pointer.vx = vx; pointer.vy = vy; pointer.active = true; pointer.seen = performance.now();
    wake();
  };
  window.addEventListener('resize', () => { resize(); wake(); });
  resize();
  wake();
})();
