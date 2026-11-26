import { db, STORES_FIN, getAjustesFincas, setAjustesFincas } from '../../db.js';
import { esc, fecha, tamano, toast, confirmar, field, select, fd, diasEntre, hoyISO } from '../../ui.js';
import { htmlDrive, bindDrive } from '../../driveUI.js';
import { htmlCopias, bindCopias } from '../../copias.js';
import { htmlPrueba, bindPrueba } from '../../pruebaUI.js';
import { elegirArchivos } from '../../files.js';
import { importarDialogo } from './comunidades.js';

export async function render(_, d) {
  const aj = d.aj, ad = aj.admin || {};
  return `<div class="page">
  <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">Admon. Fincas</div><h1>Ajustes y copias · Admon. Fincas</h1><div class="sub">La copia de seguridad incluye las dos partes de la aplicación. El resto de ajustes solo afecta a Admon. Fincas.</div></div></div>
  <div class="row">
    ${htmlDrive()}
    ${await htmlCopias('fin', aj)}
    <section class="card pad stack grow1"><h2>Importar desde Excel</h2>
      <div>Lee una hoja de contabilidad de cuotas como la de Sant Llorenç, 19: vecinos y coeficientes, cuotas cobradas con su fecha, derramas, costes de obra y gastos por grupo.</div>
      <div class="actions"><button class="btn" data-a="excel">Elegir Excel…</button></div>
      <div class="small muted">Antes de importar verás un resumen. Si la comunidad ya existe, se sustituye.</div>
      <h2 style="margin-top:8px">Preferencias</h2>
      <form id="fpref" class="fgrid">${select('Recordarme hacer copia cada', 'recordatorioDias', aj.recordatorioDias || 15, [[7, '7 días'], [15, '15 días'], [30, '30 días']])}
      ${select('Idioma por defecto de los escritos', 'idioma', aj.idioma || 'ca', [['ca', 'Català'], ['es', 'Castellano']])}</form>
      <dl class="dl"><dt>Datos</dt><dd>${d.coms.length} comunidades · ${d.vecinos.length} vecinos · ${d.cobros.length} cobros · ${d.gastos.length} gastos · ${d.derramas.length} derramas</dd></dl>
    </section>
  </div>
  <div class="row">
    <section class="card pad stack grow1"><h2>Datos del administrador</h2><div class="small muted">Saldrán en las convocatorias, comunicados y liquidaciones.</div>
      <form id="fadm" class="fgrid">${field('Nombre o despacho', 'nombre', ad.nombre)}${field('NIF', 'nif', ad.nif)}${field('Nº de colegiado', 'colegiado', ad.colegiado)}${field('Teléfono', 'telefono', ad.telefono)}${field('Email', 'email', ad.email)}${field('Dirección', 'direccion', ad.direccion)}
      <div class="span2"><button class="btn primary">Guardar datos</button></div></form></section>
    <section class="card pad stack grow1"><h2>Zona de peligro</h2>
      <div class="small muted">Borra todas las comunidades de este dispositivo. Haz antes una copia.</div>
      <div class="actions"><button class="btn danger" data-a="borrarTodo">Borrar todos los datos de Admon. Fincas</button></div></section>
  </div>
  ${await htmlPrueba()}
  </div>`;
}

export function bind(el, _, d, refresh) {
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  bindCopias(el, 'fin', refresh); bindDrive(el, refresh);
  bindPrueba(el, refresh);
  on('[data-a=excel]', () => importarDialogo(d, refresh));
  on('[data-a=borrarTodo]', async () => {
    if (!(await confirmar('Borrar Admon. Fincas', 'Se borrarán <b>todas</b> las comunidades, vecinos, cobros, gastos y derramas de este dispositivo.', 'Borrar todo'))) return;
    for (const s of STORES_FIN) await db.clear(s); toast('Datos borrados'); refresh();
  });
  const fp = el.querySelector('#fpref');
  fp.querySelectorAll('select').forEach(s => s.onchange = async () => { const aj = await getAjustesFincas(); const x = fd(fp); aj.recordatorioDias = Number(x.recordatorioDias); aj.idioma = x.idioma; await setAjustesFincas(aj); toast('Guardado'); refresh(); });
  const fa = el.querySelector('#fadm');
  fa.onsubmit = async (e) => { e.preventDefault(); const aj = await getAjustesFincas(); aj.admin = fd(fa); await setAjustesFincas(aj); toast('Datos guardados'); };
}
