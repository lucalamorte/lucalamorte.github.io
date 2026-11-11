// La flecha de los artículos: el centro de la barra de abajo baja de zona en zona (el stack con los números y
// cada título; las que quedan muy pegadas a la actual se saltean) y, cuando ya no queda nada abajo, pasa a ser "Back to top". Una sola fuente para todos.
(() => {
  const link = document.querySelector('.article-end a[href="#top"]');
  if (!link) return;
  const root = document.documentElement, article = document.querySelector('.article'), bar = document.querySelector('.article-end');
  const pad = () => (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 12;
  // Cada parada tiene que entrar entera en la pantalla. Arranca una en cada título, y si lo que sigue ya no entra
  // (en el celu, una sección con texto y diagrama), se corta antes de lo que no entra; un título nunca queda solo al final.
  let stops = [];
  const plan = () => {
    const room = innerHeight - pad() - (bar ? bar.getBoundingClientRect().height : 0) - 16;
    // Lo que solo ya no entra (un diagrama largo en un celu bajo) se recorre por partes: sus pasos pasan a ser candidatos.
    const flat = el => el.getBoundingClientRect().height > room && el.children.length > 1 ? [...el.children].flatMap(flat) : [el];
    const kids = [...article.children].filter(el => el !== bar && !el.matches('.back, header, span') && el.getBoundingClientRect().height > 0).flatMap(flat);
    stops = []; let start = null;
    kids.forEach((el, k) => {
      const head = el.matches('h2, h3, .built, .facts'), prev = kids[k - 1];
      const over = start && el.getBoundingClientRect().bottom - start.getBoundingClientRect().top > room;
      if (head || !start) { start = el; stops.push(el); }
      else if (over) { start = prev && prev.matches('h2, h3') && prev !== stops[stops.length - 1] ? prev : el; if (start !== stops[stops.length - 1]) stops.push(start); }
    });
  };
  plan();
  // Para las pruebas: qué paradas se armaron.
  window.__stops = () => stops;
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
  addEventListener('resize', () => { plan(); sync(); });
  addEventListener('load', () => { plan(); sync(); });
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
