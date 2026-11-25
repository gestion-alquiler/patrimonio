// Arranque, navegación y banda lateral (Patrimonio en verde, Admon. Fincas en azul)
import { db, getAjustes, getAjustesFincas } from './db.js';
import { esc, fecha, diasEntre, hoyISO } from './ui.js';
import { ultimaCopiaComun } from './copias.js';
import * as inicio from './views/inicio.js';
import * as propiedades from './views/propiedades.js';
import * as ficha from './views/ficha.js';
import * as ajustes from './views/ajustes.js';
import * as comunidades from './fincas/views/comunidades.js';
import * as comunidad from './fincas/views/comunidad.js';
import * as proveedoresV from './fincas/views/proveedores.js';
import * as fajustes from './fincas/views/ajustes.js';
import { vista as vistaPlantillas } from './views/plantillas.js';
const plantPat = vistaPlantillas('pat'), plantFin = vistaPlantillas('fin');

export async function cargarTodo() {
  const [props, inqs, contratos, pagos, gastos, documentos, notas, cartas, aj] = await Promise.all([
    db.all('propiedades'), db.all('inquilinos'), db.all('contratos'), db.all('pagos'), db.all('gastos'), db.all('documentos'), db.all('notas'), db.all('cartas'), getAjustes(),
  ]);
  props.sort((a, b) => (a.direccion || '').localeCompare(b.direccion || '', 'es', { numeric: true }));
  return { props, inqs, contratos, pagos, gastos, documentos, notas, cartas, aj, inq: (id) => inqs.find(i => i.id === id) };
}

export async function cargarFincas() {
  const [coms, vecinos, cobros, gastos, derramas, proveedores, juntas, cartas, aj] = await Promise.all([
    db.all('f_comunidades'), db.all('f_vecinos'), db.all('f_cobros'), db.all('f_gastos'), db.all('f_derramas'), db.all('f_proveedores'), db.all('f_juntas'), db.all('f_cartas'), getAjustesFincas(),
  ]);
  coms.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true }));
  vecinos.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || (a.piso || '').localeCompare(b.piso || '', 'es', { numeric: true }));
  proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  return { coms, vecinos, cobros, gastos, derramas, proveedores, juntas, cartas, aj };
}

const RUTAS = {
  inicio: [inicio, 'pat', 'inicio'], propiedades: [propiedades, 'pat', 'propiedades'], propiedad: [ficha, 'pat', 'propiedades'], ajustes: [ajustes, 'pat', 'ajustes'],
  fincas: [comunidades, 'fin', 'fincas'], finca: [comunidad, 'fin', 'fincas'], fproveedores: [proveedoresV, 'fin', 'fproveedores'], plantillas: [plantPat, 'pat', 'plantillas'], fplantillas: [plantFin, 'fin', 'fplantillas'], fajustes: [fajustes, 'fin', 'fajustes'],
};

const SVG = {
  casa: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  edificio: '<path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M16 9h3a1 1 0 0 1 1 1v11"/><path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1M3 21h18"/>',
  panel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  pisos: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M8 8h3M8 12h3M8 16h3M3 21h18"/>',
  texto: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  prov: '<path d="M14 7h3l3 4v5h-2"/><path d="M3 6h11v10H3z"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
};
const ico = (k) => `<svg aria-hidden="true" viewBox="0 0 24 24">${SVG[k]}</svg>`;

async function pintarSidebar(mod, activo, aj) {
  const nav = mod === 'pat'
    ? [['#/inicio', 'inicio', 'panel', 'Inicio'], ['#/propiedades', 'propiedades', 'pisos', 'Propiedades'], ['#/plantillas', 'plantillas', 'texto', 'Plantillas'], ['#/ajustes', 'ajustes', 'ajustes', 'Ajustes y copias']]
    : [['#/fincas', 'fincas', 'edificio', 'Comunidades'], ['#/fproveedores', 'fproveedores', 'prov', 'Proveedores'], ['#/fplantillas', 'fplantillas', 'texto', 'Plantillas'], ['#/fajustes', 'fajustes', 'ajustes', 'Ajustes y copias']];
  const soon = mod === 'pat' ? 'Próximamente: conciliación bancaria, informes' : 'Próximamente: actas, etiquetas, liquidaciones, conciliación';
  const u = await ultimaCopiaComun(), dias = u ? diasEntre(u.slice(0, 10), hoyISO()) : null;
  const tarde = dias === null || dias > (aj.recordatorioDias || 15);
  const ajRuta = mod === 'pat' ? '#/ajustes' : '#/fajustes';
  document.getElementById('sidebar').innerHTML = `
    <nav class="mods" aria-label="Aplicaciones">
      <a class="mod ${mod === 'pat' ? 'on' : ''}" href="#/inicio" ${mod === 'pat' ? 'aria-current="true"' : ''}><span class="mod-ico green">${ico('casa')}</span><span>Patrimonio</span></a>
      <a class="mod ${mod === 'fin' ? 'on' : ''}" href="#/fincas" ${mod === 'fin' ? 'aria-current="true"' : ''}><span class="mod-ico blue">${ico('edificio')}</span><span>Admon. Fincas</span></a>
    </nav>
    <nav class="nav" aria-label="${mod === 'pat' ? 'Patrimonio' : 'Admon. Fincas'}">
      <div class="nav-title">${mod === 'pat' ? 'Patrimonio' : 'Admon. Fincas'}</div>
      ${nav.map(([h, k, i, l]) => `<a href="${h}" class="${k === activo ? 'on' : ''}" ${k === activo ? 'aria-current="page"' : ''}>${ico(i)}${l}</a>`).join('')}
      <span class="nav-soon">${soon}</span>
    </nav>
    <div class="sync"><b><span class="dot ${tarde ? 'warn' : ''}"></span>Guardado en este dispositivo</b>
      <span>${u ? `Última copia completa: ${esc(fecha(u))}` : 'Aún no has hecho ninguna copia'}</span>
      <a href="${ajRuta}" style="color:#fff;font-weight:600">${tarde ? 'Hacer copia ahora' : 'Copias y ajustes'}</a></div>`;
  document.body.classList.toggle('fin', mod === 'fin');
  document.querySelector('meta[name=theme-color]').setAttribute('content', mod === 'fin' ? '#14233A' : '#1B2A25');
}

async function route() {
  window.__guard = null; window.onbeforeunload = null;
  const parts = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
  const name = RUTAS[parts[0]] ? parts[0] : 'inicio';
  const [view, mod, activo] = RUTAS[name];
  const main = document.getElementById('main');
  const data = mod === 'pat' ? await cargarTodo() : await cargarFincas();
  const refresh = () => route();
  const demo = (mod === 'pat' ? data.props : data.coms).some(x => x.prueba);
  main.innerHTML = (demo ? `<div class="demo">Estás viendo <b>datos de prueba</b> inventados. <a href="${mod === 'pat' ? '#/ajustes' : '#/fajustes'}">Borrarlos en Ajustes</a></div>` : '') + await view.render(parts.slice(1), data);
  if (view.bind) view.bind(main, parts.slice(1), data, refresh);
  await pintarSidebar(mod, activo, data.aj);
  if (window.__lastRoute !== location.hash) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  window.__lastRoute = location.hash;
}
export const rerender = () => route();

// Si una pantalla tiene cambios sin guardar, pregunta antes de salir
window.addEventListener('hashchange', async () => {
  if (window.__guard && location.hash !== window.__lastRoute) {
    const ok = await window.__guard();
    if (!ok) { history.replaceState(null, '', window.__lastRoute); return; }
  }
  route();
});
route();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
