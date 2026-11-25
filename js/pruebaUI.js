// Bloque «Datos de prueba» en los Ajustes de las dos partes (se quitará cuando empiecen los datos reales)
import { esc, toast, confirmar } from './ui.js';
import { cargarPrueba, borrarPrueba, hayPrueba } from './prueba.js';

export async function htmlPrueba() {
  const hay = await hayPrueba();
  return `<section class="card pad stack" style="border-style:dashed"><div class="head" style="align-items:center"><div><h2>Datos de prueba</h2>
    <div class="small muted">Rellena toda la aplicación con datos inventados para probarla: 10 propiedades con inquilinos, cobros, gastos y documentos, y 3 comunidades con vecinos, cuotas, gastos y una derrama.</div></div>
    <div class="actions">${hay ? '<button class="btn danger" data-prueba="borrar">Borrar datos de prueba</button>' : '<button class="btn primary" data-prueba="cargar">Cargar datos de prueba</button>'}</div></div>
    ${hay ? '<div class="small">Hay datos de prueba cargados. Al borrarlos solo se quita lo inventado: lo que hayas metido tú se conserva.</div>' : ''}</section>`;
}

export function bindPrueba(el, refresh) {
  el.querySelectorAll('[data-prueba]').forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.prueba === 'cargar') {
      b.disabled = true; b.textContent = 'Cargando… (unos segundos)';
      try { await cargarPrueba(); toast('Datos de prueba cargados'); } catch (e) { console.error(e); toast('Error: ' + e.message); }
      refresh();
    } else {
      if (!(await confirmar('Borrar datos de prueba', 'Se borrarán todas las propiedades, inquilinos, comunidades y demás datos inventados de las dos partes. Lo que hayas metido tú no se toca.', 'Borrar'))) return;
      const n = await borrarPrueba(); toast(`Datos de prueba borrados (${n} registros)`); refresh();
    }
  }));
}
