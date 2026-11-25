// Patrimonio → Informes: resultado por inmueble, gastos por categoría y datos para la declaración de la renta.
import { esc, eur, toast, descargar, fecha } from '../ui.js';
import { balanceAnual, cubreMes, CATEGORIAS_GASTO } from '../calc.js';
import { abrirImpresion } from '../imprimir.js';

let anio = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);

// Días del año en que el inmueble estuvo alquilado (según los contratos)
function diasAlquilado(p, d, y) {
  const cs = d.contratos.filter(k => k.propiedadId === p.id);
  const ini = new Date(Date.UTC(y, 0, 1)), dias = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
  let n = 0;
  for (let i = 0; i < dias; i++) {
    const dt = new Date(ini.getTime() + i * 86400000); const iso = dt.toISOString().slice(0, 10);
    if (cs.some(k => k.inicio <= iso && iso <= (k.estado === 'finalizado' ? (k.fechaSalida || k.fin) : (k.fin > iso ? k.fin : '9999')))) n++;
  }
  return { n, dias };
}

// Agrupación orientativa de gastos para la renta
const RENTA = [['IBI y tasas', ['IBI', 'Basuras']], ['Comunidad de propietarios', ['Comunidad']], ['Seguros', ['Seguro']], ['Reparación y conservación', ['Mantenimiento']],
  ['Servicios de terceros (gestoría, honorarios)', ['Gestoría / honorarios']], ['Suministros', ['Suministros']], ['Otros gastos', ['Otros']]];

