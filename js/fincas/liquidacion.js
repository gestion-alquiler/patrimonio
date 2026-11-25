// Liquidación anual de la comunidad y de cada propietario (castellano / català).
import { db } from '../db.js';
import { esc, eur, fecha, hoyISO, toast, MESES } from '../ui.js';
import { vecinosDe, estadoCuota, deudaVecino, parteDerrama, coefTxt, grupoTxt } from './calc.js';
import { cabeceraCom, lugarFechaCom } from './docs.js';
import { abrirImpresion } from '../imprimir.js';

const r2 = (n) => Math.round(n * 100) / 100;

export function calcLiquidacion(c, d, y) {
  const hoy = hoyISO(), yHoy = Number(hoy.slice(0, 4));
  const finY = y < yHoy ? `${y}-12-31` : hoy;
  const vs = vecinosDe(d, c.id), n = Math.max(1, vs.length);
  const enAnio = (f) => (f || '').startsWith(String(y));
  const gs = d.gastos.filter(g => g.comunidadId === c.id && g.estado !== 'pendiente' && enAnio(g.fecha));
  const G = { iguales: 0, coef: 0, derrama: 0 };
  gs.forEach(g => { G[g.grupo === 'iguales' ? 'iguales' : g.grupo === 'derrama' ? 'derrama' : 'coef'] += Number(g.importe) || 0; });
  const cobros = d.cobros.filter(x => x.comunidadId === c.id);
  const I = { cuotas: 0, derramas: 0, otros: 0 };
  cobros.filter(x => enAnio(x.fecha)).forEach(x => { I[x.concepto === 'cuota' ? 'cuotas' : x.concepto === 'derrama' ? 'derramas' : 'otros'] += Number(x.importe) || 0; });
  const ders = d.derramas.filter(x => x.comunidadId === c.id);
  const mesMax = y < yHoy ? 12 : Number(hoy.slice(5, 7));
  const filas = vs.map(v => {
    let emit = 0, cob = 0;
    for (let m = 1; m <= mesMax; m++) { const e = estadoCuota(c, v, cobros, y, m, finY); if (!['na', 'previo'].includes(e.estado)) emit += e.esp || 0; }
    cob = cobros.filter(x => x.vecinoId === v.id && x.concepto === 'cuota' && x.anio === y).reduce((a, x) => a + (Number(x.importe) || 0), 0);
    const otros = cobros.filter(x => x.vecinoId === v.id && x.concepto === 'otro' && enAnio(x.fecha)).reduce((a, x) => a + (Number(x.importe) || 0), 0);
    let derEmit = 0, derCob = 0;
    ders.forEach(der => { const np = (der.plazos || []).length || 1; (der.plazos || [{}]).forEach((pl, i) => { if ((pl.mes || '').startsWith(String(y)) && pl.mes <= finY.slice(0, 7)) derEmit += parteDerrama(der, v, vs) / np; }); });
    derCob = cobros.filter(x => x.vecinoId === v.id && x.concepto === 'derrama' && enAnio(x.fecha)).reduce((a, x) => a + (Number(x.importe) || 0), 0);
    const gIg = G.iguales / n, gCoef = G.coef * (Number(v.coef) || 0) / 100;
    const asignado = gIg + gCoef;
    const anterior = deudaVecino(c, v, d, `${y - 1}-12-31`).total;
    const pendiente = deudaVecino(c, v, d, finY).total;
    return { v, gIg: r2(gIg), gCoef: r2(gCoef), asignado: r2(asignado), emit: r2(emit), cob: r2(cob), otros: r2(otros), derEmit: r2(derEmit), derCob: r2(derCob), resultado: r2(emit - asignado), anterior: r2(anterior), pendiente: r2(pendiente) };
  });
  const pres = (c.presupuestos || {})[y] || [];
  const partidas = pres.map(p => ({ partida: p.partida, presupuesto: Number(p.importe) || 0, real: gs.filter(g => g.grupo !== 'derrama' && g.partida === p.partida).reduce((a, g) => a + (Number(g.importe) || 0), 0) }));
  const sinPartida = gs.filter(g => g.grupo !== 'derrama' && !pres.some(p => p.partida === g.partida)).reduce((a, g) => a + (Number(g.importe) || 0), 0);
  const tot = (k) => r2(filas.reduce((a, f) => a + f[k], 0));
  return { y, finY, cerrado: y < yHoy, vs, G, I, filas, partidas, sinPartida, totPres: pres.reduce((a, p) => a + (Number(p.importe) || 0), 0), tot, gastos: gs };
}

