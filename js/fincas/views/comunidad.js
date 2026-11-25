import { db } from '../../db.js';
import { esc, eur, num, fmtNum, modal, confirmar, field, select, textarea, money, fd, toast, fecha, fechaCorta, hoyISO, MESES, MES3 } from '../../ui.js';
import { vecinosDe, estadoCuota, cuotaEn, deudaVecino, parteDerrama, cobradoDerrama, balanceComunidad, tocaCobrar, GRUPOS, grupoTxt, sumaCoef, coefTxt } from '../calc.js';
import { formComunidad, darDeBaja } from './comunidades.js';
import { renderVecino, bindVecino } from './vecino.js';
import { tabCartas, bindTabCartas, renderRedactar, bindRedactar } from '../cartasFin.js';
import { formProveedor } from './proveedores.js';
import { ordenPorDefecto, paginaConvocatoria, abrirImpresion, textoEmail, deudoresDe, fechaLarga } from '../docs.js';

const TABS = [['vecinos', 'Vecinos'], ['cuotas', 'Cuotas'], ['balance', 'Balance'], ['gastos', 'Gastos'], ['presupuesto', 'Presupuesto'], ['derramas', 'Derramas'], ['juntas', 'Juntas'], ['cartas', 'Cartas'], ['datos', 'Datos de la comunidad']];
const st = { anio: new Date().getFullYear(), movF: 'todos', movM: 0, der: null, junta: null };

