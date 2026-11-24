// Arranque y navegación
import { db, getAjustes } from './db.js';
import { esc, fecha, diasEntre, hoyISO } from './ui.js';
import * as inicio from './views/inicio.js';
import * as propiedades from './views/propiedades.js';
import * as ficha from './views/ficha.js';
import * as ajustes from './views/ajustes.js';

export async function cargarTodo() {
  const [props, inqs, contratos, pagos, gastos, documentos, notas, aj] = await Promise.all([
    db.all('propiedades'), db.all('inquilinos'), db.all('contratos'), db.all('pagos'), db.all('gastos'), db.all('documentos'), db.all('notas'), getAjustes(),
  ]);
  props.sort((a, b) => (a.direccion || '').localeCompare(b.direccion || '', 'es', { numeric: true }));
  return { props, inqs, contratos, pagos, gastos, documentos, notas, aj, inq: (id) => inqs.find(i => i.id === id) };
}

const RUTAS = { inicio, propiedades, propiedad: ficha, ajustes };

async function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
  const name = RUTAS[parts[0]] ? parts[0] : 'inicio';
  const view = RUTAS[name];
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (name === 'propiedad' ? 'propiedades' : name)));
  document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.classList.contains('on')));
  const main = document.getElementById('main');
  const data = await cargarTodo();
  const refresh = () => route();
  main.innerHTML = await view.render(parts.slice(1), data);
  if (view.bind) view.bind(main, parts.slice(1), data, refresh);
  pintarEstado(data);
  if (window.__lastRoute !== location.hash) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  window.__lastRoute = location.hash;
}
export const rerender = () => route();

function pintarEstado(data) {
  const el = document.getElementById('sync');
  const u = data.aj.ultimaCopia;
  const dias = u ? diasEntre(u.slice(0, 10), hoyISO()) : null;
  const tarde = dias === null || dias > (data.aj.recordatorioDias || 15);
  el.innerHTML = `<b><span class="dot ${tarde ? 'warn' : ''}"></span>Guardado en este dispositivo</b>
    <span>${u ? `Última copia: ${esc(fecha(u))}` : 'Aún no has hecho ninguna copia'}</span>
    <a href="#/ajustes" style="color:#fff;font-weight:600">${tarde ? 'Hacer copia ahora' : 'Copias y ajustes'}</a>`;
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Pedir al navegador que no borre los datos si falta espacio
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