const st = { anio: new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0), lang: null, idioma: (c) => st.lang || (c.idioma === 'es' ? 'es' : 'ca') };
const MES3 = { es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], ca: ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des'] };

// Saldo de la comunidad a 31/12 del año anterior: el anotado a mano para la liquidación o el último saldo del banco hasta esa fecha
function saldoAnterior(c, y) {
  const man = c.liqSaldos?.[y];
  if (man != null && man !== '') return { importe: Number(man), origen: 'manual' };
  const lim = `${y - 1}-12-31`;
  const sb = (c.saldosBanco || []).filter(x => x.fecha <= lim).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  return sb ? { importe: Number(sb.importe), origen: `banco ${sb.fecha.split('-').reverse().join('/')}` } : { importe: 0, origen: 'sin dato' };
}

// Todo lo que sale en la liquidación
function datos(c, d, y) {
  const L = calcLiquidacion(c, d, y);
  const ant = saldoAnterior(c, y);
  const ingresos = L.I.cuotas + L.I.derramas + L.I.otros, gastos = L.G.iguales + L.G.coef + L.G.derrama;
  const final = ant.importe + ingresos - gastos, fondo = Number(c.fondoReserva) || 0;
  const porPartida = (grupo) => { const m = {}; L.gastos.filter(g => (g.grupo === 'iguales' ? 'iguales' : g.grupo === 'derrama' ? 'derrama' : 'coef') === grupo).forEach(g => { const k = g.partida || g.concepto.replace(/\s+(gener|febrer|març|abril|maig|juny|juliol|agost|setembre|octubre|novembre|desembre|\d+T|\d{4}).*$/i, '').trim() || 'Otros'; m[k] = (m[k] || 0) + (Number(g.importe) || 0); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const vs = L.vs;
  const derramas = d.derramas.filter(x => x.comunidadId === c.id).map(der => {
    const cob = d.cobros.filter(q => q.derramaId === der.id), pag = d.gastos.filter(g => g.derramaId === der.id && g.estado !== 'pendiente');
    const cobrado = cob.reduce((a, q) => a + (Number(q.importe) || 0), 0), pagado = pag.reduce((a, g) => a + (Number(g.importe) || 0), 0);
    const pendientes = vs.map(v => ({ v, falta: r2(parteDerrama(der, v, vs) - cob.filter(q => q.vecinoId === v.id).reduce((a, q) => a + (Number(q.importe) || 0), 0)) })).filter(x => x.falta > 0.1);
    const activa = [...cob, ...pag].some(x => (x.fecha || '').startsWith(String(y))) || (der.plazos || []).some(pl => (pl.mes || '').startsWith(String(y)));
    return { der, cobrado: r2(cobrado), pagado: r2(pagado), saldo: r2(cobrado - pagado), pendientes, activa };
  }).filter(x => x.activa);
  const deudores = L.filas.filter(f => f.pendiente > 0.1);
  return { L, ant, ingresos: r2(ingresos), gastos: r2(gastos), final: r2(final), fondo, disponible: r2(final - fondo), igu: porPartida('iguales'), coe: porPartida('coef'), derramas, deudores };
}

const TX = {
  es: { tit: (y) => `Liquidación del ejercicio ${y}`, ant: (y) => `Saldo a 31/12/${y}`, ing: 'Ingresos del ejercicio', cuotas: 'Cuotas', derr: 'Derramas', otros: 'Otros ingresos', gas: 'Gastos del ejercicio', fin: (y) => `Saldo a 31/12/${y}`, finHoy: 'Saldo a fecha de hoy',
    fondo: 'Fondo de reserva (no disponible)', disp: 'Saldo disponible', pos: 'La comunidad cierra el ejercicio en positivo.', neg: 'La comunidad cierra el ejercicio en negativo.', dist: 'Distribución de los gastos',
    igu: (n) => `Gastos a partes iguales (entre ${n} pisos)`, coe: 'Gastos por coeficiente', obra: 'Obras y derramas', aprob: 'Aprobada', cobr: 'Cobrado', pago: 'Pagado de la obra', saldoObra: 'Saldo de la obra',
    pend: 'Cuotas y derramas pendientes de pago', nadie: 'Todos los propietarios están al corriente de pago.', reparto: 'Reparto por propietario', piso: 'Piso', prop: 'Propietario', coef: 'Coef.', pIg: 'Parte iguales', pCo: 'Parte coeficiente', tot: 'Total', importe: 'Importe', detalle: 'Detalle',
    firma: 'El Administrador', vb: 'Vº Bº El/La Presidente/a', saldoDer: 'saldo de la derrama' },
  ca: { tit: (y) => `Liquidació de l'exercici ${y}`, ant: (y) => `Saldo a 31/12/${y}`, ing: "Ingressos de l'exercici", cuotas: 'Quotes', derr: 'Derrames', otros: 'Altres ingressos', gas: "Despeses de l'exercici", fin: (y) => `Saldo a 31/12/${y}`, finHoy: "Saldo a data d'avui",
    fondo: 'Fons de reserva (no disponible)', disp: 'Saldo disponible', pos: "La comunitat tanca l'exercici en positiu.", neg: "La comunitat tanca l'exercici en negatiu.", dist: 'Distribució de les despeses',
    igu: (n) => `Despeses a parts iguals (entre ${n} pisos)`, coe: 'Despeses per coeficient', obra: 'Obres i derrames', aprob: 'Aprovada', cobr: 'Cobrat', pago: "Pagat de l'obra", saldoObra: "Saldo de l'obra",
    pend: 'Quotes i derrames pendents de pagament', nadie: 'Tots els propietaris estan al corrent de pagament.', reparto: 'Repartiment per propietari', piso: 'Pis', prop: 'Propietari', coef: 'Coef.', pIg: 'Part iguals', pCo: 'Part coeficient', tot: 'Total', importe: 'Import', detalle: 'Detall',
    firma: "L'Administrador", vb: 'Vist i plau El/La President/a', saldoDer: 'saldo de la derrama' },
};
const detalleDeuda = (c, v, d, l) => deudaVecino(c, v, d).det.map(z => z.tipo === 'cuota' ? MES3[l][z.m - 1] + ' ' + String(z.y).slice(2) : z.tipo === 'saldo' ? (l === 'ca' ? 'saldo anterior' : 'saldo anterior') : (l === 'ca' ? 'derrama' : 'derrama')).filter((x, i, a) => a.indexOf(x) === i).join(', ');

// El documento (igual para todos)
function documento(c, d, l, D) {
  const t = TX[l], L = D.L, y = L.y, cab = cabeceraCom(c, l), ad = d.aj?.admin || {};
  const fila = (k, v, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${k}</td><td class="r">${v}</td></tr>`;
  const nota = c.liqNotas?.[y]?.[l];
  return `<section class="hoja liqdoc" style="font-size:9pt"><header class="cab"><div class="com">${cab.izq}</div><div class="dat">${cab.der}</div></header>
    <h1 style="margin-top:5mm">${t.tit(y)}</h1><p class="peq" style="margin-top:-2mm">${esc(lugarFechaCom(c, hoyISO(), l))}</p>
    <table class="tabla" style="font-size:9.5pt"><tbody>
      ${fila(t.ant(y - 1), eur(D.ant.importe))}
      ${fila('+ ' + t.ing, eur(D.ingresos))}${fila('&nbsp;&nbsp;&nbsp;' + t.cuotas, eur(L.I.cuotas), 'sub')}${L.I.derramas ? fila('&nbsp;&nbsp;&nbsp;' + t.derr, eur(L.I.derramas), 'sub') : ''}${L.I.otros ? fila('&nbsp;&nbsp;&nbsp;' + t.otros, eur(L.I.otros), 'sub') : ''}
      ${fila('− ' + t.gas, eur(D.gastos))}
      ${fila(L.cerrado ? t.fin(y) : t.finHoy, eur(D.final), 'tot')}
      ${D.fondo ? fila(t.fondo, eur(D.fondo)) + fila(t.disp, eur(D.disponible), 'tot') : ''}</tbody></table>
    <p class="aviso" style="${D.disponible >= 0 ? 'border-color:#9ccfae;background:#eef7f0' : ''}"><b>${D.disponible >= 0 ? t.pos : t.neg}</b></p>
    <h2>${t.dist}</h2>
    <div style="display:flex;gap:6mm;align-items:flex-start"><table class="tabla" style="flex:1"><thead><tr><th>${t.igu(L.vs.length)}</th><th class="r">${t.importe}</th></tr></thead><tbody>${D.igu.map(([k, v]) => fila(esc(k), eur(v))).join('')}${fila(t.tot, eur(L.G.iguales), 'tot')}</tbody></table>
      <table class="tabla" style="flex:1"><thead><tr><th>${t.coe}</th><th class="r">${t.importe}</th></tr></thead><tbody>${D.coe.map(([k, v]) => fila(esc(k), eur(v))).join('')}${fila(t.tot, eur(L.G.coef), 'tot')}</tbody></table></div>
    ${D.derramas.length ? `<h2>${t.obra}</h2><table class="tabla"><thead><tr><th></th><th class="r">${t.aprob}</th><th class="r">${t.cobr}</th><th class="r">${t.pago}</th><th class="r">${t.saldoObra}</th></tr></thead><tbody>
      ${D.derramas.map(x => `<tr><td>${esc(x.der.concepto)}</td><td class="r">${eur(x.der.total)}</td><td class="r">${eur(x.cobrado)}</td><td class="r">${eur(x.pagado)}</td><td class="r">${eur(x.saldo)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>${t.pend}</h2>
    ${D.deudores.length ? `<table class="tabla"><thead><tr><th>${t.piso}</th><th>${t.prop}</th><th>${t.detalle}</th><th class="r">${t.importe}</th></tr></thead><tbody>
      ${D.deudores.map(f => `<tr><td>${esc(f.v.piso)}</td><td>${esc(f.v.propietario)}</td><td>${esc(detalleDeuda(c, f.v, d, l))}</td><td class="r">${eur(f.pendiente)}</td></tr>`).join('')}${fila(`<b>${t.tot}</b>`, '', '')}</tbody></table>`.replace(`<tr><td><b>${t.tot}</b></td><td class="r"></td></tr>`, `<tr class="tot"><td colspan="3">${t.tot}</td><td class="r">${eur(L.tot('pendiente'))}</td></tr>`) : `<p>${t.nadie}</p>`}
    <h2>${t.reparto}</h2>
    <table class="tabla" style="font-size:8pt"><thead><tr><th>${t.piso}</th><th>${t.prop}</th><th class="r">${t.coef}</th><th class="r">${t.pIg}</th><th class="r">${t.pCo}</th><th class="r">${t.tot}</th></tr></thead><tbody>
      ${L.filas.map(f => `<tr><td>${esc(f.v.piso)}</td><td>${esc(f.v.propietario)}</td><td class="r">${coefTxt(f.v.coef)}</td><td class="r">${eur(f.gIg)}</td><td class="r">${eur(f.gCoef)}</td><td class="r">${eur(f.asignado)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="3">${t.tot}</td><td class="r">${eur(L.tot('gIg'))}</td><td class="r">${eur(L.tot('gCoef'))}</td><td class="r">${eur(L.tot('asignado'))}</td></tr></tbody></table>
    ${nota ? `<p>${esc(nota)}</p>` : ''}
    <div class="firmas"><div>${t.firma}<div class="esp"></div>${esc(ad.nombre || '')}</div><div>${t.vb}<div class="esp"></div>${esc(c.presidente || '')}</div></div>
  </section>`;
}

export function tabLiquidacion(c, d) {
  const D = datos(c, d, st.anio), L = D.L, y0 = new Date().getFullYear(), l = st.idioma(c);
  const nota = c.liqNotas?.[st.anio] || {};
  return `<div class="head" style="align-items:center"><div><h2>Liquidación del ejercicio ${st.anio}</h2><div class="small muted">${L.cerrado ? 'Ejercicio cerrado' : 'Ejercicio en curso: datos hasta hoy'}. Un único documento, igual para todos los vecinos.</div></div>
    <div class="actions"><label class="sr" for="anioLiq">Año</label><select id="anioLiq" class="inp" style="width:auto">${[y0, y0 - 1, y0 - 2, y0 - 3].map(y => `<option ${y === st.anio ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <label class="sr" for="idiomaLiq">Idioma</label><select id="idiomaLiq" class="inp" style="width:auto">${[['ca', 'Català'], ['es', 'Castellano']].map(([k, n]) => `<option value="${k}" ${k === l ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn" data-l="csv">Exportar</button><button class="btn primary" data-l="pdf">PDF de la liquidación</button></div></div>
  <section class="kpis">
    <div class="card kpi"><div class="l">Saldo a 31/12/${st.anio - 1}</div><div class="v num">${eur(D.ant.importe)}</div><div class="s">${D.ant.origen === 'manual' ? 'Anotado a mano' : D.ant.origen === 'sin dato' ? 'Sin dato: anótalo abajo' : 'Del ' + D.ant.origen}</div></div>
    <div class="card kpi"><div class="l">+ Ingresos</div><div class="v num ing">${eur(D.ingresos)}</div><div class="s">Cuotas ${eur(L.I.cuotas, 0)}${L.I.derramas ? ' · derramas ' + eur(L.I.derramas, 0) : ''}</div></div>
    <div class="card kpi"><div class="l">− Gastos</div><div class="v num gas">${eur(D.gastos)}</div><div class="s">Iguales ${eur(L.G.iguales, 0)} · coef. ${eur(L.G.coef, 0)}${L.G.derrama ? ' · obras ' + eur(L.G.derrama, 0) : ''}</div></div>
    <div class="card kpi"><div class="l">= ${L.cerrado ? 'Saldo a 31/12/' + st.anio : 'Saldo a hoy'}</div><div class="v num ${D.disponible < 0 ? 'neg' : ''}">${eur(D.final)}</div><div class="s">${D.fondo ? 'Fondo de reserva ' + eur(D.fondo, 0) + ' · disponible ' + eur(D.disponible, 0) : (D.final >= 0 ? 'En positivo' : 'En negativo')}</div></div>
  </section>
  <div class="row">
    <section class="card grow1"><div class="cardhead"><h2>Gastos a partes iguales</h2><span class="small muted">entre ${L.vs.length} pisos</span></div><div class="tw"><table><tbody>${D.igu.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${eur(v)}</td></tr>`).join('') || '<tr><td class="muted">Ninguno</td></tr>'}<tr class="tot"><td>Total</td><td class="r num">${eur(L.G.iguales)}</td></tr></tbody></table></div></section>
    <section class="card grow1"><div class="cardhead"><h2>Gastos por coeficiente</h2></div><div class="tw"><table><tbody>${D.coe.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${eur(v)}</td></tr>`).join('') || '<tr><td class="muted">Ninguno</td></tr>'}<tr class="tot"><td>Total</td><td class="r num">${eur(L.G.coef)}</td></tr></tbody></table></div></section>
  </div>
  ${D.derramas.length ? `<section class="card"><div class="cardhead"><h2>Obras y derramas</h2></div><div class="tw"><table><thead><tr><th>Derrama</th><th class="r">Aprobada</th><th class="r">Cobrado</th><th class="r">Pagado de la obra</th><th class="r">Saldo de la obra</th><th>Pendiente de cobrar</th></tr></thead><tbody>
    ${D.derramas.map(x => `<tr><td class="b">${esc(x.der.concepto)}</td><td class="r num">${eur(x.der.total)}</td><td class="r num">${eur(x.cobrado)}</td><td class="r num">${eur(x.pagado)}</td><td class="r num b ${x.saldo < 0 ? 'neg' : ''}">${eur(x.saldo)}</td><td class="small">${x.pendientes.map(p => `${esc(p.v.piso)} ${eur(p.falta)}`).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <div class="row">
    <section class="card grow2"><div class="cardhead"><div><h2>Pendiente de pago</h2><div class="small muted">Quién debe cuotas o derramas al cierre</div></div></div><div class="tw"><table><thead><tr><th>Piso</th><th>Propietario</th><th>Detalle</th><th class="r">Importe</th></tr></thead><tbody>
      ${D.deudores.map(f => `<tr><td class="b">${esc(f.v.piso)}</td><td>${esc(f.v.propietario)}</td><td class="small">${esc(detalleDeuda(c, f.v, d, 'es'))}</td><td class="r num b neg">${eur(f.pendiente)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Todos al corriente</td></tr>'}
      ${D.deudores.length ? `<tr class="tot"><td colspan="3">Total</td><td class="r num">${eur(L.tot('pendiente'))}</td></tr>` : ''}</tbody></table></div></section>
    <section class="card pad stack grow1"><h2>Ajustes de esta liquidación</h2>
      <label class="field">Saldo a 31/12/${st.anio - 1} (€)<input id="saldoAnt" class="num" inputmode="decimal" value="${c.liqSaldos?.[st.anio] != null ? String(c.liqSaldos[st.anio]).replace('.', ',') : ''}" placeholder="${String(D.ant.importe.toFixed(2)).replace('.', ',')}"><span class="hint">Vacío: se usa el último saldo del banco anotado hasta esa fecha</span></label>
      <label class="field">Comentario (castellano)<textarea id="notaEs" rows="2">${esc(nota.es || '')}</textarea></label><label class="field">Comentario (català)<textarea id="notaCa" rows="2">${esc(nota.ca || '')}</textarea></label>
      <button class="btn sm" data-l="guardar" style="align-self:flex-start">Guardar</button></section>
  </div>
  <section class="card"><div class="cardhead"><div><h2>Reparto de los gastos por propietario</h2><div class="small muted">Iguales ÷ ${L.vs.length} pisos · coeficiente × gastos por coeficiente</div></div></div>
    <div class="tw"><table class="liq"><thead><tr><th>Piso</th><th>Propietario</th><th class="r">Coef.</th><th class="r">Parte iguales</th><th class="r">Parte coeficiente</th><th class="r">Total</th><th class="r">Cuotas pagadas</th></tr></thead><tbody>
    ${L.filas.map(f => `<tr><td class="b">${esc(f.v.piso)}</td><td>${esc(f.v.propietario)}</td><td class="r num">${coefTxt(f.v.coef)}</td><td class="r num">${eur(f.gIg)}</td><td class="r num">${eur(f.gCoef)}</td><td class="r num b">${eur(f.asignado)}</td><td class="r num">${eur(f.cob)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">Total</td><td class="r num">${eur(L.tot('gIg'))}</td><td class="r num">${eur(L.tot('gCoef'))}</td><td class="r num">${eur(L.tot('asignado'))}</td><td class="r num">${eur(L.tot('cob'))}</td></tr></tbody></table></div></section>`;
}

export function bindLiquidacion(el, c, d, refresh) {
  const s = el.querySelector('#anioLiq'); if (s) s.onchange = () => { st.anio = Number(s.value); refresh(); };
  const il = el.querySelector('#idiomaLiq'); if (il) il.onchange = () => { st.lang = il.value; };
  el.querySelector('[data-l=pdf]').onclick = () => { const D = datos(c, d, st.anio); if (!abrirImpresion(`Liquidación ${c.nombre} ${st.anio}`, [documento(c, d, st.idioma(c), D)])) toast('Permite las ventanas emergentes para esta página'); };
  el.querySelector('[data-l=guardar]').onclick = async () => {
    const v = el.querySelector('#saldoAnt').value.trim(); const n = v ? Number(v.replace(/\./g, '').replace(',', '.')) : null;
    const liqSaldos = { ...(c.liqSaldos || {}) }; if (n == null || isNaN(n)) delete liqSaldos[st.anio]; else liqSaldos[st.anio] = n;
    const liqNotas = { ...(c.liqNotas || {}), [st.anio]: { es: el.querySelector('#notaEs').value.trim(), ca: el.querySelector('#notaCa').value.trim() } };
    await db.put('f_comunidades', { ...c, liqSaldos, liqNotas }); toast('Guardado'); refresh();
  };
  el.querySelector('[data-l=csv]').onclick = async () => {
    const D = datos(c, d, st.anio), L = D.L;
    const { csv, dec } = await import('../backup.js'); const { descargar } = await import('../ui.js');
    const rows = [[`Liquidación ${st.anio}`, c.nombre], [], ['Saldo anterior', dec(D.ant.importe)], ['Ingresos', dec(D.ingresos)], ['Gastos', dec(D.gastos)], ['Saldo final', dec(D.final)], ['Fondo de reserva', dec(D.fondo)], [],
      ['Piso', 'Propietario', 'Coeficiente', 'Parte iguales', 'Parte coeficiente', 'Total', 'Cuotas pagadas', 'Pendiente'], ...L.filas.map(f => [f.v.piso, f.v.propietario, dec(f.v.coef), dec(f.gIg), dec(f.gCoef), dec(f.asignado), dec(f.cob), dec(f.pendiente)])];
    descargar(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), `liquidacion_${c.nombre.replace(/\W+/g, '_')}_${st.anio}.csv`); toast('Archivo descargado');
  };
}