export function calcInformes(d, y) {
  const hoy = new Date().toISOString().slice(0, 10);
  const props = d.props.slice().sort((a, b) => (a.direccion || '').localeCompare(b.direccion || '', 'es'));
  const filas = props.map(p => {
    const b = balanceAnual(y, d.pagos, d.gastos, p.id);
    const gs = d.gastos.filter(g => g.propiedadId === p.id && (g.fecha || '').startsWith(String(y)) && !(g.estado === 'pendiente' && g.fecha > hoy));
    const porCat = Object.fromEntries(CATEGORIAS_GASTO.map(c => [c, gs.filter(g => (g.categoria || 'Otros') === c).reduce((a, g) => a + (Number(g.importe) || 0), 0)]));
    const rentasDevengo = d.pagos.filter(x => x.propiedadId === p.id && x.anio === y).reduce((a, x) => a + (Number(x.importe) || 0), 0);
    const inversion = (Number(p.precioCompra) || 0) + (Number(p.gastosCompra) || 0);
    const da = diasAlquilado(p, d, y);
    return { p, ing: b.ing, gas: b.gas, res: b.margen, porCat, rentasDevengo, inversion, brut: p.precioCompra ? b.ing / p.precioCompra : null, neta: inversion ? b.margen / inversion : null, dias: da.n, diasAnio: da.dias };
  });
  const sum = (k) => filas.reduce((a, f) => a + (f[k] || 0), 0);
  return { y, filas, tot: { ing: sum('ing'), gas: sum('gas'), res: sum('res'), inv: sum('inversion') }, cat: Object.fromEntries(CATEGORIAS_GASTO.map(c => [c, filas.reduce((a, f) => a + f.porCat[c], 0)])) };
}
const pc = (x) => (x == null ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %');

export async function render(_, d) {
  const R = calcInformes(d, anio), y0 = new Date().getFullYear();
  const maxCat = Math.max(1, ...Object.values(R.cat));
  return `<div class="page">
  <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">Patrimonio</div><h1>Informes ${anio}</h1><div class="sub">Cobros y gastos por fecha de pago. Datos orientativos: revisa la declaración con tu gestor.</div></div>
    <div class="actions"><label class="sr" for="anioInf">Año</label><select id="anioInf" class="inp" style="width:auto">${[y0, y0 - 1, y0 - 2, y0 - 3].map(y => `<option ${y === anio ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <button class="btn" data-i="recibos">Recibos de un mes</button><button class="btn" data-i="csv">Exportar</button><button class="btn primary" data-i="pdf">PDF del informe</button></div></div>
  <section class="kpis">
    <div class="card kpi"><div class="l">Ingresos</div><div class="v num">${eur(R.tot.ing, 0)}</div><div class="s">Rentas y basuras cobradas</div></div>
    <div class="card kpi"><div class="l">Gastos</div><div class="v num">${eur(R.tot.gas, 0)}</div><div class="s">Pagados en el año</div></div>
    <div class="card kpi"><div class="l">Resultado</div><div class="v num ${R.tot.res < 0 ? 'neg' : ''}">${eur(R.tot.res, 0)}</div><div class="s">${R.tot.ing ? 'Margen ' + pc(R.tot.res / R.tot.ing) : '&nbsp;'}</div></div>
    <div class="card kpi"><div class="l">Rentabilidad neta</div><div class="v num">${pc(R.tot.inv ? R.tot.res / R.tot.inv : null)}</div><div class="s">Sobre precio + gastos de compra</div></div>
  </section>
  <section class="card"><div class="cardhead"><h2>Resultado por inmueble</h2></div><div class="tw"><table style="min-width:900px"><thead><tr><th>Inmueble</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Resultado</th><th class="r">Rent. bruta</th><th class="r">Rent. neta</th><th class="r">Días alquilado</th></tr></thead><tbody>
    ${R.filas.map(f => `<tr><td class="b"><a href="#/propiedad/${f.p.id}/balance">${esc(f.p.direccion)}</a><div class="small muted" style="font-weight:400">${esc([f.p.zona, f.p.tipo].filter(Boolean).join(' · '))}</div></td><td class="r num">${eur(f.ing)}</td><td class="r num">${eur(f.gas)}</td><td class="r num b ${f.res < 0 ? 'neg' : ''}">${eur(f.res)}</td><td class="r num">${pc(f.brut)}</td><td class="r num">${pc(f.neta)}</td><td class="r num">${f.dias} / ${f.diasAnio}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r num">${eur(R.tot.ing)}</td><td class="r num">${eur(R.tot.gas)}</td><td class="r num">${eur(R.tot.res)}</td><td></td><td class="r num">${pc(R.tot.inv ? R.tot.res / R.tot.inv : null)}</td><td></td></tr></tbody></table></div></section>
  <div class="row">
  <section class="card grow1"><div class="cardhead"><h2>Gastos por categoría</h2></div><div class="tw"><table><tbody>
    ${CATEGORIAS_GASTO.filter(c => R.cat[c]).map(c => `<tr><td>${esc(c)}</td><td style="width:45%"><div class="split" style="height:8px"><span style="width:${R.cat[c] / maxCat * 100}%;background:var(--gas)"></span></div></td><td class="r num b">${eur(R.cat[c])}</td></tr>`).join('') || '<tr><td class="muted">Sin gastos</td></tr>'}
  </tbody></table></div></section>
  <section class="card pad stack grow1"><h2>Datos para la declaración de la renta</h2>
    <div class="small muted">Para cada inmueble: días alquilado, ingresos del año y gastos agrupados como en el programa de la renta. Faltan la amortización y los intereses del préstamo, si los hay: consúltalos con tu gestor.</div>
    <div class="actions"><button class="btn" data-i="renta">Ver por inmueble (PDF)</button><button class="btn" data-i="csvRenta">Exportar para el gestor</button></div></section></div>
  </div>`;
}

function paginasRenta(R, d) {
  const pr = d.aj?.propietario || {};
  return R.filas.map(f => `<section class="hoja"><header class="cab" style="--c:#2F6B4F"><div class="com"><b>${esc(pr.nombre || 'Propietario/a')}</b>${pr.dni ? '<br>' + esc(pr.dni) : ''}</div><div class="dat">Datos para la renta ${R.y}</div></header>
    <h1 style="margin-top:6mm">${esc(f.p.direccion)}</h1><p class="peq">${esc([f.p.zona, f.p.tipo].filter(Boolean).join(' · '))}${f.p.refCatastral ? ' · Ref. catastral ' + esc(f.p.refCatastral) : ''}</p>
    <table class="tabla"><tbody><tr><td>Días arrendado en ${R.y}</td><td class="r">${f.dias} de ${f.diasAnio}</td></tr><tr><td>Ingresos íntegros (rentas y repercusiones del año)</td><td class="r">${eur(f.rentasDevengo)}</td></tr>
      ${RENTA.map(([n, cats]) => { const v = cats.reduce((a, c) => a + (f.porCat[c] || 0), 0); return v ? `<tr><td>${esc(n)}</td><td class="r">${eur(v)}</td></tr>` : ''; }).join('')}
      ${f.porCat['Extraordinario / obras'] ? `<tr><td>Obras y mejoras (pueden ser amortizables: consultar)</td><td class="r">${eur(f.porCat['Extraordinario / obras'])}</td></tr>` : ''}
      <tr class="tot"><td>Total gastos registrados</td><td class="r">${eur(f.gas)}</td></tr>
      <tr><td>Valor de adquisición (precio + gastos)</td><td class="r">${f.inversion ? eur(f.inversion) : '—'}</td></tr></tbody></table>
    <p class="peq">Resumen generado con los datos de la aplicación. No incluye la amortización del inmueble ni los intereses de financiación, ni aplica reducciones: compruébalo con tu gestor.</p></section>`);
}

export function bind(el, _, d, refresh) {
  const R = calcInformes(d, anio);
  el.querySelector('#anioInf').onchange = (e) => { anio = Number(e.target.value); refresh(); };
  const abrir = (t, p) => { if (!abrirImpresion(t, p)) toast('Permite las ventanas emergentes para esta página'); };
  el.querySelector('[data-i=recibos]').onclick = async () => { const { dialogoRecibos } = await import('../recibos.js'); dialogoRecibos(d, null, refresh); };
  el.querySelector('[data-i=renta]').onclick = () => abrir(`Datos para la renta ${anio}`, paginasRenta(R, d));
  el.querySelector('[data-i=pdf]').onclick = () => {
    const html = el.querySelector('.page').cloneNode(true); html.querySelectorAll('.actions, .demo, button').forEach(x => x.remove());
    abrir(`Informe ${anio}`, [`<section class="hoja informe" style="--c:#2F6B4F"><header class="cab"><div class="com"><b>${esc(d.aj?.propietario?.nombre || 'Patrimonio')}</b></div><div class="dat">Informe ${anio} · ${fecha(new Date().toISOString().slice(0, 10))}</div></header>
      <table class="tabla"><thead><tr><th>Inmueble</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Resultado</th><th class="r">Rent. neta</th><th class="r">Días</th></tr></thead><tbody>
      ${R.filas.map(f => `<tr><td>${esc(f.p.direccion)}</td><td class="r">${eur(f.ing)}</td><td class="r">${eur(f.gas)}</td><td class="r">${eur(f.res)}</td><td class="r">${pc(f.neta)}</td><td class="r">${f.dias}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="r">${eur(R.tot.ing)}</td><td class="r">${eur(R.tot.gas)}</td><td class="r">${eur(R.tot.res)}</td><td class="r">${pc(R.tot.inv ? R.tot.res / R.tot.inv : null)}</td><td></td></tr></tbody></table>
      <h2>Gastos por categoría</h2><table class="tabla"><tbody>${CATEGORIAS_GASTO.filter(c => R.cat[c]).map(c => `<tr><td>${esc(c)}</td><td class="r">${eur(R.cat[c])}</td></tr>`).join('')}</tbody></table></section>`]);
  };
  const csvDe = async (rows, nombre) => { const { csv } = await import('../backup.js'); descargar(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), nombre); toast('Archivo descargado'); };
  const n2 = (x) => String((Number(x) || 0).toFixed(2)).replace('.', ',');
  el.querySelector('[data-i=csv]').onclick = () => csvDe([['Inmueble', 'Zona', 'Ingresos', 'Gastos', 'Resultado', 'Rent. bruta %', 'Rent. neta %', 'Días alquilado', ...CATEGORIAS_GASTO],
    ...R.filas.map(f => [f.p.direccion, f.p.zona, n2(f.ing), n2(f.gas), n2(f.res), f.brut == null ? '' : n2(f.brut * 100), f.neta == null ? '' : n2(f.neta * 100), f.dias, ...CATEGORIAS_GASTO.map(c => n2(f.porCat[c]))])], `informe_${anio}.csv`);
  el.querySelector('[data-i=csvRenta]').onclick = () => csvDe([['Inmueble', 'Ref. catastral', 'Días arrendado', 'Ingresos íntegros', ...RENTA.map(r => r[0]), 'Obras y mejoras', 'Valor de adquisición'],
    ...R.filas.map(f => [f.p.direccion, f.p.refCatastral || '', f.dias, n2(f.rentasDevengo), ...RENTA.map(([, cats]) => n2(cats.reduce((a, c) => a + (f.porCat[c] || 0), 0))), n2(f.porCat['Extraordinario / obras']), n2(f.inversion)])], `renta_${anio}.csv`);
}