// Saldo del banco: el último que se anotó (a mano o, más adelante, por conciliación)
export const saldoBanco = (c) => (c.saldosBanco || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null;
// Presupuesto del año por partidas (o el total antiguo si no hay partidas)
export const presupuestoAnio = (c, y) => (c.presupuestos || {})[y] || [];
export const totalPresupuesto = (c, y) => { const p = presupuestoAnio(c, y); return p.length ? p.reduce((a, x) => a + Number(x.importe || 0), 0) : Number(c.presupuesto) || 0; };

export async function render([id, tab = 'vecinos', sub, extra], d) {
  const c = d.coms.find(x => x.id === id);
  if (!c) return `<div class="page"><a class="back" href="#/fincas">← Comunidades</a><div class="card empty"><h2>No se encuentra la comunidad</h2></div></div>`;
  if (tab === 'vecino') return renderVecino(c, sub, d);
  if (tab === 'carta') return renderRedactar(c, sub, extra, d);
  const vs = vecinosDe(d, c.id);
  const deudas = Object.fromEntries(vs.map(v => [v.id, deudaVecino(c, v, d)]));
  const pend = Object.values(deudas).reduce((a, x) => a + x.total, 0);
  const morosos = Object.values(deudas).filter(x => x.total > 0.1).length;
  const bal = balanceComunidad(c, d, st.anio);
  const ctx = { c, vs, deudas, pend, morosos, bal, d };
  const body = { vecinos, cuotas, balance, gastos, presupuesto, derramas, juntas, cartas: ({ c, d }) => tabCartas(c, d), datos }[tab] || vecinos;
  return `<div class="page">
  <a class="back" href="#/fincas">← Comunidades</a>
  <div class="head"><div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1>${esc(c.nombre)}</h1><span class="badge ${c.archivada ? 'neutral' : morosos ? 'bad' : 'ok'}">${c.archivada ? 'Archivada' : morosos ? morosos + (morosos === 1 ? ' con pendiente' : ' con pendiente') : 'Todos al corriente'}</span></div>
    <div class="sub">${esc([c.localidad, vs.length + ' pisos y locales', c.cif ? 'CIF ' + c.cif : '', c.presidente ? 'Presidencia: ' + c.presidente : ''].filter(Boolean).join(' · '))}</div></div>
    <div class="actions"><button class="btn" data-a="editCom">Editar comunidad</button><button class="btn" data-a="gasto">+ Gasto</button><button class="btn primary" data-a="cobro">+ Cobro</button></div></div>
  <section class="kpis" aria-label="Datos clave">
    ${(() => { const sb = saldoBanco(c); return `<div class="card kpi"><div class="l">Saldo según banco</div><div class="v num">${sb ? eur(sb.importe) : '—'}</div><div class="s">${sb ? 'A ' + fecha(sb.fecha) + (sb.origen ? ' · ' + esc(sb.origen) : '') : 'Sin anotar'} · <button class="linkbtn" data-a="saldo">Actualizar</button></div></div>`; })()}
    <div class="card kpi"><div class="l">Pendiente de cobro</div><div class="v num ${pend > 0.1 ? 'neg' : ''}">${eur(pend)}</div><div class="s">${vs.length - morosos} de ${vs.length} al corriente</div></div>
    <div class="card kpi"><div class="l">Cuotas al mes</div><div class="v num">${eur(vs.reduce((a, v) => a + cuotaEn(v, new Date().getFullYear(), new Date().getMonth() + 1), 0))}</div><div class="s">${c.periodicidad === 'trimestral' ? 'Se cobran por trimestre' : 'Se cobran cada mes'}</div></div>
    <div class="card kpi"><div class="l">Fondo de reserva</div><div class="v num">${eur(c.fondoReserva || 0)}</div><div class="s">${totalPresupuesto(c, new Date().getFullYear()) ? 'Presupuesto ' + eur(totalPresupuesto(c, new Date().getFullYear()), 0) + '/año' : '&nbsp;'}</div></div>
  </section>
  <nav class="tabs" aria-label="Secciones">${TABS.map(([k, l]) => `<a href="#/finca/${c.id}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  ${body(ctx)}
  </div>`;
}

const yearSel = () => { const y0 = new Date().getFullYear(); return `<label class="sr" for="anio">Año</label><select id="anio" class="inp" style="width:auto">${[y0 + 1, y0, y0 - 1, y0 - 2, y0 - 3].map(y => `<option ${y === st.anio ? 'selected' : ''}>${y}</option>`).join('')}</select>`; };
const resDeuda = (x) => x.det.length <= 3 ? x.det.map(z => z.tipo === 'cuota' ? MES3[z.m - 1] + ' ' + String(z.y).slice(2) : z.tipo === 'saldo' ? 'saldo anterior' : `derrama (plazo ${z.plazo})`).join(', ') : `${x.det.length} recibos`;

function vecinos({ c, vs, deudas }) {
  const sc = sumaCoef(vs);
  return `<section class="card"><div class="cardhead"><div><h2>Propietarios por piso</h2><div class="small muted">Pulsa en un piso para ver o editar su ficha.</div></div>
    <div class="actions"><a class="btn primary sm" href="#/finca/${c.id}/vecino/nuevo">+ Vecino</a></div></div>
    ${vs.length && Math.abs(sc - 100) > 0.01 ? `<div style="padding:0 20px 10px"><div class="strip warn"><div class="small">Los coeficientes suman <b>${coefTxt(sc)} %</b>. Lo normal es 100 %. Revísalos si no es lo que pone en la escritura.</div></div></div>` : ''}
    <div class="tw"><table style="min-width:760px"><thead><tr><th>Piso</th><th>Propietario</th><th>Ocupante</th><th class="r">Coef. %</th><th class="r">Cuota</th><th>Pago</th><th>Situación</th></tr></thead><tbody>
    ${vs.map(v => { const dd = deudas[v.id]; return `<tr><td class="b nw"><a class="linkbtn" style="font-size:14px" href="#/finca/${c.id}/vecino/${v.id}">${esc(v.piso)}</a></td><td>${esc(v.propietario)}${v.telefono ? `<div class="small muted">${esc(v.telefono)}</div>` : ''}</td><td class="small">${esc(v.ocupante) || '—'}</td>
      <td class="r num">${coefTxt(v.coef)}</td><td class="r num nw">${eur(cuotaEn(v, new Date().getFullYear(), new Date().getMonth() + 1))}</td><td class="small">${esc(v.formaPago || '—')}</td>
      <td>${dd.total > 0.1 ? `<span class="badge bad" title="${esc(resDeuda(dd))}">Pendiente ${eur(dd.total)}</span>` : '<span class="badge ok">Al corriente</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Aún no hay vecinos. Añádelos con «+ Vecino».</td></tr>'}
    ${vs.length ? `<tr class="tot"><td>Total</td><td></td><td></td><td class="r num">${coefTxt(sc)}</td><td class="r num nw">${eur(vs.reduce((a, v) => a + cuotaEn(v, new Date().getFullYear(), new Date().getMonth() + 1), 0))}</td><td></td><td></td></tr>` : ''}
    </tbody></table></div></section>`;
}

function cuotas({ c, vs, deudas, d }) {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  let nCorr = 0, tot = 0;
  const filas = vs.map(v => {
    const dd = deudas[v.id]; tot += dd.total; if (dd.total <= 0.1) nCorr++;
    const celdas = meses.map(m => {
      const e = estadoCuota(c, v, d.cobros, st.anio, m);
      const ult = e.cob.lista.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
      if (e.estado === 'na' || (e.estado === 'previo' && !e.pag)) return `<td class="c" style="padding:4px 2px"><div class="cell na" title="${e.estado === 'previo' ? 'Anterior al control de cuotas' : 'No se cobra este mes'}"></div></td>`;
      const cls = { pagado: 'paid', parcial: 'part', debe: 'due', futuro: '', pendiente: '' }[e.estado] ?? '';
      const txt = e.pag ? fmtNum(e.pag) : (e.estado === 'futuro' || e.estado === 'pendiente' ? '—' : '');
      const sub = e.pag && ult ? fechaCorta(ult.fecha) : '';
      const tip = `${MESES[m - 1]}: ${e.pag ? 'pagado ' + eur(e.pag) + (ult ? ' el ' + fecha(ult.fecha) : '') : 'sin pagar'}${e.esp ? ' · cuota ' + eur(e.esp) : ''}`;
      return `<td class="c" style="padding:4px 2px"><button type="button" class="cell ${cls}" style="min-width:58px" data-celda="${v.id}|${m}" title="${tip}" aria-label="${esc(v.piso)} ${tip}"><span class="num">${txt}</span><small>${sub}</small></button></td>`;
    }).join('');
    return `<tr><td class="b nw" style="padding:6px 10px">${esc(v.piso)}<div class="small muted" style="font-weight:400;max-width:150px;overflow:hidden;text-overflow:ellipsis">${esc(v.propietario)}</div></td>${celdas}
      <td class="r num nw b ${dd.total > 0.1 ? 'neg' : 'muted'}" style="padding:6px 10px">${dd.total > 0.1 ? eur(dd.total) : '—'}</td><td style="padding:6px 10px"><span class="badge ${dd.total > 0.1 ? 'bad' : 'ok'}">${dd.total > 0.1 ? 'Pendiente' : 'Al corriente'}</span></td></tr>`;
  }).join('');
  return `<section class="card"><div class="cardhead"><div><h2>Cuotas ${st.anio}</h2><div class="small muted">${nCorr} de ${vs.length} al corriente · pendiente total ${eur(tot)} (incluye derramas)</div></div>
    <div class="actions">${yearSel()}<button class="btn sm" data-a="masivo">Cobrar un mes a varios</button><button class="btn sm" data-a="csvCuotas">Exportar</button></div></div>
    <div class="tw"><table style="min-width:1100px"><thead><tr><th>Piso</th>${MES3.map(m => `<th class="c" style="padding:8px 2px">${m}</th>`).join('')}<th class="r">Pendiente</th><th>Situación</th></tr></thead><tbody>${filas || '<tr><td colspan="15" class="muted">Sin vecinos</td></tr>'}</tbody></table></div>
    <div class="cardfoot legend"><span><i style="background:#EEF7F0;border-color:#CFE6D5"></i>Pagado: importe y fecha</span><span><i style="background:#fff;border:2px solid #E0B4AF"></i>Vacía: no ha pagado</span><span><i style="background:var(--warn-bg)"></i>Pago parcial</span><span><i style="background:#F7F6F2"></i>— Aún no vence</span><span>Pulsa una casilla para registrar, ver o borrar cobros</span></div></section>`;
}

function movimientos(c, d) {
  const vn = (id) => d.vecinos.find(v => v.id === id);
  const M = [];
  d.cobros.filter(x => x.comunidadId === c.id && x.fecha).forEach(x => { const v = vn(x.vecinoId); const der = x.derramaId ? d.derramas.find(z => z.id === x.derramaId) : null;
    M.push({ t: 'cobro', id: x.id, f: x.fecha, c: `${v ? v.piso : ''} · ${x.concepto === 'cuota' ? 'Cuota ' + MESES[x.mes - 1].toLowerCase() + ' ' + x.anio : x.concepto === 'derrama' ? (der ? der.concepto : 'Derrama') : (x.nota || 'Otro ingreso')}`, cat: x.concepto === 'cuota' ? 'Cuota' : x.concepto === 'derrama' ? 'Derrama' : 'Ingreso', cls: 'ok', v: Number(x.importe) || 0 }); });
  d.gastos.filter(x => x.comunidadId === c.id && x.fecha && x.estado !== 'pendiente').forEach(x => M.push({ t: 'gasto', id: x.id, f: x.fecha, c: x.concepto, cat: grupoTxt(x.grupo), cls: x.grupo === 'derrama' ? 'info' : 'neutral', v: -(Number(x.importe) || 0) }));
  return M.sort((a, b) => (a.f < b.f ? -1 : 1));
}

function balance({ c, bal, d }) {
  const max = Math.max(1, ...bal.meses.map(m => Math.max(m.ing, m.gas)));
  const filas = bal.meses.map((m, i) => `<tr><td class="b">${MESES[i]}</td><td class="r num ing b">${m.ing ? eur(m.ing) : '—'}</td><td class="r num gas">${m.gas ? eur(m.gas) : '—'}</td><td class="r num b ${m.ing - m.gas < 0 ? 'neg' : ''}">${eur(m.ing - m.gas)}</td>
    <td style="width:220px"><div class="bars"><span style="width:${m.ing / max * 100}%;background:var(--ing)"></span><span style="width:${Math.max(m.gas ? 2 : 0, m.gas / max * 100)}%;background:var(--gas)"></span></div></td></tr>`).join('');
  const ini = `${st.anio}-01-01`, fin = `${st.anio}-12-31`;
  const M = movimientos(c, d).filter(m => m.f >= ini && m.f <= fin);
  const vis = M.filter(m => (st.movF === 'todos' || (st.movF === 'ing' ? m.v > 0 : m.v < 0)) && (!st.movM || Number(m.f.slice(5, 7)) === st.movM)).reverse();
  const sb = saldoBanco(c);
  const hist = (c.saldosBanco || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return `<section class="card"><div class="cardhead"><div><h2>Balance ${st.anio} · cobros y pagos por mes</h2><div class="small muted">Saldo según banco: <b class="num">${sb ? eur(sb.importe) + '</b> a ' + fecha(sb.fecha) : 'sin anotar</b>'} · <button class="linkbtn" data-a="saldo">Actualizar saldo</button></div></div>
    <div class="actions"><button class="btn sm" data-a="cobro">+ Ingreso</button><button class="btn sm" data-a="gasto">+ Gasto</button><span class="btn sm" title="Próximamente" style="opacity:.5;cursor:default">Conciliar con el banco</span>${yearSel()}</div></div>
    <div class="tw"><table style="min-width:640px"><thead><tr><th>Mes</th><th class="r">Cobros</th><th class="r">Pagos</th><th class="r">Resultado</th><th>Cobros / pagos</th></tr></thead>
    <tbody>${filas}<tr class="tot"><td>Total ${st.anio}</td><td class="r num ing">${eur(bal.ing)}</td><td class="r num gas">${eur(bal.gas)}</td><td class="r num">${eur(bal.ing - bal.gas)}</td><td></td></tr></tbody></table></div></section>
  <section class="card"><div class="cardhead"><div><h2>Libro de movimientos</h2><div class="small muted">Del más reciente al más antiguo.</div></div>
    <div class="actions"><label class="sr" for="movM">Mes</label><select id="movM" class="inp" style="width:auto"><option value="0">Todos los meses</option>${MESES.map((x, i) => `<option value="${i + 1}" ${st.movM === i + 1 ? 'selected' : ''}>${x}</option>`).join('')}</select><div class="chips">${[['todos', 'Todos'], ['ing', 'Cobros'], ['gas', 'Pagos']].map(([k, l]) => `<button class="chip ${st.movF === k ? 'on' : ''}" data-mf="${k}" aria-pressed="${st.movF === k}">${l}</button>`).join('')}</div></div></div>
    <div class="tw"><table style="min-width:700px"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="r">Cobro</th><th class="r">Pago</th><th></th></tr></thead><tbody>
    ${vis.slice(0, 300).map(m => `<tr><td class="nw num">${fecha(m.f)}</td><td class="b">${esc(m.c)}</td><td><span class="badge ${m.cls}">${esc(m.cat)}</span></td><td class="r num ing b">${m.v > 0 ? eur(m.v) : ''}</td><td class="r num gas b">${m.v < 0 ? eur(-m.v) : ''}</td><td><button class="btn sm" data-edit="${m.t}:${m.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin movimientos este año</td></tr>'}
    </tbody></table></div></section>
  ${hist.length ? `<section class="card"><div class="cardhead"><h2>Saldos anotados del banco</h2></div><div class="tw"><table><thead><tr><th>Fecha</th><th class="r">Saldo</th><th>Origen</th><th>Nota</th><th></th></tr></thead><tbody>
    ${hist.map((h, i) => `<tr><td class="num">${fecha(h.fecha)}</td><td class="r num b">${eur(h.importe)}</td><td class="small">${esc(h.origen || 'Manual')}</td><td class="small muted">${esc(h.nota || '')}</td><td><button class="btn sm danger" data-delsaldo="${i}">Borrar</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}

function gastos({ c, d }) {
  const g = d.gastos.filter(x => x.comunidadId === c.id && x.fecha && Number(x.fecha.slice(0, 4)) === st.anio).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const porG = Object.fromEntries(GRUPOS.map(([k]) => [k, g.filter(x => (x.grupo || 'coef') === k).reduce((a, x) => a + Number(x.importe || 0), 0)]));
  return `<section class="kpis">${GRUPOS.map(([k, l]) => `<div class="card kpi"><div class="l">${l}</div><div class="v num" style="font-size:22px">${eur(porG[k])}</div></div>`).join('')}</section>
  <section class="card"><div class="cardhead"><h2>Gastos ${st.anio}</h2><div class="actions">${yearSel()}<button class="btn primary" data-a="gasto">+ Añadir gasto</button></div></div>
    <div class="tw"><table style="min-width:760px"><thead><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Reparto / partida</th><th class="r">Importe</th><th>Estado</th><th></th></tr></thead><tbody>
    ${g.map(x => `<tr><td class="nw num">${fecha(x.fecha)}</td><td class="b">${esc(x.concepto)}${x.nota ? `<div class="small muted" style="font-weight:400">${esc(x.nota)}</div>` : ''}</td><td class="muted">${esc((x.proveedorId && d.proveedores.find(p => p.id === x.proveedorId)?.nombre) || x.proveedor) || '—'}</td><td><span class="badge ${x.grupo === 'derrama' ? 'info' : 'neutral'}">${esc(grupoTxt(x.grupo))}</span>${x.partida ? `<div class="small muted">${esc(x.partida)}</div>` : ''}</td>
      <td class="r num b ${Number(x.importe) < 0 ? 'ing' : ''}">${eur(x.importe)}</td><td>${x.estado === 'pendiente' ? `<button class="badge warn" style="border:0;cursor:pointer" data-pagar="${x.id}">Pendiente · marcar pagado</button>` : '<span class="badge ok">Pagado</span>'}</td><td><button class="btn sm" data-edit="gasto:${x.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin gastos este año</td></tr>'}
    </tbody></table></div><div class="cardfoot">Los importes negativos (por ejemplo, un reintegro del seguro) restan del total.</div></section>`;
}

function derramas({ c, vs, d }) {
  const ds = d.derramas.filter(x => x.comunidadId === c.id).sort((a, b) => ((a.plazos?.[0]?.mes || '') < (b.plazos?.[0]?.mes || '') ? 1 : -1));
  if (!st.der || !ds.find(x => x.id === st.der)) st.der = ds[0]?.id || null;
  const sel = ds.find(x => x.id === st.der);
  const resumenDer = (x) => { const cob = d.cobros.filter(q => q.derramaId === x.id).reduce((a, q) => a + Number(q.importe || 0), 0); return { cob, pct: x.total ? Math.min(100, cob / x.total * 100) : 0 }; };
  let detalle = '';
  if (sel) {
    const n = (sel.plazos || []).length || 1;
    const filas = vs.map(v => {
      const parte = parteDerrama(sel, v, vs);
      let pend = 0;
      const celdas = (sel.plazos || [{}]).map((pl, i) => {
        const cb = cobradoDerrama(d.cobros, v.id, sel.id, i);
        const toca = parte / n, emit = !pl.mes || pl.mes <= hoyISO().slice(0, 7);
        const ult = cb.lista.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
        if (emit && cb.imp < toca - 0.1) pend += toca - cb.imp;
        const cls = cb.imp >= toca - 0.1 ? 'paid' : cb.imp > 0 ? 'part' : emit ? 'due' : '';
        return `<td class="c" style="padding:4px"><button type="button" class="cell ${cls}" style="min-width:84px" data-dcelda="${v.id}|${i}"><span class="num">${cb.imp ? fmtNum(cb.imp) : emit ? '' : '—'}</span><small>${cb.imp && ult ? fechaCorta(ult.fecha) : emit ? '' : 'no emitido'}</small></button></td>`;
      }).join('');
      return `<tr><td class="b nw">${esc(v.piso)}</td><td class="nw">${esc(v.propietario)}</td><td class="r num">${coefTxt(v.coef)}</td><td class="r num b nw">${eur(parte)}</td>${celdas}<td class="r num nw b ${pend > 0.1 ? 'neg' : 'muted'}">${pend > 0.1 ? eur(pend) : '—'}</td></tr>`;
    }).join('');
    const pagos = d.gastos.filter(g => g.derramaId === sel.id);
    const pagado = pagos.reduce((a, g) => a + Number(g.importe || 0), 0), pres = (sel.presupuesto || []).reduce((a, p) => a + Number(p.importe || 0), 0);
    detalle = `<div class="row">
      <section class="card grow2"><div class="cardhead"><div><h2>${esc(sel.concepto)}</h2><div class="small muted">${eur(sel.total)} · ${sel.reparto === 'iguales' ? 'a partes iguales' : 'por coeficiente'} · ${n} ${n === 1 ? 'plazo' : 'plazos'}${sel.fechaJunta ? ' · junta del ' + fecha(sel.fechaJunta) : ''}</div></div>
        <div class="actions"><button class="btn sm" data-a="editDer">Editar derrama</button></div></div>
        <div class="tw"><table style="min-width:640px"><thead><tr><th>Piso</th><th>Propietario</th><th class="r">Coef. %</th><th class="r">Le toca</th>${(sel.plazos || [{}]).map((pl, i) => `<th class="c">${n > 1 ? (i + 1) + 'º · ' : ''}${pl.mes ? MES3[Number(pl.mes.slice(5, 7)) - 1] + ' ' + pl.mes.slice(2, 4) : ''}</th>`).join('')}<th class="r">Pendiente</th></tr></thead><tbody>${filas}</tbody></table></div>
        <div class="cardfoot">Casilla con importe y fecha: cobrado. Vacía: no cobrado. «No emitido»: el plazo aún no ha llegado. Pulsa una casilla para registrar el cobro.</div></section>
      <section class="card pad stack grow1"><h2>Presupuesto de la obra y pagos</h2>
        <table><thead><tr><th>Partida</th><th class="r">Presupuesto</th></tr></thead><tbody>${(sel.presupuesto || []).map(p => `<tr><td>${esc(p.partida)}</td><td class="r num nw">${eur(p.importe)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Sin presupuesto. Añádelo en «Editar derrama».</td></tr>'}
        ${pres ? `<tr class="tot"><td>Total presupuesto</td><td class="r num nw">${eur(pres)}</td></tr>` : ''}</tbody></table>
        <table><thead><tr><th>Pagos de obra</th><th class="r">Importe</th></tr></thead><tbody>${pagos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(g => `<tr><td>${esc(g.concepto)}<div class="small muted">${fecha(g.fecha)}${g.proveedor ? ' · ' + esc(g.proveedor) : ''}</div></td><td class="r num nw">${eur(g.importe)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Aún no hay pagos</td></tr>'}
        <tr class="tot"><td>Total pagado</td><td class="r num nw">${eur(pagado)}</td></tr></tbody></table>
        <button class="btn sm" data-a="pagoObra" style="align-self:flex-start">+ Pago de obra</button></section></div>`;
  }
  return `<div class="head" style="align-items:center"><div><h2>Derramas</h2><div class="small muted">Gastos extraordinarios aprobados en junta, con su reparto, plazos y cobro.</div></div><button class="btn primary" data-a="nuevaDer">+ Nueva derrama</button></div>
    <div class="grid-props" style="grid-template-columns:repeat(auto-fill,minmax(290px,1fr))">${ds.map(x => { const r = resumenDer(x); return `<button type="button" class="card" data-der="${x.id}" aria-pressed="${x.id === st.der}" style="text-align:left;padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:8px;font:inherit;color:inherit;border-color:${x.id === st.der ? 'var(--accent)' : 'var(--line)'};background:${x.id === st.der ? 'var(--accent-soft)' : '#fff'}">
      <b>${esc(x.concepto)}</b><span class="small muted">${eur(x.total)} · ${(x.plazos || []).length || 1} plazo(s) · ${x.reparto === 'iguales' ? 'partes iguales' : 'coeficiente'}</span>
      <span class="split" style="height:8px"><span style="width:${r.pct}%;background:var(--ing)"></span></span><span class="small">Cobrado ${eur(r.cob)} de ${eur(x.total)}</span></button>`; }).join('') || '<div class="card empty" style="grid-column:1/-1">No hay derramas.</div>'}</div>
    ${detalle}`;
}

/* ---------- Juntas y convocatorias ---------- */
const TIPOJ = { ordinaria: 'Ordinaria', extraordinaria: 'Extraordinaria' };
const plazoMin = (c, j) => (j.urgente ? 0 : /horizontal/i.test(c.normativa || '') ? 6 : 8);

function juntas({ c, vs, d }) {
  const js = d.juntas.filter(x => x.comunidadId === c.id).sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));
  if (!st.junta || !js.find(x => x.id === st.junta)) st.junta = js[0]?.id || null;
  const sel = js.find(x => x.id === st.junta);
  const hoy = hoyISO();
  let detalle = '';
  if (sel) {
    const deud = deudoresDe(c, d);
    const dias = sel.fecha ? Math.round((new Date(sel.fecha) - new Date(sel.fechaEmision || hoy)) / 86400000) : null;
    const min = plazoMin(c, sel);
    const env = sel.envios || {};
    const nEnv = vs.filter(v => env[v.id]).length;
    detalle = `<div class="row">
    <section class="card pad stack grow1"><div class="head" style="align-items:center"><div><h2>Junta ${TIPOJ[sel.tipo].toLowerCase()} · ${fecha(sel.fecha)}</h2><div class="small muted">${esc(sel.hora || '')}${sel.hora2 ? ' / ' + esc(sel.hora2) : ''} h · ${esc(sel.lugar || '')}</div></div>
      <div class="actions"><button class="btn sm" data-j="editar">Editar</button></div></div>
      ${dias !== null && dias < min ? `<div class="strip bad"><div class="small">Entre la convocatoria (${fecha(sel.fechaEmision || hoy)}) y la junta hay <b>${dias} días</b>. La ${/horizontal/i.test(c.normativa || '') ? 'LPH pide al menos 6 días' : 'normativa catalana pide al menos 8 días naturales'} para una junta ${sel.tipo}${sel.tipo === 'extraordinaria' ? ' no urgente' : ''}.</div></div>` : ''}
      <h3 style="margin:4px 0 0">Orden del día</h3>
      <ol style="margin:0;padding-left:20px">${(sel.puntos || []).map(p => `<li>${esc(p.es || p.ca)}${p.ca && p.es ? `<div class="small muted">${esc(p.ca)}</div>` : ''}</li>`).join('')}</ol>
      <div class="small muted">Fecha de la convocatoria: ${fecha(sel.fechaEmision)} · ${deud.length ? deud.length + ' propietarios sin derecho a voto por tener importes pendientes' : 'todos al corriente'}</div>
      <div class="actions"><button class="btn primary" data-j="imprimirTodas">Convocatorias para todos (PDF)</button><button class="btn" data-j="tablon">Anuncio para el tablón</button></div>
      <div class="small muted">Se abre una ventana con una página por vecino, en su idioma, con la delegación de voto. Pulsa «Imprimir o guardar como PDF».</div></section>
    <section class="card grow1"><div class="cardhead"><div><h2>Envío a los vecinos</h2><div class="small muted">${nEnv} de ${vs.length} marcados como enviados</div></div><button class="btn sm" data-j="marcarTodos">Marcar todos enviados</button></div>
      <div class="tw"><table><thead><tr><th>Piso</th><th>Propietario</th><th>Idioma</th><th>Enviada</th><th></th></tr></thead><tbody>
      ${vs.map(v => `<tr><td class="b nw">${esc(v.piso)}</td><td>${esc(v.propietario)}${deud.find(x => x.id === v.id) ? ' <span class="badge bad">Sin voto</span>' : ''}<div class="small muted">${esc(v.email || (v.direccionNotif ? 'Correo postal: ' + v.direccionNotif : 'Sin email'))}</div></td>
        <td class="small">${v.idioma === 'es' ? 'Castellano' : 'Català'}</td><td class="small nw">${env[v.id] ? `<button class="badge ok" style="border:0;cursor:pointer" data-jenv="${v.id}" title="Pulsa para desmarcar">${fecha(env[v.id].fecha)} · ${esc(env[v.id].via)}</button>` : `<button class="linkbtn small" data-jenv="${v.id}">Marcar</button>`}</td>
        <td class="nw"><button class="btn sm" data-jver="${v.id}">PDF</button>${v.email ? ` <button class="btn sm" data-jmail="${v.id}">Email</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div><div class="cardfoot">«Email» abre tu correo con el texto de la convocatoria ya escrito. Para adjuntar el PDF, guárdalo antes con el botón «PDF».</div></section></div>
    <details class="card pad small"><summary style="cursor:pointer;color:var(--muted)">Opciones avanzadas</summary><div class="actions" style="margin-top:10px"><button class="btn sm danger" data-j="borrar">Borrar esta junta</button></div></details>`;
  }
  return `<div class="head" style="align-items:center"><div><h2>Juntas</h2><div class="small muted">Convocatorias ordinarias y extraordinarias, personalizadas por vecino. Las actas vendrán aquí mismo.</div></div>
    <div class="actions"><button class="btn" data-j="nueva" data-tipo="extraordinaria">+ Junta extraordinaria</button><button class="btn primary" data-j="nueva" data-tipo="ordinaria">+ Junta ordinaria</button></div></div>
    <div class="grid-props" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${js.map(x => { const pasada = (x.fecha || '') < hoy; return `<button type="button" class="card" data-junta="${x.id}" aria-pressed="${x.id === st.junta}" style="text-align:left;padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:6px;font:inherit;color:inherit;border-color:${x.id === st.junta ? 'var(--accent)' : 'var(--line)'};background:${x.id === st.junta ? 'var(--accent-soft)' : '#fff'}">
      <span style="display:flex;justify-content:space-between;gap:8px"><b>Junta ${TIPOJ[x.tipo].toLowerCase()}</b><span class="badge ${pasada ? 'neutral' : 'info'}">${pasada ? 'Celebrada' : 'Convocada'}</span></span><span class="small">${x.fecha ? fechaLarga(x.fecha, 'es', true) : '—'} · ${esc(x.hora || '')} h</span><span class="small muted">${(x.puntos || []).length} puntos · ${esc(x.lugar || '')}</span></button>`; }).join('') || '<div class="card empty" style="grid-column:1/-1">Aún no hay juntas. Crea la primera con los botones de arriba.</div>'}</div>
    ${detalle}`;
}

function formJunta(c, j, done, tipo = 'ordinaria') {
  const y = new Date().getFullYear();
  const lphc = /horizontal/i.test(c.normativa || '');
  const en = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const v = j || { tipo, fecha: en, hora: '19:00', hora2: lphc ? '19:30' : '', lugar: c.lugarJuntas || 'el vestíbulo de la finca', fechaEmision: hoyISO(), puntos: ordenPorDefecto(tipo, y) };
  const fila = (p = {}, i) => `<div class="punto" style="display:grid;grid-template-columns:28px 1fr 1fr 34px;gap:8px;align-items:start"><b style="padding-top:10px">${i + 1}.</b>
    <textarea class="inp" name="pes" rows="2" placeholder="Castellano">${esc(p.es || '')}</textarea><textarea class="inp" name="pca" rows="2" placeholder="Català">${esc(p.ca || '')}</textarea><button type="button" class="btn sm" data-qp aria-label="Quitar punto">✕</button></div>`;
  modal({ title: (j ? 'Editar junta ' : 'Nueva junta ') + TIPOJ[v.tipo].toLowerCase(), submit: 'Guardar junta', wide: true,
    body: `<div class="fgrid">${select('Tipo', 'tipo', v.tipo, [['ordinaria', 'Ordinaria'], ['extraordinaria', 'Extraordinaria']])}${field('Fecha de la junta', 'fecha', v.fecha, { type: 'date', required: true })}
      ${field('Hora', 'hora', v.hora, { type: 'time', required: true })}${field('Hora de segunda convocatoria', 'hora2', v.hora2, { type: 'time', hint: lphc ? 'Con la LPH, al menos 30 minutos después' : 'En Cataluña hay una sola convocatoria: déjalo vacío' })}
      ${field('Lugar', 'lugar', v.lugar, { required: true, span2: true, placeholder: 'El vestíbulo de la finca' })}${field('Fecha de la convocatoria', 'fechaEmision', v.fechaEmision, { type: 'date' })}
      <label class="check" style="align-self:end"><input type="checkbox" name="urgente" ${v.urgente ? 'checked' : ''}> Extraordinaria urgente (sin plazo mínimo)</label></div>
    <div class="stack" style="gap:8px"><div style="display:grid;grid-template-columns:28px 1fr 1fr 34px;gap:8px"><span></span><b class="small">Castellano</b><b class="small">Català</b><span></span></div><div id="puntos" class="stack" style="gap:8px">${(v.puntos || []).map(fila).join('')}</div>
      <button type="button" class="btn sm" id="addPunto" style="align-self:flex-start">+ Añadir punto</button>
      <div class="small muted">Cada vecino recibe la convocatoria en su idioma. Si un punto solo está en un idioma, se usa ese para todos.</div></div>
    <div class="fgrid">${field('Nota adicional (castellano)', 'notaEs', v.nota?.es, { span2: true, placeholder: 'Opcional' })}${field('Nota adicional (català)', 'notaCa', v.nota?.ca, { span2: true, placeholder: 'Opcional' })}</div>`,
    onSubmit: async (f) => {
      const x = fd(f);
      const puntos = [...document.querySelectorAll('#puntos .punto')].map(r => ({ es: r.querySelector('[name=pes]').value.trim(), ca: r.querySelector('[name=pca]').value.trim() })).filter(p => p.es || p.ca);
      if (!puntos.length) { toast('Añade al menos un punto al orden del día'); return false; }
      const obj = await db.put('f_juntas', { ...v, comunidadId: c.id, tipo: x.tipo, fecha: x.fecha, hora: x.hora, hora2: x.hora2, lugar: x.lugar.trim(), fechaEmision: x.fechaEmision || hoyISO(), urgente: !!x.urgente, puntos, nota: { es: x.notaEs, ca: x.notaCa } });
      if (x.lugar.trim() !== c.lugarJuntas) await db.put('f_comunidades', { ...c, lugarJuntas: x.lugar.trim() });
      st.junta = obj.id; toast('Junta guardada'); done();
    } });
  const cont = document.getElementById('puntos');
  const renum = () => { cont.querySelectorAll('.punto').forEach((r, i) => { r.querySelector('b').textContent = (i + 1) + '.'; }); cont.querySelectorAll('[data-qp]').forEach(b => b.onclick = () => { b.closest('.punto').remove(); renum(); }); };
  renum();
  document.getElementById('addPunto').onclick = () => { cont.insertAdjacentHTML('beforeend', fila({}, cont.children.length)); renum(); cont.lastElementChild.querySelector('textarea').focus(); };
  const ft = document.querySelector('[name=tipo]');
  if (!j) ft.onchange = () => { cont.innerHTML = ordenPorDefecto(ft.value, y).map(fila).join(''); renum(); };
}

export const CARACTERISTICAS = [['ascensor', 'Ascensor'], ['porteria', 'Portería / conserje'], ['garaje', 'Garaje'], ['trasteros', 'Trasteros'], ['piscina', 'Piscina'], ['jardin', 'Jardín / zonas comunes'], ['calefaccion', 'Calefacción central'], ['antena', 'Antena colectiva'], ['locales', 'Locales comerciales']];

function presupuesto({ c, d }) {
  const y = st.anio;
  const pres = presupuestoAnio(c, y);
  const gs = d.gastos.filter(g => g.comunidadId === c.id && g.grupo !== 'derrama' && g.estado !== 'pendiente' && (g.fecha || '').startsWith(String(y)));
  const real = (nombre) => gs.filter(g => (g.partida || '') === nombre).reduce((a, g) => a + Number(g.importe || 0), 0);
  const sinPartida = gs.filter(g => !g.partida || !pres.some(p => p.partida === g.partida)).reduce((a, g) => a + Number(g.importe || 0), 0);
  const totP = pres.reduce((a, p) => a + Number(p.importe || 0), 0), totR = gs.reduce((a, g) => a + Number(g.importe || 0), 0);
  const fila = (nombre, grupo, imp, r) => { const pct = imp ? Math.min(100, r / imp * 100) : 0, dif = imp - r;
    return `<tr><td class="b">${esc(nombre)}</td><td class="small">${grupo ? esc(grupoTxt(grupo)) : '—'}</td><td class="r num">${imp ? eur(imp) : '—'}</td><td class="r num b">${eur(r)}</td>
    <td style="width:180px"><div class="split" style="height:8px"><span style="width:${pct}%;background:${r > imp + 0.01 && imp ? 'var(--gas)' : 'var(--ing)'}"></span></div></td><td class="r num ${dif < -0.01 ? 'neg' : 'muted'}">${imp ? eur(dif) : ''}</td></tr>`; };
  return `<section class="card"><div class="cardhead"><div><h2>Presupuesto ${y}</h2><div class="small muted">Lo presupuestado por partidas frente a lo gastado de verdad (gastos pagados, sin derramas).</div></div>
    <div class="actions">${yearSel()}<button class="btn primary sm" data-a="editPres">${pres.length ? 'Editar presupuesto' : 'Crear presupuesto'}</button></div></div>
    ${pres.length || totR ? `<div class="tw"><table style="min-width:720px"><thead><tr><th>Partida</th><th>Reparto</th><th class="r">Presupuesto</th><th class="r">Gastado</th><th>Consumo</th><th class="r">Queda</th></tr></thead><tbody>
      ${pres.map(p => fila(p.partida, p.grupo, Number(p.importe || 0), real(p.partida))).join('')}
      ${sinPartida ? fila('Gastos sin partida asignada', '', 0, sinPartida) : ''}
      <tr class="tot"><td>Total</td><td></td><td class="r num">${eur(totP)}</td><td class="r num">${eur(totR)}</td><td></td><td class="r num ${totP - totR < 0 ? 'neg' : ''}">${eur(totP - totR)}</td></tr></tbody></table></div>
      <div class="cardfoot">Para que un gasto cuente en una partida, elígela al apuntar el gasto. Este presupuesto servirá para la junta y para la liquidación anual.</div>`
    : `<div class="pad" style="padding:0 20px 20px"><div class="muted">No hay presupuesto para ${y}. Créalo por partidas (limpieza, luz, ascensor, seguro…) o cópialo del año anterior.</div></div>`}</section>`;
}

function datos({ c, vs }) {
  const car = c.caracteristicas || {};
  const tiene = CARACTERISTICAS.filter(([k]) => car[k]).map(([, l]) => l);
  return `<div class="row">
  <section class="card pad stack grow1"><div class="head" style="align-items:center"><h2>Datos de la comunidad</h2><button class="linkbtn" data-a="editCom">Editar</button></div>
    <dl class="dl"><dt>Nombre</dt><dd class="b">${esc(c.nombre)}</dd><dt>Dirección</dt><dd>${esc([c.direccion, c.localidad].filter(Boolean).join(', ')) || '—'}</dd><dt>CIF</dt><dd>${esc(c.cif) || '—'}</dd><dt>IBAN</dt><dd>${esc(c.iban) || '—'}${c.banco ? ' · ' + esc(c.banco) : ''}</dd>
    <dt>Secretaría</dt><dd>${esc(c.secretario) || '—'}</dd>
    <dt>Presupuesto ${new Date().getFullYear()}</dt><dd class="num">${totalPresupuesto(c, new Date().getFullYear()) ? eur(totalPresupuesto(c, new Date().getFullYear())) : '—'}</dd><dt>Cuotas</dt><dd>${c.periodicidad === 'trimestral' ? 'Trimestrales' : 'Mensuales'} · vencen el día ${esc(c.diaCobro || 10)}</dd>
    <dt>Control de cuotas</dt><dd>${c.cobrosDesde ? 'Desde ' + MESES[Number(c.cobrosDesde.slice(5, 7)) - 1].toLowerCase() + ' ' + c.cobrosDesde.slice(0, 4) : '—'}</dd>
    <dt>Fondo de reserva</dt><dd class="num">${eur(c.fondoReserva || 0)}</dd><dt>Idioma</dt><dd>${c.idioma === 'es' ? 'Castellano' : 'Català'}</dd><dt>Normativa</dt><dd>${esc(c.normativa) || '—'}</dd></dl>
    ${c.notas ? `<div class="small" style="white-space:pre-line">${esc(c.notas)}</div>` : ''}</section>
  <div class="stack grow1" style="gap:20px">
  <section class="card pad stack"><div class="head" style="align-items:center"><h2>Presidencia</h2><button class="linkbtn" data-a="editCom">Editar</button></div>
    <dl class="dl"><dt>Presidente/a</dt><dd class="b">${esc(c.presidente) || '—'}</dd><dt>Piso</dt><dd>${esc(c.presidentePiso) || '—'}</dd>
    <dt>Teléfono</dt><dd>${c.presidenteTel ? `<a href="tel:${esc(c.presidenteTel)}">${esc(c.presidenteTel)}</a>` : '—'}</dd><dt>Email</dt><dd>${c.presidenteEmail ? `<a href="mailto:${esc(c.presidenteEmail)}">${esc(c.presidenteEmail)}</a>` : '—'}</dd>
    <dt>Mandato hasta</dt><dd>${c.presidenteHasta ? fecha(c.presidenteHasta) : '—'}</dd></dl></section>
  <section class="card pad stack"><div class="head" style="align-items:center"><h2>Características especiales</h2><button class="linkbtn" data-a="editCom">Editar</button></div>
    <div class="chips">${tiene.map(t => `<span class="badge info">${esc(t)}</span>`).join('') || '<span class="muted">Sin indicar</span>'}</div>
    <dl class="dl"><dt>Plantas</dt><dd>${esc(car.plantas) || '—'}</dd><dt>Año de construcción</dt><dd>${esc(car.anio) || '—'}</dd></dl>
    ${car.otras ? `<div class="small" style="white-space:pre-line">${esc(car.otras)}</div>` : ''}</section>
  </div></div>
  <section class="card pad stack"><h2>Herramientas de cuotas</h2>
    <div class="alert"><div style="flex:1"><div class="t">Calcular cuotas desde el presupuesto</div><div class="d">Cuota de cada piso = presupuesto del año × coeficiente ÷ ${c.periodicidad === 'trimestral' ? '4' : '12'}.</div></div><button class="btn sm" data-a="calcCuotas" ${vs.length ? '' : 'disabled'}>Calcular</button></div>
    <div class="alert"><div style="flex:1"><div class="t">Subir o bajar todas las cuotas un %</div><div class="d">Por ejemplo, +10 % a partir de septiembre. Los meses anteriores conservan la cuota antigua.</div></div><button class="btn sm" data-a="subirCuotas" ${vs.length ? '' : 'disabled'}>Aplicar</button></div>
    <details class="small"><summary style="cursor:pointer;color:var(--muted)">Opciones avanzadas</summary><div class="actions" style="margin-top:10px"><button class="btn danger sm" data-a="baja">Dar de baja la comunidad</button></div></details></section>`;
}

/* ---------- Formularios ---------- */

function formCobro(c, vs, d, pre, done) {
  const hoy = hoyISO();
  const v0 = pre?.vecinoId || vs[0]?.id;
  const y0 = pre?.anio || Number(hoy.slice(0, 4)), m0 = pre?.mes || Number(hoy.slice(5, 7));
  const ders = d.derramas.filter(x => x.comunidadId === c.id);
  const existentes = pre ? d.cobros.filter(q => q.vecinoId === pre.vecinoId && (pre.derramaId ? q.derramaId === pre.derramaId && Number(q.plazo || 0) === pre.plazo : q.concepto === 'cuota' && q.anio === y0 && q.mes === m0)) : [];
  const conceptos = [['cuota', 'Cuota'], ...ders.flatMap(der => (der.plazos || [{}]).map((pl, i) => [`der|${der.id}|${i}`, `${der.concepto}${(der.plazos || []).length > 1 ? ' · plazo ' + (i + 1) : ''}`])), ['otro', 'Otro ingreso']];
  const con0 = pre?.derramaId ? `der|${pre.derramaId}|${pre.plazo}` : 'cuota';
  const v = vs.find(q => q.id === v0);
  const faltaCuota = (vid, yy, mm) => { const vv = vs.find(q => q.id === vid); if (!vv) return 0; const e = estadoCuota(c, vv, d.cobros, yy, mm); return Math.max(0, (e.esp || 0) - e.pag); };
  const faltaDer = (vid, did, i) => { const vv = vs.find(q => q.id === vid), der = ders.find(q => q.id === did); if (!vv || !der) return 0; const n = (der.plazos || []).length || 1; return Math.max(0, parteDerrama(der, vv, vs) / n - cobradoDerrama(d.cobros, vid, did, i).imp); };
  const imp0 = con0 === 'cuota' ? faltaCuota(v0, y0, m0) : faltaDer(v0, pre.derramaId, pre.plazo);
  const mesesOpt = []; for (let yy = y0 - 1; yy <= y0 + 1; yy++) for (let mm = 1; mm <= 12; mm++) if (tocaCobrar(c, mm)) mesesOpt.push([`${yy}-${mm}`, `${MESES[mm - 1]} ${yy}`]);
  modal({ title: 'Registrar cobro', submit: 'Guardar cobro',
    body: `${existentes.length ? `<div class="stack"><b>Cobros ya registrados${pre && !pre.derramaId ? ` en ${MESES[m0 - 1].toLowerCase()} ${y0}` : ''}</b>${existentes.map(q => `<div class="alert" style="align-items:center"><div style="flex:1"><b class="num">${eur(q.importe)}</b> el ${fecha(q.fecha)}${q.forma ? ' · ' + esc(q.forma) : ''}${q.nota ? ' · ' + esc(q.nota) : ''}</div><button type="button" class="btn sm" data-editcob="${q.id}">Editar</button><button type="button" class="btn sm danger" data-delcob="${q.id}">Borrar</button></div>`).join('')}</div>` : ''}
    <div class="fgrid">
      ${select('Vecino', 'vecinoId', v0, vs.map(q => [q.id, `${q.piso} · ${q.propietario}`]))}
      ${select('Concepto', 'concepto', con0, conceptos)}
      ${select('Mes de la cuota', 'mes', `${y0}-${m0}`, mesesOpt)}
      ${money('Importe (€)', 'importe', imp0 || '', { required: true })}
      ${field('Fecha de cobro', 'fecha', hoy, { type: 'date', required: true })}
      ${select('Forma de pago', 'forma', v?.formaPago === 'Domiciliado' ? 'Recibo domiciliado' : 'Transferencia', ['Recibo domiciliado', 'Transferencia', 'Bizum', 'Efectivo', 'Otro'])}
      ${field('Nota', 'nota', '', { placeholder: 'Opcional', span2: true })}
    </div>`,
    onSubmit: async (f) => {
      const x = fd(f); const imp = num(x.importe); if (!imp) { toast('Indica el importe'); return false; }
      const base = { comunidadId: c.id, vecinoId: x.vecinoId, pagador: vs.find(q => q.id === x.vecinoId)?.propietario || '', importe: imp, fecha: x.fecha, forma: x.forma, nota: x.nota };
      if (x.concepto === 'cuota') { const [yy, mm] = x.mes.split('-').map(Number); await db.put('f_cobros', { ...base, concepto: 'cuota', anio: yy, mes: mm }); }
      else if (x.concepto.startsWith('der|')) { const [, did, i] = x.concepto.split('|'); await db.put('f_cobros', { ...base, concepto: 'derrama', derramaId: did, plazo: Number(i), anio: Number(x.fecha.slice(0, 4)), mes: Number(x.fecha.slice(5, 7)) }); }
      else await db.put('f_cobros', { ...base, concepto: 'otro', anio: Number(x.fecha.slice(0, 4)), mes: Number(x.fecha.slice(5, 7)) });
      toast('Cobro guardado'); done();
    } });
  const fv = document.querySelector('[name=vecinoId]'), fc = document.querySelector('[name=concepto]'), fm = document.querySelector('[name=mes]'), fi = document.querySelector('[name=importe]');
  const mesBox = fm.closest('.field');
  const upd = () => { mesBox.style.display = fc.value === 'cuota' ? '' : 'none';
    let val = 0; if (fc.value === 'cuota') { const [yy, mm] = fm.value.split('-').map(Number); val = faltaCuota(fv.value, yy, mm); } else if (fc.value.startsWith('der|')) { const [, did, i] = fc.value.split('|'); val = faltaDer(fv.value, did, Number(i)); }
    fi.value = val ? fmtNum(val) : ''; };
  [fv, fc, fm].forEach(e => e.onchange = upd); mesBox.style.display = fc.value === 'cuota' ? '' : 'none';
  document.querySelectorAll('[data-delcob]').forEach(b => b.onclick = async () => { await db.del('f_cobros', b.dataset.delcob); toast('Cobro borrado'); document.getElementById('modal-root').innerHTML = ''; done(); });
  document.querySelectorAll('[data-editcob]').forEach(b => b.onclick = () => formEditCobro(d.cobros.find(q => q.id === b.dataset.editcob), done));
}

function formEditCobro(q, done) {
  modal({ title: 'Editar cobro', extra: '<button type="button" class="btn danger" data-del>Borrar</button>',
    body: `<div class="fgrid">${money('Importe (€)', 'importe', q.importe, { required: true })}${field('Fecha de cobro', 'fecha', q.fecha, { type: 'date' })}${select('Forma de pago', 'forma', q.forma, ['', 'Recibo domiciliado', 'Transferencia', 'Bizum', 'Efectivo', 'Otro'])}${field('Nota', 'nota', q.nota)}
      ${q.concepto === 'cuota' ? field('Mes de la cuota', 'mesC', `${q.anio}-${String(q.mes).padStart(2, '0')}`, { type: 'month' }) : ''}</div>`,
    onSubmit: async (f) => { const x = fd(f); const o = { ...q, importe: num(x.importe), fecha: x.fecha, forma: x.forma, nota: x.nota }; if (x.mesC) { o.anio = Number(x.mesC.slice(0, 4)); o.mes = Number(x.mesC.slice(5, 7)); } await db.put('f_cobros', o); toast('Cobro guardado'); done(); } });
  document.querySelector('[data-del]').onclick = async () => { if (await confirmar('Borrar cobro', '¿Seguro que quieres borrar este cobro?')) { await db.del('f_cobros', q.id); toast('Cobro borrado'); done(); } };
}

function formGasto(c, d, g, done, pre = {}) {
  const ders = d.derramas.filter(x => x.comunidadId === c.id);
  const v = g || { fecha: hoyISO(), grupo: 'coef', estado: 'pagado', ...pre };
  const usados = new Set(d.gastos.filter(x => x.comunidadId === c.id && x.proveedorId).map(x => x.proveedorId));
  const hab = d.proveedores.filter(p => usados.has(p.id)), resto = d.proveedores.filter(p => !usados.has(p.id));
  const provSel = v.proveedorId || (v.proveedor ? '__texto' : '');
  const opt = (p) => `<option value="${p.id}" ${p.id === provSel ? 'selected' : ''}>${esc(p.nombre)}${p.servicio ? ' · ' + esc(p.servicio) : ''}</option>`;
  const partidas = (y) => presupuestoAnio(c, y).map(p => p.partida);
  const y0 = Number((v.fecha || hoyISO()).slice(0, 4));
  modal({ title: g ? 'Editar gasto' : 'Nuevo gasto de la comunidad', wide: true, extra: g ? '<button type="button" class="btn danger" data-del>Borrar</button>' : '',
    body: `<div class="fgrid">${field('Concepto', 'concepto', v.concepto, { required: true, span2: true, placeholder: 'Llum escala gener' })}
      <label class="field">Proveedor<select name="proveedorId"><option value="">— Sin proveedor —</option>${hab.length ? `<optgroup label="Habituales de esta comunidad">${hab.map(opt).join('')}</optgroup>` : ''}${resto.length ? `<optgroup label="${hab.length ? 'Otros proveedores' : 'Proveedores'}">${resto.map(opt).join('')}</optgroup>` : ''}
        ${v.proveedor && !v.proveedorId ? `<option value="__texto" selected>${esc(v.proveedor)} (escrito a mano)</option>` : ''}<option value="__nuevo">+ Nuevo proveedor…</option></select></label>
      <div id="provNuevo" class="span2" style="display:none;grid-template-columns:1fr 1fr;gap:14px">${field('Nombre del nuevo proveedor', 'provNombre', '')}${select('Servicio', 'provServicio', 'Otros', ['Limpieza', 'Electricidad / luz', 'Agua', 'Ascensor', 'Seguro', 'Fontanería', 'Cerrajería', 'Electricista', 'Pintura', 'Obras / construcción', 'Jardinería', 'Desinfección / plagas', 'Extintores / PCI', 'Arquitecto / técnico', 'Administración', 'Otros'])}</div>
      ${money('Importe (€)', 'importe', v.importe, { required: true, hint: 'En negativo si es un reintegro (p. ej. del seguro)' })}${field('Fecha', 'fecha', v.fecha, { type: 'date', required: true })}
      ${select('Cómo se reparte', 'grupo', v.grupo, GRUPOS)}${ders.length ? select('Derrama u obra', 'derramaId', v.derramaId || '', [['', '—'], ...ders.map(x => [x.id, x.concepto])]) : ''}
      ${select('Partida del presupuesto', 'partida', v.partida || '', [['', partidas(y0).length ? '— Sin partida —' : '— No hay presupuesto de este año —'], ...partidas(y0).map(p => [p, p])])}
      ${select('Estado', 'estado', v.estado, [['pagado', 'Pagado'], ['pendiente', 'Pendiente de pagar']])}
      ${!g ? select('Se repite', 'repite', '1', [['1', 'Una vez'], ['12', 'Cada mes (12)'], ['4', 'Cada trimestre (4)']]) : ''}
      ${field('Nota', 'nota', v.nota, { span2: true, placeholder: 'Ej.: pagado por un vecino, hay que devolvérselo' })}</div>`,
    onSubmit: async (f) => {
      const x = fd(f); const imp = num(x.importe);
      if (!x.concepto.trim() || !imp || !x.fecha) { toast('Faltan concepto, importe o fecha'); return false; }
      let proveedorId = x.proveedorId, proveedor = '';
      if (proveedorId === '__nuevo') { if (!x.provNombre.trim()) { toast('Escribe el nombre del nuevo proveedor'); return false; } const np = await db.put('f_proveedores', { nombre: x.provNombre.trim(), servicio: x.provServicio }); proveedorId = np.id; proveedor = np.nombre; }
      else if (proveedorId === '__texto') { proveedorId = ''; proveedor = v.proveedor; }
      else if (proveedorId) proveedor = d.proveedores.find(p => p.id === proveedorId)?.nombre || '';
      const obj = { ...v, comunidadId: c.id, concepto: x.concepto.trim(), proveedorId, proveedor, importe: imp, fecha: x.fecha, grupo: x.grupo, derramaId: x.grupo === 'derrama' ? (x.derramaId || v.derramaId || '') : '', partida: x.grupo === 'derrama' ? '' : x.partida, estado: x.estado, nota: x.nota };
      await db.put('f_gastos', obj);
      const n = Number(x.repite || 1);
      if (n > 1) { const paso = 12 / n; const [yy, mm, dd] = x.fecha.split('-').map(Number);
        for (let k = 1; k < n; k++) { const dt = new Date(yy, mm - 1 + paso * k, Math.min(dd, 28)); const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          await db.put('f_gastos', { ...obj, id: undefined, fecha: iso, estado: iso <= hoyISO() ? obj.estado : 'pendiente' }); } }
      toast('Gasto guardado'); done();
    } });
  const sp = document.querySelector('[name=proveedorId]'), box = document.getElementById('provNuevo');
  sp.onchange = () => { box.style.display = sp.value === '__nuevo' ? 'grid' : 'none'; if (sp.value === '__nuevo') document.querySelector('[name=provNombre]').focus(); };
  const ff = document.querySelector('[name=fecha]'), fp = document.querySelector('[name=partida]');
  ff.onchange = () => { const yy = Number((ff.value || '').slice(0, 4)); const cur = fp.value; const ps = partidas(yy);
    fp.innerHTML = `<option value="">${ps.length ? '— Sin partida —' : '— No hay presupuesto de este año —'}</option>` + ps.map(p => `<option ${p === cur ? 'selected' : ''}>${esc(p)}</option>`).join(''); };
  const del = document.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmar('Borrar gasto', '¿Seguro que quieres borrar este gasto?')) { await db.del('f_gastos', g.id); toast('Gasto borrado'); done(); } };
}

function formPresupuesto(c, y, done) {
  const actual = presupuestoAnio(c, y), previo = presupuestoAnio(c, y - 1);
  const filaHtml = (p = {}) => `<tr><td><input class="inp" name="pp" value="${esc(p.partida || '')}" placeholder="Limpieza"></td><td><select class="inp" name="pg">${[['coef', 'Por coeficiente'], ['iguales', 'A partes iguales']].map(([k, l]) => `<option value="${k}" ${p.grupo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><input class="inp num" name="pi" inputmode="decimal" style="text-align:right" value="${p.importe != null ? fmtNum(p.importe) : ''}" placeholder="0,00"></td><td><button type="button" class="btn sm" data-quitar aria-label="Quitar partida">✕</button></td></tr>`;
  const base = actual.length ? actual : [{ partida: 'Limpieza', grupo: 'iguales' }, { partida: 'Electricidad', grupo: 'coef' }, { partida: 'Agua', grupo: 'coef' }, { partida: 'Ascensor', grupo: 'coef' }, { partida: 'Seguro', grupo: 'coef' }, { partida: 'Mantenimiento y reparaciones', grupo: 'coef' }, { partida: 'Honorarios de administración', grupo: 'iguales' }, { partida: 'Fondo de reserva', grupo: 'coef' }];
  modal({ title: `Presupuesto ${y} · ${c.nombre}`, submit: 'Guardar presupuesto', wide: true,
    body: `${!actual.length && previo.length ? `<div class="alert" style="align-items:center"><div style="flex:1">Hay presupuesto de ${y - 1}. ¿Copiarlo con un aumento?</div><input class="inp" id="pctCopia" style="width:80px" value="0" inputmode="decimal" aria-label="Aumento en %"> %<button type="button" class="btn sm" id="copiar">Copiar ${y - 1}</button></div>` : ''}
      <div class="tw"><table><thead><tr><th>Partida</th><th>Reparto</th><th class="r">Importe anual (€)</th><th></th></tr></thead><tbody id="filasPres">${base.map(filaHtml).join('')}</tbody>
      <tfoot><tr class="tot"><td>Total</td><td></td><td class="r num" id="totPres">0,00 €</td><td></td></tr></tfoot></table></div>
      <button type="button" class="btn sm" id="addPartida" style="align-self:flex-start">+ Añadir partida</button>
      <div class="small muted">Deja vacío el importe de las partidas que no se usen: no se guardarán.</div>`,
    onSubmit: async (f) => {
      const filas = [...document.querySelectorAll('#filasPres tr')].map(tr => ({ partida: tr.querySelector('[name=pp]').value.trim(), grupo: tr.querySelector('[name=pg]').value, importe: num(tr.querySelector('[name=pi]').value) })).filter(p => p.partida && p.importe);
      const presupuestos = { ...(c.presupuestos || {}), [y]: filas };
      const obj = { ...c, presupuestos };
      if (y === new Date().getFullYear()) obj.presupuesto = filas.reduce((a, p) => a + p.importe, 0);
      await db.put('f_comunidades', obj); toast('Presupuesto guardado'); done();
    } });
  const tb = document.getElementById('filasPres');
  const total = () => { document.getElementById('totPres').textContent = eur([...tb.querySelectorAll('[name=pi]')].reduce((a, i) => a + num(i.value), 0)); };
  const enlazar = () => { tb.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { b.closest('tr').remove(); total(); }); tb.querySelectorAll('[name=pi]').forEach(i => i.oninput = total); };
  enlazar(); total();
  document.getElementById('addPartida').onclick = () => { tb.insertAdjacentHTML('beforeend', filaHtml()); enlazar(); tb.querySelector('tr:last-child [name=pp]').focus(); };
  const cp = document.getElementById('copiar');
  if (cp) cp.onclick = () => { const k = 1 + num(document.getElementById('pctCopia').value) / 100; tb.innerHTML = previo.map(p => filaHtml({ ...p, importe: Math.round(p.importe * k * 100) / 100 })).join(''); enlazar(); total(); };
}

function formSaldo(c, done) {
  modal({ title: 'Saldo según el banco', submit: 'Guardar saldo',
    body: `<div class="fgrid">${money('Saldo de la cuenta (€)', 'importe', '', { required: true })}${field('Fecha del saldo', 'fecha', hoyISO(), { type: 'date', required: true })}${field('Nota', 'nota', '', { placeholder: 'Opcional', span2: true })}</div>
      <div class="small muted">Míralo en la app del banco. Cuando hagamos la conciliación con el extracto (PDF o Excel), se anotará solo.</div>`,
    onSubmit: async (f) => { const x = fd(f); if (!x.importe || !x.fecha) { toast('Faltan el saldo o la fecha'); return false; }
      await db.put('f_comunidades', { ...c, saldosBanco: [...(c.saldosBanco || []), { fecha: x.fecha, importe: num(x.importe), origen: 'Manual', nota: x.nota }] }); toast('Saldo guardado'); done(); } });
}

function formDerrama(c, der, done) {
  const v = der || { reparto: 'coef', plazos: [{ mes: hoyISO().slice(0, 7) }], presupuesto: [] };
  const n0 = (v.plazos || []).length || 1;
  modal({ title: der ? 'Editar derrama' : 'Nueva derrama', wide: true, extra: der ? '<button type="button" class="btn danger" data-del>Borrar</button>' : '',
    body: `<div class="fgrid">${field('Concepto', 'concepto', v.concepto, { required: true, span2: true, placeholder: 'Reparación de fachada' })}
      ${money('Importe total (€)', 'total', v.total, { required: true })}${field('Aprobada en la junta del', 'fechaJunta', v.fechaJunta, { type: 'date' })}
      ${select('Reparto', 'reparto', v.reparto, [['coef', 'Por coeficiente'], ['iguales', 'A partes iguales']])}
      ${select('Plazos', 'nplazos', n0, [1, 2, 3, 4, 6, 12])}${field('Primer plazo (mes)', 'primer', v.plazos?.[0]?.mes || hoyISO().slice(0, 7), { type: 'month' })}
      ${select('Cada cuánto', 'cada', v.cada || 1, [[1, 'Cada mes'], [2, 'Cada 2 meses'], [3, 'Cada 3 meses']])}
      ${textarea('Presupuesto de la obra (una partida por línea: partida ; importe)', 'pres', (v.presupuesto || []).map(p => `${p.partida} ; ${fmtNum(p.importe)}`).join('\n'), { rows: 5 })}</div>
      <div class="small muted">Si cambias los plazos de una derrama con cobros, revisa después a qué plazo corresponde cada cobro.</div>`,
    onSubmit: async (f) => {
      const x = fd(f); const total = num(x.total);
      if (!x.concepto.trim() || !total) { toast('Faltan el concepto o el importe'); return false; }
      const n = Number(x.nplazos) || 1, cada = Number(x.cada) || 1; const [yy, mm] = (x.primer || hoyISO().slice(0, 7)).split('-').map(Number);
      const plazos = Array.from({ length: n }, (_, i) => { const dt = new Date(yy, mm - 1 + i * cada, 1); return { mes: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }; });
      const presupuesto = (x.pres || '').split('\n').map(l => l.split(';')).filter(p => p[0] && p[0].trim()).map(p => ({ partida: p[0].trim(), importe: num(p[1]) }));
      const obj = await db.put('f_derramas', { ...v, comunidadId: c.id, concepto: x.concepto.trim(), total, fechaJunta: x.fechaJunta, reparto: x.reparto, plazos, cada, presupuesto });
      st.der = obj.id; toast('Derrama guardada'); done();
    } });
  const del = document.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmar('Borrar derrama', 'Se borrará la derrama y sus cobros. Los pagos de obra se conservan como gastos.')) {
    const cs = await db.by('f_cobros', 'comunidadId', c.id); for (const q of cs.filter(q => q.derramaId === der.id)) await db.del('f_cobros', q.id); await db.del('f_derramas', der.id); st.der = null; toast('Derrama borrada'); done(); } };
}

function cobroMasivo(c, vs, d, done) {
  const hoy = hoyISO(), y = Number(hoy.slice(0, 4)), m = Number(hoy.slice(5, 7));
  const opts = []; for (let yy = y - 1; yy <= y; yy++) for (let mm = 1; mm <= 12; mm++) if (tocaCobrar(c, mm) && `${yy}-${String(mm).padStart(2, '0')}` <= hoy.slice(0, 7)) opts.push([`${yy}-${mm}`, `${MESES[mm - 1]} ${yy}`]);
  const lista = (yy, mm) => vs.map(v => { const e = estadoCuota(c, v, d.cobros, yy, mm); const falta = Math.max(0, (e.esp || 0) - e.pag); return { v, falta }; });
  const pinta = (yy, mm) => lista(yy, mm).map(({ v, falta }) => `<label class="check" style="justify-content:space-between;border-bottom:1px solid var(--line2);padding:4px 0"><span><input type="checkbox" name="v_${v.id}" ${falta > 0.1 && v.formaPago === 'Domiciliado' ? 'checked' : ''} ${falta > 0.1 ? '' : 'disabled'}> ${esc(v.piso)} · ${esc(v.propietario)} <span class="small muted">(${esc(v.formaPago || '')})</span></span><b class="num">${falta > 0.1 ? eur(falta) : 'Pagado'}</b></label>`).join('');
  modal({ title: 'Cobrar un mes a varios vecinos', submit: 'Registrar cobros', wide: true,
    body: `<div class="fgrid">${select('Mes', 'mes', `${y}-${m}`, opts)}${field('Fecha de cobro', 'fecha', hoy, { type: 'date' })}${select('Forma de pago', 'forma', 'Recibo domiciliado', ['Recibo domiciliado', 'Transferencia', 'Bizum', 'Efectivo'])}</div>
      <div class="small muted">Útil cuando el banco cobra la remesa de recibos: marca quién ha pagado y se apunta lo que le faltaba de ese mes.</div><div id="lista" class="stack" style="gap:0">${pinta(y, m)}</div>`,
    onSubmit: async (f) => { const x = fd(f); const [yy, mm] = x.mes.split('-').map(Number); let n = 0;
      for (const { v, falta } of lista(yy, mm)) if (x['v_' + v.id] && falta > 0.1) { await db.put('f_cobros', { comunidadId: c.id, vecinoId: v.id, pagador: v.propietario, concepto: 'cuota', anio: yy, mes: mm, importe: Math.round(falta * 100) / 100, fecha: x.fecha, forma: x.forma }); n++; }
      toast(n ? `${n} cobros registrados` : 'No se ha marcado ningún vecino'); done(); } });
  const fm = document.querySelector('[name=mes]'); fm.onchange = () => { const [yy, mm] = fm.value.split('-').map(Number); document.getElementById('lista').innerHTML = pinta(yy, mm); };
}

/* ---------- Eventos ---------- */

export function bind(el, [id, tab, sub, extra], d, refresh) {
  const c = d.coms.find(x => x.id === id); if (!c) return;
  if (tab === 'vecino') return bindVecino(el, c, sub, d, refresh);
  if (tab === 'carta') return bindRedactar(el, c, sub, extra, d);
  if (tab === 'cartas') bindTabCartas(el, c, d, refresh);
  const vs = vecinosDe(d, c.id);
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  const anio = el.querySelector('#anio'); if (anio) anio.onchange = () => { st.anio = Number(anio.value); refresh(); };
  on('[data-a=editCom]', () => formComunidad(c, refresh));
  on('[data-a=baja]', () => darDeBaja(c, refresh));
  on('[data-a=saldo]', () => formSaldo(c, refresh));
  on('[data-delsaldo]', async (b) => { const h = (c.saldosBanco || []).slice().sort((a, z) => (a.fecha < z.fecha ? 1 : -1)); const quitar = h[Number(b.dataset.delsaldo)];
    if (await confirmar('Borrar saldo', `¿Borrar el saldo anotado del ${fecha(quitar.fecha)}?`)) { await db.put('f_comunidades', { ...c, saldosBanco: (c.saldosBanco || []).filter(x => x !== quitar) }); toast('Saldo borrado'); refresh(); } });
  on('[data-a=editPres]', () => formPresupuesto(c, st.anio, refresh));
  on('[data-junta]', (b) => { st.junta = b.dataset.junta; refresh(); });
  on('[data-j=nueva]', (b) => formJunta(c, null, refresh, b.dataset.tipo));
  const jsel = d.juntas.find(x => x.id === st.junta);
  const ad = d.aj.admin || {};
  const abrir = (titulo, pags) => { if (!abrirImpresion(titulo, pags)) toast('El navegador ha bloqueado la ventana: permite las ventanas emergentes para esta página'); };
  if (jsel) {
    const guardarEnv = async (envios) => { await db.put('f_juntas', { ...jsel, envios }); refresh(); };
    on('[data-j=editar]', () => formJunta(c, jsel, refresh));
    on('[data-j=imprimirTodas]', () => abrir(`Convocatorias ${c.nombre} ${fecha(jsel.fecha)}`, vs.map(v => paginaConvocatoria(jsel, c, v, d, ad))));
    on('[data-j=tablon]', () => abrir(`Anuncio ${c.nombre}`, ['ca', 'es'].map(l => paginaConvocatoria({ ...jsel, idiomaTablon: l }, c, null, d, ad))));
    on('[data-jver]', (b) => { const v = vs.find(x => x.id === b.dataset.jver); abrir(`Convocatoria ${v.piso} · ${c.nombre}`, [paginaConvocatoria(jsel, c, v, d, ad)]); });
    on('[data-jmail]', async (b) => { const v = vs.find(x => x.id === b.dataset.jmail); const { asunto, cuerpo } = textoEmail(jsel, c, v, d, ad);
      location.href = `mailto:${encodeURIComponent(v.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      await guardarEnv({ ...(jsel.envios || {}), [v.id]: { fecha: hoyISO(), via: 'Email' } }); });
    on('[data-jenv]', async (b) => { const env = { ...(jsel.envios || {}) }; if (env[b.dataset.jenv]) delete env[b.dataset.jenv]; else env[b.dataset.jenv] = { fecha: hoyISO(), via: 'Entregada' }; await guardarEnv(env); });
    on('[data-j=marcarTodos]', async () => { const env = { ...(jsel.envios || {}) }; vs.forEach(v => { if (!env[v.id]) env[v.id] = { fecha: hoyISO(), via: 'Entregada' }; }); await guardarEnv(env); });
    on('[data-j=borrar]', async () => { if (await confirmar('Borrar junta', `¿Borrar la junta del ${fecha(jsel.fecha)}? No se puede deshacer.`)) { await db.del('f_juntas', jsel.id); st.junta = null; toast('Junta borrada'); refresh(); } });
  }
  on('[data-a=cobro]', () => vs.length ? formCobro(c, vs, d, null, refresh) : toast('Primero añade los vecinos'));
  on('[data-a=gasto]', () => formGasto(c, d, null, refresh));
  on('[data-celda]', (b) => { const [vid, m] = b.dataset.celda.split('|'); formCobro(c, vs, d, { vecinoId: vid, anio: st.anio, mes: Number(m) }, refresh); });
  on('[data-dcelda]', (b) => { const [vid, i] = b.dataset.dcelda.split('|'); formCobro(c, vs, d, { vecinoId: vid, derramaId: st.der, plazo: Number(i) }, refresh); });
  on('[data-a=masivo]', () => cobroMasivo(c, vs, d, refresh));
  on('[data-pagar]', async (b) => { const g = d.gastos.find(x => x.id === b.dataset.pagar); await db.put('f_gastos', { ...g, estado: 'pagado' }); toast('Marcado como pagado'); refresh(); });
  on('[data-edit]', (b) => { const [t, gid] = b.dataset.edit.split(':'); if (t === 'gasto') formGasto(c, d, d.gastos.find(x => x.id === gid), refresh); else formEditCobro(d.cobros.find(x => x.id === gid), refresh); });
  const mm = el.querySelector('#movM'); if (mm) mm.onchange = () => { st.movM = Number(mm.value); refresh(); };
  on('[data-mf]', (b) => { st.movF = b.dataset.mf; refresh(); });
  on('[data-der]', (b) => { st.der = b.dataset.der; refresh(); });
  on('[data-a=nuevaDer]', () => formDerrama(c, null, refresh));
  on('[data-a=editDer]', () => formDerrama(c, d.derramas.find(x => x.id === st.der), refresh));
  on('[data-a=pagoObra]', () => formGasto(c, d, null, refresh, { grupo: 'derrama', derramaId: st.der }));
  on('[data-a=csvCuotas]', async () => {
    const { csv, dec } = await import('../../backup.js'); const { descargar } = await import('../../ui.js');
    const rows = [['Piso', 'Propietario', 'Coeficiente', ...MESES, 'Pendiente']];
    vs.forEach(v => rows.push([v.piso, v.propietario, dec(v.coef), ...Array.from({ length: 12 }, (_, i) => { const e = estadoCuota(c, v, d.cobros, st.anio, i + 1); return e.pag ? dec(e.pag) : ''; }), dec(deudaVecino(c, v, d).total)]));
    descargar(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), `cuotas_${c.nombre.replace(/\W+/g, '_')}_${st.anio}.csv`); toast('Archivo descargado');
  });
  on('[data-a=calcCuotas]', () => {
    const div = c.periodicidad === 'trimestral' ? 4 : 12;
    modal({ title: 'Calcular cuotas desde el presupuesto', submit: 'Aplicar a todos',
      body: `<div class="fgrid">${money('Presupuesto anual (€)', 'pres', totalPresupuesto(c, new Date().getFullYear()), { hint: 'Por defecto, el total del presupuesto por partidas de este año' })}${field('Aplicar desde', 'desde', hoyISO().slice(0, 7), { type: 'month' })}</div>
        <table><thead><tr><th>Piso</th><th class="r">Coef.</th><th class="r">Cuota actual</th><th class="r">Nueva</th></tr></thead><tbody id="tcalc"></tbody></table>`,
      onSubmit: async (f) => { const x = fd(f); const pres = num(x.pres);
        for (const v of vs) { const nueva = Math.round(pres * v.coef / 100 / div * 100) / 100; const h = (v.cuotaHistorial || []).slice(); if (!h.length && v.cuota) h.push({ desde: c.cobrosDesde || '2000-01', importe: Number(v.cuota) }); const i = h.findIndex(q => q.desde === x.desde); if (i >= 0) h[i].importe = nueva; else h.push({ desde: x.desde, importe: nueva }); await db.put('f_vecinos', { ...v, cuota: nueva, cuotaHistorial: h }); }
        toast('Cuotas actualizadas'); refresh(); } });
    const ip = document.querySelector('[name=pres]'), tb = document.getElementById('tcalc');
    const pinta = () => { const pres = num(ip.value); tb.innerHTML = vs.map(v => `<tr><td>${esc(v.piso)}</td><td class="r num">${coefTxt(v.coef)}</td><td class="r num">${eur(v.cuota || 0)}</td><td class="r num b">${eur(Math.round(pres * v.coef / 100 / div * 100) / 100)}</td></tr>`).join(''); };
    ip.oninput = pinta; pinta();
  });
  on('[data-a=subirCuotas]', () => {
    modal({ title: 'Cambiar todas las cuotas', submit: 'Aplicar',
      body: `<div class="fgrid">${field('Porcentaje (%)', 'pct', '10', { inputmode: 'decimal', hint: 'Negativo para bajar' })}${field('A partir de', 'desde', hoyISO().slice(0, 7), { type: 'month' })}${select('Redondeo', 'red', '2', [['2', 'Céntimos'], ['1', 'Décimas'], ['0', 'Euros']])}</div>`,
      onSubmit: async (f) => { const x = fd(f); const k = 1 + num(x.pct) / 100, p = Math.pow(10, Number(x.red));
        for (const v of vs) { const base = cuotaEn(v, Number(x.desde.slice(0, 4)), Number(x.desde.slice(5, 7))); const nueva = Math.round(base * k * p) / p; const h = (v.cuotaHistorial || []).slice(); if (!h.length && v.cuota) h.push({ desde: c.cobrosDesde || '2000-01', importe: Number(v.cuota) }); const i = h.findIndex(q => q.desde === x.desde); if (i >= 0) h[i].importe = nueva; else h.push({ desde: x.desde, importe: nueva }); await db.put('f_vecinos', { ...v, cuota: nueva, cuotaHistorial: h }); }
        toast('Cuotas actualizadas'); refresh(); } });
  });
}
