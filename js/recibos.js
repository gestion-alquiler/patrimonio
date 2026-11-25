// Recibos de alquiler numerados (dos por hoja A4), en el idioma del inquilino.
import { db, getAjustes, setAjustes } from './db.js';
import { esc, eur, fecha, toast, modal, fd, select, MESES } from './ui.js';
import { abrirImpresion } from './imprimir.js';
import { fechaLarga } from './fincas/docs.js';

const MESCA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const T = {
  es: { tit: 'Recibo de arrendamiento', num: 'Nº', recibi: (n, dni) => `He recibido de <b>${esc(n)}</b>${dni ? ` (DNI ${esc(dni)})` : ''} la cantidad de`, concepto: (tipo, dir) => `en concepto de alquiler del ${tipo} situado en <b>${esc(dir)}</b>, según el siguiente detalle:`,
    renta: (m, y) => `Renta de ${MESES[m - 1].toLowerCase()} de ${y}`, basura: (y) => `Tasa de residuos (basura) ${y}`, total: 'Total', cobro: 'Fecha de cobro', forma: 'Forma de pago', arr: 'El arrendador', vivienda: 'inmueble' },
  ca: { tit: "Rebut d'arrendament", num: 'Núm.', recibi: (n, dni) => `He rebut de <b>${esc(n)}</b>${dni ? ` (DNI ${esc(dni)})` : ''} la quantitat de`, concepto: (tipo, dir) => `en concepte de lloguer de l'immoble situat a <b>${esc(dir)}</b>, segons el detall següent:`,
    renta: (m, y) => `Renda de ${MESCA[m - 1]} de ${y}`, basura: (y) => `Taxa de residus (escombraries) ${y}`, total: 'Total', cobro: 'Data de cobrament', forma: 'Forma de pagament', arr: "L'arrendador", vivienda: 'immoble' },
};

// Agrupa cobros en recibos: un recibo por contrato y mes (la basura anual va en su propio recibo)
function agrupar(pagos) {
  const g = new Map();
  pagos.forEach(p => { const k = `${p.contratoId}|${p.anio}|${p.concepto === 'basura' ? 0 : p.mes}`; if (!g.has(k)) g.set(k, []); g.get(k).push(p); });
  return [...g.values()].sort((a, b) => ((a[0].fecha || '') < (b[0].fecha || '') ? -1 : 1));
}

async function numerar(grupos) {
  const aj = await getAjustes(); aj.recibos = aj.recibos || {};
  for (const gr of grupos) {
    const ya = gr.find(p => p.recibo)?.recibo;
    if (ya) { for (const p of gr) if (!p.recibo) { p.recibo = ya; await db.put('pagos', p); } continue; }
    const y = Number((gr[0].fecha || String(gr[0].anio)).slice(0, 4)); const n = (aj.recibos[y] || 0) + 1; aj.recibos[y] = n;
    const num = `${y}-${String(n).padStart(4, '0')}`;
    for (const p of gr) { p.recibo = num; await db.put('pagos', p); }
  }
  await setAjustes(aj);
}

function recibo(gr, d) {
  const p0 = gr[0], k = d.contratos.find(x => x.id === p0.contratoId) || {}, prop = d.props.find(x => x.id === p0.propiedadId) || {}, i = d.inq(k.inquilinoId) || {}, pr = d.aj?.propietario || {};
  const l = i.idioma === 'ca' ? 'ca' : 'es', t = T[l];
  const total = gr.reduce((a, p) => a + (Number(p.importe) || 0), 0);
  const lineas = gr.map(p => `<tr><td>${p.concepto === 'basura' ? t.basura(p.anio) : t.renta(p.mes, p.anio)}</td><td class="r">${eur(p.importe)}</td></tr>`).join('');
  const dir = [prop.direccion, prop.zona].filter(Boolean).join(', ');
  return `<div class="recibo"><div class="rcab"><div><b>${esc(pr.nombre || '')}</b>${pr.dni ? '<br>NIF ' + esc(pr.dni) : ''}${pr.direccion ? '<br>' + esc(pr.direccion) : ''}</div><div class="rnum">${t.tit}<br><b>${t.num} ${esc(p0.recibo || '')}</b></div></div>
    <p>${t.recibi(i.nombre || '', i.dni)} <b>${eur(total)}</b> ${t.concepto(t.vivienda, dir)}</p>
    <table class="tabla"><tbody>${lineas}<tr class="tot"><td>${t.total}</td><td class="r">${eur(total)}</td></tr></tbody></table>
    <div class="rpie"><div>${t.cobro}: ${fecha(p0.fecha)}${p0.forma ? `<br>${t.forma}: ${esc(p0.forma)}` : ''}<br>${esc(prop.zona || '')}, ${fechaLarga(p0.fecha || new Date().toISOString().slice(0, 10), l)}</div><div>${t.arr}<div class="esp"></div>${esc(pr.nombre || '')}</div></div></div>`;
}

export async function imprimirRecibos(pagos, d, titulo = 'Recibos') {
  const grupos = agrupar(pagos.filter(p => p.contratoId));
  if (!grupos.length) { toast('No hay cobros para hacer recibos'); return; }
  await numerar(grupos);
  const hojas = []; for (let i = 0; i < grupos.length; i += 2) hojas.push(`<section class="hoja recibos" style="--c:#2F6B4F">${grupos.slice(i, i + 2).map(g => recibo(g, d)).join('<div class="corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>')}</section>`);
  if (!abrirImpresion(titulo, hojas)) toast('Permite las ventanas emergentes para esta página');
}

// Diálogo: recibos de un mes (o del año) de una propiedad o de todas
export function dialogoRecibos(d, propiedadId, refresh) {
  const y0 = new Date().getFullYear(), m0 = new Date().getMonth() + 1;
  modal({ title: 'Recibos de alquiler', submit: 'Ver recibos',
    body: `<div class="fgrid">${select('Año', 'anio', y0, [y0, y0 - 1, y0 - 2])}${select('Mes', 'mes', m0, [[0, 'Todo el año'], ...MESES.map((m, i) => [i + 1, m])])}</div>
      <div class="small muted">Un recibo por inquilino y mes, con el detalle de lo cobrado. La primera vez se numeran (año-número) y el número ya no cambia.</div>`,
    onSubmit: async (f) => { const x = fd(f); const y = Number(x.anio), m = Number(x.mes);
      const ps = d.pagos.filter(p => (!propiedadId || p.propiedadId === propiedadId) && p.anio === y && (!m || p.mes === m || (p.concepto === 'basura' && Number((p.fecha || '').slice(5, 7)) === m)));
      if (!ps.length) { toast('No hay cobros en ese periodo'); return false; }
      await imprimirRecibos(ps, d, `Recibos ${m ? MESES[m - 1].toLowerCase() + ' ' : ''}${y}`); refresh && refresh(); } });
}
