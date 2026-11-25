// Bloque «Copia de seguridad» común a Patrimonio y Admon. Fincas: una sola app con dos partes.
import { getAjustes, getAjustesFincas } from './db.js';
import { esc, fecha, tamano, toast, modal, fd, diasEntre, hoyISO } from './ui.js';
import { exportarZip, leerZip, restaurar, NOMBRE } from './backup.js';
import { elegirArchivos } from './files.js';

// Fecha de la última copia que incluye las dos partes (la más antigua de las dos)
export const esMovil = () => matchMedia('(max-width: 760px)').matches;

export async function ultimaCopiaComun() {
  const [a, b] = await Promise.all([getAjustes(), getAjustesFincas()]);
  if (!a.ultimaCopia || !b.ultimaCopia) return null;
  return a.ultimaCopia < b.ultimaCopia ? a.ultimaCopia : b.ultimaCopia;
}

export async function htmlCopias(mod, aj) {
  const u = await ultimaCopiaComun(), dias = u ? diasEntre(u.slice(0, 10), hoyISO()) : null;
  const otra = mod === 'pat' ? 'fin' : 'pat';
  return `<section class="card pad small muted solo-movil">Las copias de seguridad se hacen desde el ordenador.</section>
  <section class="card pad stack grow1 solo-pc"><h2>Copia de seguridad</h2>
    <div>Un solo archivo .zip con <b>toda la aplicación</b>: Patrimonio y Admon. Fincas, con sus documentos y fotos. Guárdalo en un disco, en Drive o en el correo.</div>
    <div class="strip ${dias === null || dias > (aj.recordatorioDias || 15) ? 'warn' : 'ok'}"><div><div class="l">Última copia completa</div><b>${u ? fecha(u) + (dias === 0 ? ' (hoy)' : ` (hace ${dias} ${dias === 1 ? 'día' : 'días'})`) : 'Nunca'}</b></div></div>
    <div class="actions"><button class="btn primary" data-copia="todo">Exportar copia completa (.zip)</button><button class="btn" data-copia="importar">Importar / restaurar copia…</button></div>
    <div class="small muted">Al restaurar podrás elegir si recuperas todo o solo una de las dos partes. Así pasas tus datos del ordenador al móvil y al revés.</div>
    <details class="small"><summary style="cursor:pointer;color:var(--muted)">Copia de una sola parte</summary>
      <div class="actions" style="margin-top:8px"><button class="btn sm" data-copia="${mod}">Solo ${NOMBRE[mod]}</button><button class="btn sm" data-copia="${otra}">Solo ${NOMBRE[otra]}</button></div>
      <div class="muted" style="margin-top:6px">Útil, por ejemplo, para pasar a otra persona solo los datos de las comunidades.</div></details>
  </section>`;
}

export function bindCopias(el, mod, refresh) {
  el.querySelectorAll('[data-copia]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.copia;
    if (k === 'importar') return importar(mod, refresh);
    const txt = b.textContent; b.disabled = true; b.textContent = 'Preparando…';
    try { const n = await exportarZip(k === 'todo' ? ['pat', 'fin'] : [k]); toast('Copia descargada (' + tamano(n) + ')'); }
    catch (e) { toast('Error: ' + e.message); b.disabled = false; b.textContent = txt; return; }
    refresh();
  }));
}

async function importar(mod, refresh) {
  const [f] = await elegirArchivos({ accept: '.zip,application/zip', multiple: false }); if (!f) return;
  let copia;
  try { copia = await leerZip(f); } catch (e) { toast('No se pudo leer: ' + e.message); return; }
  const { partes, resumen, json } = copia;
  const ambas = partes.length > 1;
  const opcion = (v, titulo, detalle, checked) => `<label class="alert" style="cursor:pointer"><input type="radio" name="que" value="${v}" ${checked ? 'checked' : ''} style="margin-top:4px"><span><b>${titulo}</b><br><span class="small muted">${detalle}</span></span></label>`;
  modal({ title: 'Restaurar copia', submit: 'Restaurar', danger: true,
    body: `<p style="margin:0">Copia del <b>${esc(fecha(json.exportado))}</b>${ambas ? ', con las dos partes de la aplicación' : `, solo con ${NOMBRE[partes[0]]}`}.</p>
      ${ambas ? opcion('todo', 'Todo', `${NOMBRE.pat}: ${resumen.pat}.<br>${NOMBRE.fin}: ${resumen.fin}.`, true) + opcion('pat', 'Solo Patrimonio', resumen.pat) + opcion('fin', 'Solo Admon. Fincas', resumen.fin)
        : `<input type="hidden" name="que" value="${partes[0]}"><div class="alert"><span>${resumen[partes[0]]}.</span></div>`}
      <div class="strip warn"><div class="small">Lo que restaures <b>sustituye</b> a los datos de este dispositivo. La parte que no restaures no se toca.</div></div>`,
    onSubmit: async (form) => {
      const que = fd(form).que; const sel = que === 'todo' ? ['pat', 'fin'] : [que];
      await restaurar(copia, sel); toast('Copia restaurada');
      const destino = sel.length > 1 ? (mod === 'pat' ? '#/inicio' : '#/fincas') : (sel[0] === 'pat' ? '#/inicio' : '#/fincas');
      if (location.hash === destino) refresh(); else location.hash = destino;
    } });
}
