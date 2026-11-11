// El cursor propio: un círculo de vidrio pegado al puntero, sin inercia (con inercia se sentía impreciso), que crece
// sobre links y botones.
// Solo con mouse; en pantallas táctiles no existe.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = document.createElement('div'); dot.className = 'cursor gone'; dot.setAttribute('aria-hidden', 'true');
  document.body.append(dot); document.documentElement.classList.add('soft-cursor');
  let x = -100, y = -100;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY; dot.classList.remove('gone');
    // Un visor abierto (dialog modal) queda por encima de toda la página: el cursor se muda adentro para seguir a la vista.
    const host = document.querySelector('dialog[open]') || document.body;
    if (dot.parentElement !== host) host.append(dot);
    dot.classList.toggle('on-link', !!e.target.closest('a, button, summary, [role="tab"], .pk-hit, label'));
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, { passive: true });
  addEventListener('pointerdown', () => dot.classList.add('down'));
  addEventListener('pointerup', () => dot.classList.remove('down'));
  document.documentElement.addEventListener('mouseleave', () => dot.classList.add('gone'));
})();
