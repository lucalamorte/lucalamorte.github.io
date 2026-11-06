// El cursor propio: un círculo que sigue al puntero con un poco de inercia y crece sobre links y botones.
// Solo con mouse; en pantallas táctiles no existe.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = document.createElement('div'); dot.className = 'cursor gone'; dot.setAttribute('aria-hidden', 'true');
  document.body.append(dot); document.documentElement.classList.add('soft-cursor');
  let x = -100, y = -100, cx = -100, cy = -100, moving = false;
  const tick = () => {
    cx += (x - cx) * .32; cy += (y - cy) * .32;
    dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    if (Math.abs(x - cx) + Math.abs(y - cy) > .2) requestAnimationFrame(tick); else moving = false;
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY; dot.classList.remove('gone');
    dot.classList.toggle('on-link', !!e.target.closest('a, button, summary, [role="tab"], .pk-hit, label'));
    if (!moving) { moving = true; requestAnimationFrame(tick); }
  }, { passive: true });
  addEventListener('pointerdown', () => dot.classList.add('down'));
  addEventListener('pointerup', () => dot.classList.remove('down'));
  document.documentElement.addEventListener('mouseleave', () => dot.classList.add('gone'));
})();
