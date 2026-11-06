// La flecha de los artículos: el centro de la barra de abajo baja de zona en zona (el dibujo, los números y
// cada título; las que quedan muy pegadas a la actual se saltean) y, cuando ya no queda nada abajo, pasa a ser "Back to top". Una sola fuente para todos.
(() => {
  const link = document.querySelector('.article-end a[href="#top"]');
  if (!link) return;
  const stops = [...document.querySelectorAll('.article > .art-visual, .article > .facts, .article > h2')];
  const root = document.documentElement;
  const pad = () => (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 12;
  const at = el => el.getBoundingClientRect().top + scrollY - pad();
  const end = () => root.scrollHeight - innerHeight - 4;
  const upcoming = () => (scrollY >= end() ? null : stops.find(el => at(el) > scrollY + Math.max(40, innerHeight * .2)) || null);
  const top = link.innerHTML, down = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>';
  let mode = '';
  const sync = () => {
    const next = upcoming() ? 'down' : 'top';
    if (next === mode) return;
    mode = next;
    link.classList.toggle('down', next === 'down');
    link.innerHTML = next === 'down' ? down : top;
    link.setAttribute('aria-label', next === 'down' ? 'Next section' : 'Back to top');
  };
  link.addEventListener('click', event => {
    const el = upcoming();
    if (!el) return;
    event.preventDefault();
    scrollTo({ top: Math.min(at(el), end() + 4) });
  });
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
})();

// Volver al inicio desde un artículo: si se llegó desde el inicio, se vuelve atrás en el historial, así la página
// (y el juego, si estaba jugando) queda exactamente donde estaba.
(() => {
  let fromHome = false;
  try { const r = new URL(document.referrer); fromHome = r.origin === location.origin && /(\/|index\.html)$/.test(r.pathname); } catch {}
  if (!fromHome || history.length < 2) return;
  document.querySelectorAll('a[href^="../index.html"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.back(); }));
})();
