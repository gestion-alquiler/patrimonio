import { db, STORES, getAjustes, setAjustes } from '../db.js';
import { esc, fecha, tamano, toast, confirmar, field, select, fd, diasEntre, hoyISO } from '../ui.js';
import { exportarZip, leerZip, restaurar, exportarCSV } from '../backup.js';
import { elegirArchivos } from '../files.js';
import { cargarEjemplo } from '../ejemplo.js';

export async function render(_, d) {
  let uso = '', cuota = '';
  if (navigator.storage?.estimate) { try { const e = await navigator.storage.estimate(); uso = tamano(e.usage || 0); cuota = tamano(e.quota || 0); } catch {} }
  const docsBytes = d.documentos.reduce((a, x) => a + (x.size || 0), 0);
  const aj = d.aj, pr = aj.propietario || {};
  const u = aj.ultimaCopia, dias = u ? diasEntre(u.slice(0, 10), hoyISO()) : null;
  return `<div class="page">
  <div class="head"><div><h1>Ajustes y copias · Patrimonio</h1><div class="sub">Solo afecta a Patrimonio. Admon. Fincas tendrá sus propios ajustes y copias.</div></div></div>
  <div class="row">
    <section class="card pad stack grow1"><h2>Copia de seguridad completa</h2>
      <div>Un archivo .zip con todos los datos, contratos, documentos, facturas y fotos. Guárdalo en un disco, en Drive o en el correo.</div>
      <div class="strip ${dias === null || dias > (aj.recordatorioDias || 15) ? 'warn' : 'ok'}"><div><div class="l">Última copia</div><b>${u ? fecha(u) + ` (hace ${dias} días)` : 'Nunca'}</b></div></div>
      <div class="actions"><button class="btn primary" data-a="exportar">Exportar copia completa (.zip)</button><button class="btn" data-a="importar">Importar / restaurar copia…</button></div>
      <div class="small muted">Al restaurar se sustituyen todos los datos de este dispositivo por los de la copia. Así puedes pasar tus datos del ordenador al móvil y al revés.</div>
    </section>
    <section class="card pad stack grow1"><h2>Recordatorio y espacio</h2>
      <form id="frec" class="stack">${select('Recordarme hacer copia cada', 'recordatorioDias', aj.recordatorioDias || 15, [[7, '7 días'], [15, '15 días'], [30, '30 días']])}
      ${select('Idioma por defecto de las cartas', 'idioma', aj.idioma || 'es', [['es', 'Castellano'], ['ca', 'Català']])}</form>
      <dl class="dl"><dt>Documentos y fotos</dt><dd class="num">${tamano(docsBytes)} (${d.documentos.length} archivos)</dd>${uso ? `<dt>Usado por la app</dt><dd class="num">${uso}${cuota ? ' de ' + cuota + ' disponibles' : ''}</dd>` : ''}
      <dt>Datos</dt><dd>${d.props.length} propiedades · ${d.contratos.length} contratos · ${d.pagos.length} cobros · ${d.gastos.length} gastos</dd></dl>
    </section>
  </div>
  <div class="row">
    <section class="card pad stack grow1"><h2>Datos del propietario</h2><div class="small muted">Saldrán como remitente en las cartas.</div>
      <form id="fprop" class="fgrid">${field('Nombre y apellidos', 'nombre', pr.nombre)}${field('DNI / NIF', 'dni', pr.dni)}${field('Dirección', 'direccion', pr.direccion, { span2: true })}${field('Teléfono', 'telefono', pr.telefono)}${field('Email', 'email', pr.email)}
      <div class="span2"><button class="btn primary">Guardar datos</button></div></form></section>
    <section class="card pad stack grow1"><h2>Exportar a Excel (CSV)</h2>
      <div class="stack"><button class="btn" data-csv="propiedades" style="justify-content:space-between">Propiedades e inquilinos <span class="muted">CSV</span></button>
      <button class="btn" data-csv="pagos" style="justify-content:space-between">Cobros <span class="muted">CSV</span></button>
      <button class="btn" data-csv="gastos" style="justify-content:space-between">Gastos <span class="muted">CSV</span></button></div>
      <div class="small muted">Se abren directamente con Excel (separador punto y coma).</div>
      <h2 style="margin-top:12px">Zona de peligro</h2>
      <div class="actions"><button class="btn" data-a="ejemplo">Cargar datos de ejemplo</button><button class="btn danger" data-a="borrarTodo">Borrar todos los datos</button></div>
    </section>
  </div>
  <section class="card pad small muted">Tus datos se guardan en este navegador y dispositivo. Próximamente se sincronizarán con tu Google Drive para usarlos a la vez en el móvil y el ordenador. Mientras tanto, usa las copias .zip.</section>
  </div>`;
}

export function bind(el, _, d, refresh) {
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  on('[data-a=exportar]', async (b) => { b.disabled = true; b.textContent = 'Preparando…'; try { const n = await exportarZip(); toast('Copia descargada (' + tamano(n) + ')'); } catch (e) { toast('Error: ' + e.message); } refresh(); });
  on('[data-a=importar]', async () => {
    const [f] = await elegirArchivos({ accept: '.zip,application/zip', multiple: false }); if (!f) return;
    try {
      const copia = await leerZip(f);
      const n = copia.json.datos;
      const ok = await confirmar('Restaurar copia', `La copia es del <b>${esc(fecha(copia.json.exportado))}</b> y tiene ${(n.propiedades || []).length} propiedades, ${(n.pagos || []).length} cobros, ${(n.gastos || []).length} gastos y ${(n.documentos || []).length} documentos.<br><br>Se <b>sustituirán todos los datos</b> de este dispositivo. ¿Continuar?`, 'Restaurar');
      if (!ok) return;
      await restaurar(copia); toast('Copia restaurada'); location.hash = '#/inicio'; refresh();
    } catch (e) { toast('No se pudo leer: ' + e.message); }
  });
  on('[data-csv]', async (b) => { await exportarCSV(b.dataset.csv); toast('Archivo descargado'); });
  on('[data-a=ejemplo]', async () => { if (d.props.length && !(await confirmar('Cargar ejemplo', 'Se añadirán 3 propiedades de ejemplo a tus datos actuales.', 'Añadir'))) return; await cargarEjemplo(); toast('Ejemplo cargado'); refresh(); });
  on('[data-a=borrarTodo]', async () => {
    if (!(await confirmar('Borrar todos los datos', 'Se borrarán <b>todas</b> las propiedades, contratos, cobros, gastos, documentos y notas de este dispositivo. Haz antes una copia si los quieres conservar.', 'Borrar todo'))) return;
    for (const s of STORES) if (s !== 'ajustes') await db.clear(s);
    toast('Datos borrados'); refresh();
  });
  const fr = el.querySelector('#frec');
  fr.querySelectorAll('select').forEach(s => s.onchange = async () => { const aj = await getAjustes(); const x = fd(fr); aj.recordatorioDias = Number(x.recordatorioDias); aj.idioma = x.idioma; await setAjustes(aj); toast('Guardado'); refresh(); });
  const fp = el.querySelector('#fprop');
  fp.onsubmit = async (e) => { e.preventDefault(); const aj = await getAjustes(); aj.propietario = fd(fp); await setAjustes(aj); toast('Datos guardados'); };
}
