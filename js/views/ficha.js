import { db, borrarPropiedad } from '../db.js';
import { esc, eur, num, fmtNum, modal, confirmar, field, select, textarea, money, fd, toast, fecha, fechaCorta, hoyISO, MESES, MES3, tamano, diasEntre, descargar, ICON } from '../ui.js';
import { contratoActivo, deudaContrato, balanceAnual, estadoMes, esperado, rentaEn, cubreMes, CATEGORIAS_GASTO, TIPOS_DOC, DOCS_INQUILINO } from '../calc.js';
import { formPropiedad } from './propiedades.js';
import { guardarArchivo, elegirArchivos, abrirDoc } from '../files.js';

const TABS = [['resumen', 'Resumen'], ['balance', 'Balance'], ['inquilino', 'Inquilino y contrato'], ['pagos', 'Cobros'], ['gastos', 'Gastos'], ['documentos', 'Documentos'], ['historico', 'Histórico'], ['notas', 'Notas']];
const state = { anio: new Date().getFullYear(), movF: 'todos' };
const urls = [];
const tipoDoc = (t) => (TIPOS_DOC.find(x => x[0] === t) || [, 'Otro'])[1];

export async function render([id, tab = 'resumen'], d) {
  urls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const p = d.props.find(x => x.id === id);
  if (!p) return `<div class="page"><a class="back" href="#/propiedades">← Propiedades</a><div class="card empty"><h2>No se encuentra la propiedad</h2></div></div>`;
  const c = contratoActivo(d.contratos, p.id);
  const inq = c ? d.inq(c.inquilinoId) : null;
  const deuda = c ? deudaContrato(c, d.pagos) : { total: 0, detalle: [] };
  const gastosP = d.gastos.filter(g => g.propiedadId === p.id);
  const lim = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const pendPagar = gastosP.filter(g => g.estado === 'pendiente' && g.fecha && g.fecha <= lim);
  const bal = balanceAnual(state.anio, d.pagos, d.gastos, p.id);
  const ctx = { p, c, inq, deuda, gastosP, pendPagar, bal, d };
  const body = { resumen, balance, inquilino, pagos, gastos, documentos, historico, notas }[tab] || resumen;
  return `<div class="page">
  <a class="back" href="#/propiedades">← Propiedades</a>
  <div class="head"><div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1>${esc(p.direccion)}</h1>
    <span class="badge ${!c ? 'neutral' : deuda.total > 0.005 ? 'bad' : 'ok'}">${!c ? 'Libre' : deuda.total > 0.005 ? 'Alquilada · con deuda' : 'Alquilada · al día'}</span></div>
    <div class="sub">${esc([p.tipo, p.zona, p.m2 ? p.m2 + ' m²' : '', p.habitaciones ? p.habitaciones + ' hab.' : ''].filter(Boolean).join(' · '))}</div></div>
    <div class="actions"><button class="btn" data-a="editarProp">Editar</button><button class="btn" data-a="gasto">+ Gasto</button>${c ? '<button class="btn primary" data-a="cobro">+ Cobro</button>' : '<button class="btn primary" data-a="contrato">+ Alquilar</button>'}</div></div>
  <section class="kpis" aria-label="Datos clave">
    <div class="card kpi"><div class="l">Inquilino</div><div style="font-weight:700;margin-top:6px">${inq ? esc(inq.nombre) : '—'}</div></div>
    <div class="card kpi"><div class="l">Renta</div><div style="font-weight:700;margin-top:6px" class="num">${c ? eur(c.renta) + '/mes' : '—'}</div></div>
    <div class="card kpi"><div class="l">Contrato hasta</div><div style="font-weight:700;margin-top:6px">${c ? fecha(c.fin) : '—'}</div></div>
    <div class="card kpi"><div class="l">Margen ${state.anio}</div><div style="font-weight:700;margin-top:6px" class="num ${bal.margen < 0 ? 'neg' : ''}">${eur(bal.margen)}${bal.ing ? ' · ' + Math.round(bal.pct * 100) + ' %' : ''}</div></div>
  </section>
  ${(deuda.total > 0.005 || pendPagar.length) ? `<div class="row">${deuda.total > 0.005 ? `<div class="strip bad grow1"><div style="flex:1"><div class="l">Pendiente de cobrar</div><b class="num">${eur(deuda.total)}</b> · ${resumenDeuda(deuda.detalle)}</div><a class="btn sm" href="#/propiedad/${p.id}/pagos">Ver cobros</a></div>` : ''}
    ${pendPagar.length ? `<div class="strip warn grow1"><div style="flex:1"><div class="l">Pendiente de pagar</div><b class="num">${eur(pendPagar.reduce((a, g) => a + Number(g.importe || 0), 0))}</b> · ${pendPagar.slice(0, 3).map(g => esc(g.concepto)).join(', ')}</div><a class="btn sm" href="#/propiedad/${p.id}/gastos">Ver gastos</a></div>` : ''}</div>` : ''}
  <nav class="tabs" aria-label="Secciones">${TABS.map(([k, l]) => `<a href="#/propiedad/${p.id}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  ${body(ctx)}
  </div>`;
}

export function resumenDeuda(det) {
  if (det.length <= 4) return det.map(x => MES3[x.m - 1] + ' ' + String(x.y).slice(2) + (x.concepto === 'basura' ? ' (basura)' : '')).join(', ');
  const a = det[0], z = det[det.length - 1];
  return `${det.length} recibos sin cobrar, de ${MES3[a.m - 1].toLowerCase()} ${a.y} a ${MES3[z.m - 1].toLowerCase()} ${z.y}`;
}
const yearSel = () => { const y0 = new Date().getFullYear(); return `<label class="sr" for="anio">Año</label><select id="anio" class="inp" style="width:auto">${[y0 + 1, y0, y0 - 1, y0 - 2, y0 - 3].map(y => `<option ${y === state.anio ? 'selected' : ''}>${y}</option>`).join('')}</select>`; };

function resumen({ p, bal, d }) {
  const inv = (Number(p.precioCompra) || 0) + (Number(p.gastosCompra) || 0);
  const porTipo = {};
  d.gastos.filter(g => g.propiedadId === p.id && g.fecha && Number(g.fecha.slice(0, 4)) === state.anio).forEach(g => { porTipo[g.categoria] = (porTipo[g.categoria] || 0) + Number(g.importe || 0); });
  return `<div class="row">
  <section class="card pad stack grow2"><div class="head" style="align-items:center"><h2>Margen ${state.anio}</h2>${yearSel()}</div>
    <div class="kpis"><div style="padding:14px;border-radius:10px;background:var(--ok-bg)"><div class="small" style="color:var(--ok)">Ingresos</div><div class="num" style="font:600 22px 'Space Grotesk', sans-serif">${eur(bal.ing)}</div></div>
    <div style="padding:14px;border-radius:10px;background:var(--warn-bg)"><div class="small" style="color:var(--warn)">Gastos</div><div class="num" style="font:600 22px 'Space Grotesk', sans-serif">${eur(bal.gas)}</div></div>
    <div style="padding:14px;border-radius:10px;background:var(--accent);color:#fff"><div class="small" style="color:#D7E9E1">Margen</div><div class="num" style="font:600 22px 'Space Grotesk', sans-serif">${eur(bal.margen)}</div></div></div>
    ${bal.ing || bal.gas ? `<div class="split" aria-hidden="true"><span style="width:${Math.max(0, bal.pct * 100)}%;background:var(--accent)"></span><span style="flex:1;background:var(--gas)"></span></div>` : ''}
    <table><thead><tr><th>Gastos por tipo</th><th class="r">Importe</th></tr></thead><tbody>
    ${Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${eur(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Sin gastos este año</td></tr>'}
    </tbody></table>
    <div class="small muted">Margen = ingresos cobrados − gastos del año. ${inv ? `Sobre la inversión (${eur(inv, 0)}) supone un ${(bal.margen / inv * 100).toFixed(1).replace('.', ',')} % anual.` : 'Añade el precio de compra para ver la rentabilidad sobre la inversión.'}</div>
  </section>
  <section class="card pad stack grow1"><div class="head" style="align-items:center"><h2>Datos del inmueble</h2><button class="linkbtn" data-a="editarProp">Editar</button></div>
    <dl class="dl">
      <dt>Ref. catastral</dt><dd>${esc(p.refCatastral) || '—'}</dd>
      <dt>Compra</dt><dd class="num">${p.fechaCompra ? fecha(p.fechaCompra) : '—'}${p.precioCompra ? ' · ' + eur(p.precioCompra, 0) : ''}</dd>
      <dt>Gastos compra</dt><dd class="num">${p.gastosCompra ? eur(p.gastosCompra, 0) : '—'}</dd>
      <dt>Valor actual</dt><dd class="num">${p.valorActual ? eur(p.valorActual, 0) : '—'}</dd>
      <dt>Comunidad</dt><dd>${esc(p.comunidadAdmin) || '—'}</dd>
      <dt>Seguro</dt><dd>${esc(p.seguro) || '—'}${p.seguroVence ? ' · vence ' + fecha(p.seguroVence) : ''}</dd>
      <dt>Cert. energético</dt><dd>${esc(p.certEnergetico) || '—'}</dd>
    </dl>
    ${p.obs ? `<div class="small" style="white-space:pre-line">${esc(p.obs)}</div>` : ''}
    <button class="btn danger sm" data-a="borrarProp" style="align-self:flex-start;margin-top:8px">Borrar propiedad</button>
  </section></div>`;
}

function movimientos(p, d) {
  const M = [];
  d.pagos.filter(x => x.propiedadId === p.id).forEach(x => M.push({ tipo: 'pago', id: x.id, f: x.fecha || `${x.anio}-${String(x.mes).padStart(2, '0')}-01`, c: (x.concepto === 'basura' ? 'Basura ' : 'Renta ') + MESES[x.mes - 1].toLowerCase() + ' ' + x.anio + (x.forma ? ' · ' + x.forma : ''), cat: 'Cobro', cls: 'ok', v: Number(x.importe) || 0 }));
  d.gastos.filter(x => x.propiedadId === p.id && x.fecha).forEach(x => M.push({ tipo: 'gasto', id: x.id, f: x.fecha, c: x.concepto + (x.estado === 'pendiente' ? ' (pendiente)' : ''), cat: x.categoria, cls: x.estado === 'pendiente' ? 'warn' : 'neutral', v: -(Number(x.importe) || 0) }));
  return M.filter(m => Number(m.f.slice(0, 4)) === state.anio).sort((a, b) => a.f < b.f ? -1 : 1);
}

function balance({ p, bal, d }) {
  let acu = 0;
  const max = Math.max(1, ...bal.meses.map(m => Math.max(m.ing, m.gas)));
  const filas = bal.meses.map((m, i) => { acu += m.ing - m.gas; return `<tr><td class="b">${MESES[i]}</td><td class="r num ing b">${m.ing ? eur(m.ing) : '—'}</td><td class="r num gas">${m.gas ? eur(m.gas) : '—'}</td><td class="r num b ${m.ing - m.gas < 0 ? 'neg' : ''}">${eur(m.ing - m.gas)}</td>
    <td style="width:200px"><div class="bars"><span style="width:${m.ing / max * 100}%;background:var(--ing)"></span><span style="width:${Math.max(m.gas ? 2 : 0, m.gas / max * 100)}%;background:var(--gas)"></span></div></td><td class="r num muted">${eur(acu)}</td></tr>`; }).join('');
  let saldo = 0;
  const M = movimientos(p, d).map(m => { saldo += m.v; return { ...m, saldo }; });
  const vis = M.filter(m => state.movF === 'todos' || (state.movF === 'ing' ? m.v > 0 : m.v < 0)).reverse();
  return `<section class="card"><div class="cardhead"><div><h2>Balance ${state.anio} · ingresos y gastos por mes</h2><div class="small muted">Cobros por fecha de cobro y gastos por fecha de factura.</div></div>
    <div class="actions"><button class="btn sm" data-a="cobro">+ Ingreso</button><button class="btn sm" data-a="gasto">+ Gasto</button>${yearSel()}</div></div>
    <div class="tw"><table style="min-width:720px"><thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Resultado</th><th>Ingresos / gastos</th><th class="r">Acumulado</th></tr></thead>
    <tbody>${filas}<tr class="tot"><td>Total ${state.anio}</td><td class="r num ing">${eur(bal.ing)}</td><td class="r num gas">${eur(bal.gas)}</td><td class="r num">${eur(bal.margen)}</td><td class="small muted">${bal.ing ? 'Margen ' + Math.round(bal.pct * 100) + ' %' : ''}</td><td></td></tr></tbody></table></div></section>
  <section class="card"><div class="cardhead"><div><h2>Libro de movimientos</h2><div class="small muted">Del más reciente al más antiguo, con el saldo del año.</div></div>
    <div class="chips">${[['todos', 'Todos'], ['ing', 'Ingresos'], ['gas', 'Gastos']].map(([k, l]) => `<button class="chip ${state.movF === k ? 'on' : ''}" data-mf="${k}" aria-pressed="${state.movF === k}">${l}</button>`).join('')}</div></div>
    <div class="tw"><table style="min-width:720px"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="r">Ingreso</th><th class="r">Gasto</th><th class="r">Saldo</th><th></th></tr></thead><tbody>
    ${vis.map(m => `<tr><td class="nw num">${fecha(m.f)}</td><td class="b">${esc(m.c)}</td><td><span class="badge ${m.cls}">${esc(m.cat)}</span></td><td class="r num ing b">${m.v > 0 ? eur(m.v) : ''}</td><td class="r num gas b">${m.v < 0 ? eur(-m.v) : ''}</td><td class="r num">${eur(m.saldo)}</td>
      <td><button class="btn sm" data-edit="${m.tipo}:${m.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin movimientos este año</td></tr>'}
    </tbody></table></div></section>`;
}

function inquilino({ p, c, inq, d }) {
  if (!c) return `<div class="card empty"><h2>Sin inquilino</h2><p style="margin:0">Registra el contrato para empezar a controlar los cobros.</p><button class="btn primary" data-a="contrato">+ Alquilar (nuevo contrato)</button></div>`;
  const docs = d.documentos.filter(x => x.contratoId === c.id);
  const lista = DOCS_INQUILINO.map(t => { const ds = docs.filter(x => x.tipo === t); return { t, ds }; });
  const otros = docs.filter(x => !DOCS_INQUILINO.includes(x.tipo));
  const nOk = lista.filter(x => x.ds.length).length;
  const hist = (c.historialRenta || []).slice().sort((a, b) => a.desde < b.desde ? 1 : -1);
  return `<div class="row">
  <section class="card pad stack grow1"><div class="head" style="align-items:center"><h2>Inquilino</h2><button class="linkbtn" data-a="editInq">Editar</button></div>
    <dl class="dl"><dt>Nombre</dt><dd class="b">${esc(inq?.nombre)}</dd><dt>DNI / NIE</dt><dd>${esc(inq?.dni) || '—'}</dd><dt>Teléfono</dt><dd>${inq?.telefono ? `<a href="tel:${esc(inq.telefono)}">${esc(inq.telefono)}</a>` : '—'}</dd>
    <dt>Email</dt><dd>${inq?.email ? `<a href="mailto:${esc(inq.email)}">${esc(inq.email)}</a>` : '—'}</dd><dt>IBAN de pago</dt><dd>${esc(inq?.iban) || '—'}</dd><dt>Avalista</dt><dd>${esc(inq?.avalista) || '—'}</dd><dt>Idioma de las cartas</dt><dd>${inq?.idioma === 'ca' ? 'Català' : 'Castellano'}</dd></dl>
    <div class="small muted">El nombre y el IBAN servirán para reconocer sus pagos al importar el extracto del banco.</div></section>
  <section class="card pad stack grow1"><div class="head" style="align-items:center"><h2>Contrato</h2><button class="linkbtn" data-a="editContrato">Editar</button></div>
    <dl class="dl"><dt>Vigencia</dt><dd class="num">${fecha(c.inicio)} → ${fecha(c.fin)}</dd><dt>Renta</dt><dd class="num">${eur(c.renta)}/mes · pago antes del día ${esc(c.diaPago || 5)}</dd>
    <dt>Actualización</dt><dd>${c.actualizacion && c.actualizacion !== 'Ninguna' ? esc(c.actualizacion) + (c.mesActualizacion ? ' · cada ' + MESES[c.mesActualizacion - 1].toLowerCase() : '') : 'Sin actualización'}</dd>
    <dt>Fianza</dt><dd class="num">${c.fianza ? eur(c.fianza) : '—'}${c.fianzaDeposito ? ' · ' + esc(c.fianzaDeposito) : ''}</dd>
    <dt>Basura</dt><dd>${c.basuraPaga === 'inquilino' ? 'La paga el inquilino · ' + eur(c.basuraImporte) + '/mes' : 'La paga el propietario'}</dd></dl>
    ${hist.length ? `<div class="small"><b>Historial de renta:</b> ${hist.map(h => `${eur(h.importe)} desde ${MES3[Number(h.desde.slice(5, 7)) - 1]} ${h.desde.slice(0, 4)}`).join(' · ')}</div>` : ''}
    <div class="actions"><button class="btn sm" data-a="actualizarRenta">Actualizar renta</button><button class="btn sm" data-a="finalizar">Finalizar contrato</button></div></section></div>
  <section class="card pad stack" style="margin-top:20px"><div class="head" style="align-items:center"><div><h2>Documentación del inquilino</h2><div class="small muted">${nOk} de ${DOCS_INQUILINO.length} tipos entregados</div></div>
    <button class="btn sm" data-a="subirInq">Subir documentos</button></div>
    <div class="docs">${lista.map(({ t, ds }) => `<div class="doc" style="flex-direction:row;align-items:center;gap:10px;padding:10px;border-color:${ds.length ? 'var(--line2)' : '#F2C2BE'};background:${ds.length ? '#fff' : '#FDF3F2'}">
      <div style="flex:1;min-width:0"><div class="b" style="font-size:13.5px">${tipoDoc(t)}</div><div class="small muted">${ds.length ? ds.map(x => esc(x.nombre)).join(', ') : 'Falta'}</div></div>
      ${ds.length ? `<button class="btn sm" data-ver="${ds[0].id}">Ver</button>` : `<button class="btn sm primary" data-subir="${t}">Subir</button>`}</div>`).join('')}</div>
    ${otros.length ? `<div class="small">Otros documentos del contrato: ${otros.map(x => `<button class="linkbtn" data-ver="${x.id}">${esc(x.nombre)}</button>`).join(' · ')}</div>` : ''}
  </section>`;
}

function pagos({ p, c, d }) {
  const cs = d.contratos.filter(x => x.propiedadId === p.id && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some(m => cubreMes(x, state.anio, m)));
  if (!cs.length) return `<div class="card empty"><h2>Sin contrato en ${state.anio}</h2>${yearSel()}${!c ? '<button class="btn primary" data-a="contrato">+ Alquilar</button>' : ''}</div>`;
  const filas = [];
  cs.forEach(k => {
    const inq = d.inq(k.inquilinoId);
    const conceptos = ['renta'].concat(k.basuraPaga === 'inquilino' ? ['basura'] : []);
    conceptos.forEach(con => {
      filas.push(`<div class="rh">${con === 'renta' ? 'Renta' : 'Basura'}${cs.length > 1 ? `<div class="small muted">${esc(inq?.nombre || '')}</div>` : ''}</div>` +
        Array.from({ length: 12 }, (_, i) => {
          const e = estadoMes(k, d.pagos, state.anio, i + 1, con);
          const pg = d.pagos.filter(x => x.contratoId === k.id && x.anio === state.anio && x.mes === i + 1 && x.concepto === con).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
          if (e.estado === 'previo') return `<div class="cell na" title="Anterior al control de cobros" style="font-weight:500">${e.pag ? fmtNum(e.pag) : ''}</div>`;
          const cls = { na: 'na', pagado: 'paid', parcial: 'part', debe: 'due', futuro: '', pendiente: '' }[e.estado];
          const txt = e.estado === 'na' ? '' : e.pag ? fmtNum(e.pag) : (e.estado === 'debe' ? '' : '·');
          const sub = e.pag ? fechaCorta(pg[0]?.fecha) : (e.estado === 'debe' ? '' : e.estado === 'na' ? '' : fmtNum(e.esp));
          const tip = e.estado === 'na' ? 'Sin contrato este mes' : `${MESES[i]}: ${e.pag ? 'cobrado ' + eur(e.pag) : 'sin cobrar'} de ${eur(e.esp)}`;
          return e.estado === 'na' ? `<div class="cell na" title="${tip}"></div>` : `<button type="button" class="cell ${cls}" data-celda="${k.id}|${i + 1}|${con}" title="${tip}" aria-label="${tip}"><span class="num">${txt}</span><small>${sub}</small></button>`;
        }).join(''));
    });
  });
  const cob = d.pagos.filter(x => x.propiedadId === p.id && x.anio === state.anio).reduce((a, x) => a + Number(x.importe || 0), 0);
  return `<section class="card pad stack"><div class="head" style="align-items:center"><h2>Cobros ${state.anio}</h2><div class="actions">${yearSel()}${c ? '<button class="btn primary" data-a="cobro">+ Registrar cobro</button>' : ''}</div></div>
    <div class="tw"><div class="pgrid"><div></div>${MES3.map(m => `<div class="mh">${m}</div>`).join('')}${filas.join('')}</div></div>
    <div class="legend"><span><i style="background:#EEF7F0;border-color:#CFE6D5"></i>Cobrado (importe y fecha)</span><span><i style="background:#fff;border:2px solid #E0B4AF"></i>Vencido sin cobrar</span><span><i style="background:var(--warn-bg)"></i>Cobro parcial</span><span><i style="background:#F7F6F2"></i>Aún no vence (importe esperado)</span><span><i style="background:transparent;border-style:dashed"></i>Sin contrato o anterior al control</span></div>
    <div class="small muted">Pulsa una casilla para registrar, ver o borrar sus cobros. Cobrado en ${state.anio}: <b class="num">${eur(cob)}</b></div></section>`;
}

function gastos({ p, gastosP }) {
  const g = gastosP.filter(x => x.fecha && Number(x.fecha.slice(0, 4)) === state.anio).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const tot = g.reduce((a, x) => a + Number(x.importe || 0), 0), pend = g.filter(x => x.estado === 'pendiente').reduce((a, x) => a + Number(x.importe || 0), 0);
  return `<section class="card"><div class="cardhead"><h2>Gastos ${state.anio}</h2><div class="actions">${yearSel()}<button class="btn primary" data-a="gasto">+ Añadir gasto</button></div></div>
    <div class="tw"><table style="min-width:760px"><thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Proveedor</th><th class="r">Importe</th><th>Estado</th><th>Factura</th><th></th></tr></thead><tbody>
    ${g.map(x => `<tr><td class="nw num">${fecha(x.fecha)}</td><td><span class="badge neutral">${esc(x.categoria)}</span></td><td class="b">${esc(x.concepto)}</td><td class="muted">${esc(x.proveedor) || '—'}</td><td class="r num b">${eur(x.importe)}</td>
      <td>${x.estado === 'pendiente' ? `<button class="badge warn" style="border:0;cursor:pointer" data-pagar="${x.id}" title="Marcar como pagado">Pendiente · marcar pagado</button>` : '<span class="badge ok">Pagado</span>'}</td>
      <td>${x.docId ? `<button class="linkbtn" data-ver="${x.docId}">Ver</button>` : '—'}</td><td><button class="btn sm" data-edit="gasto:${x.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sin gastos este año</td></tr>'}
    </tbody></table></div>
    <div class="cardfoot" style="display:flex;justify-content:space-between;color:var(--ink);font-weight:700"><span>Total ${state.anio}</span><span class="num">${eur(tot)}${pend ? ` <span class="muted" style="font-weight:500">(pendiente ${eur(pend)})</span>` : ''}</span></div></section>`;
}

function documentos({ p, d }) {
  const docs = d.documentos.filter(x => x.propiedadId === p.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return `<section class="card pad stack"><div class="head" style="align-items:center"><h2>Documentos y fotos</h2><div class="actions"><button class="btn" data-a="foto">Hacer foto</button><button class="btn primary" data-a="subir">+ Subir</button></div></div>
    <div class="drop" id="drop">${ICON.up}<div><b>Arrastra aquí</b> PDF o fotos, o pulsa «Subir»</div><div class="small">Las fotos se reducen a 1600 px (unos 300 KB) al guardarlas.</div></div>
    <div class="docs">${docs.map(x => { let bg = ''; if (x.mime?.startsWith('image/') && x.blob) { const u = URL.createObjectURL(x.blob); urls.push(u); bg = `background-image:url('${u}')`; }
      return `<div class="doc"><div class="th" style="${bg}">${bg ? '' : (x.mime === 'application/pdf' ? 'PDF' : 'ARCHIVO')}</div><div class="bd"><div class="b" style="font-size:13px;overflow-wrap:anywhere">${esc(x.nombre)}</div><div class="small muted">${tipoDoc(x.tipo)} · ${tamano(x.size || 0)} · ${fecha(x.fecha)}</div>
      <div class="actions"><button class="btn sm" data-ver="${x.id}">Ver</button><button class="btn sm" data-bajar="${x.id}">Descargar</button><button class="btn sm" data-editdoc="${x.id}">Editar</button></div></div></div>`; }).join('') || '<div class="muted">Todavía no hay documentos.</div>'}</div></section>`;
}

function historico({ p, d }) {
  const cs = d.contratos.filter(x => x.propiedadId === p.id).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  return `<section class="card"><div class="cardhead"><h2>Histórico de inquilinos</h2></div><div class="tw"><table style="min-width:680px"><thead><tr><th>Inquilino</th><th>Periodo</th><th class="r">Renta</th><th>Fianza</th><th>Salida</th><th></th></tr></thead><tbody>
    ${cs.map(k => { const i = d.inq(k.inquilinoId); const act = k.estado !== 'finalizado';
      return `<tr><td class="b">${esc(i?.nombre || '—')} ${act ? '<span class="badge ok">Actual</span>' : ''}</td><td class="num nw">${fecha(k.inicio)} – ${act ? 'hoy' : fecha(k.fechaSalida || k.fin)}</td><td class="r num">${eur(k.renta)}</td>
      <td class="small">${act ? (k.fianza ? eur(k.fianza) + ' depositada' : '—') : (k.fianzaDevuelta != null && k.fianzaDevuelta !== '' ? 'Devuelta ' + eur(k.fianzaDevuelta) : '—')}</td><td class="small">${esc(k.motivoSalida) || (act ? '—' : '')}</td>
      <td class="nw">${act ? '' : `<button class="btn sm" data-reabrir="${k.id}">Reabrir</button> `}<button class="btn sm danger" data-borrarc="${k.id}">Borrar</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Sin contratos registrados</td></tr>'}
    </tbody></table></div><div class="cardfoot">Al borrar un contrato se borran también sus cobros.</div></section>`;
}

function notas({ p, d }) {
  const ns = d.notas.filter(x => x.propiedadId === p.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return `<section class="card pad stack"><h2>Anotaciones</h2>
    <form id="fnota" class="row" style="gap:10px;align-items:flex-end"><label class="field" style="flex:1 1 320px">Nueva anotación<input name="texto" required placeholder="Ej.: avisa de humedad en el baño"></label>
    <label class="field" style="flex:0 1 180px">Etiqueta<select name="etiqueta"><option value="">—</option><option>Incidencia</option><option>Cobro</option><option>Contrato</option><option>Reparación</option></select></label><button class="btn primary">Guardar</button></form>
    ${ns.map(n => `<div class="note"><div class="f num">${fecha(n.fecha)}</div><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="white-space:pre-line">${esc(n.texto)}</div>${n.etiqueta ? `<span class="badge info" style="align-self:flex-start">${esc(n.etiqueta)}</span>` : ''}</div><button class="btn sm" data-editnota="${n.id}">Editar</button></div>`).join('') || '<div class="muted">Sin anotaciones.</div>'}
  </section>`;
}

/* ---------- Formularios ---------- */

function formContrato(p, d, c, done) {
  const v = c || { inicio: hoyISO(), diaPago: 5, actualizacion: 'IRAV', basuraPaga: 'propietario' };
  const i = c ? d.inq(c.inquilinoId) || {} : {};
  const otros = d.inqs.filter(x => !c || x.id !== c.inquilinoId);
  modal({
    title: c ? 'Editar contrato e inquilino' : 'Nuevo contrato', wide: true,
    body: `${!c && otros.length ? select('Inquilino', 'inqSel', 'nuevo', [['nuevo', '— Nuevo inquilino —'], ...otros.map(x => [x.id, x.nombre])], { span2: true, hint: 'Elige uno que ya tengas o crea uno nuevo' }) : ''}
    <fieldset class="box" id="nuevoInq" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><legend>Datos del inquilino</legend>
      ${field('Nombre y apellidos', 'nombre', i.nombre, { required: true })}${field('DNI / NIE', 'dni', i.dni)}${field('Teléfono', 'telefono', i.telefono, { type: 'tel' })}${field('Email', 'email', i.email, { type: 'email' })}
      ${field('IBAN desde el que paga', 'iban', i.iban)}${field('Avalista', 'avalista', i.avalista)}${select('Idioma de las cartas', 'idioma', i.idioma || 'es', [['es', 'Castellano'], ['ca', 'Català']])}</fieldset>
    <div class="fgrid">
      ${field('Inicio', 'inicio', v.inicio, { type: 'date', required: true })}${field('Fin', 'fin', v.fin, { type: 'date' })}
      ${money('Renta mensual (€)', 'renta', v.renta, { required: true })}${field('Día de pago (antes del)', 'diaPago', v.diaPago, { inputmode: 'numeric' })}
      ${select('Actualización anual', 'actualizacion', v.actualizacion, ['IRAV', 'IPC', 'Ninguna'], { hint: 'Contratos de vivienda desde 26/05/2023: IRAV' })}
      ${select('Mes de actualización', 'mesActualizacion', v.mesActualizacion || '', [['', 'El del aniversario del contrato'], ...MESES.map((m, k) => [k + 1, m])])}
      ${field('Controlar cobros desde', 'cobrosDesde', v.cobrosDesde || '', { type: 'month', hint: 'Los meses anteriores se dan por cobrados. Útil si el contrato es antiguo.' })}
      ${money('Fianza (€)', 'fianza', v.fianza)}${field('Dónde está depositada', 'fianzaDeposito', v.fianzaDeposito, { placeholder: 'Organismo autonómico…' })}
      ${select('¿Quién paga la basura?', 'basuraPaga', v.basuraPaga, [['propietario', 'Propietario'], ['inquilino', 'Inquilino (se le cobra)']])}${money('Basura que se cobra (€/mes)', 'basuraImporte', v.basuraImporte)}
    </div>`,
    onSubmit: async (form) => {
      const x = fd(form);
      if (!x.inicio || !num(x.renta)) { toast('Faltan la fecha de inicio o la renta'); return false; }
      let inqId = c ? c.inquilinoId : null;
      if (!c && x.inqSel && x.inqSel !== 'nuevo') inqId = x.inqSel;
      else {
        if (!x.nombre.trim()) { toast('Falta el nombre del inquilino'); return false; }
        const inqObj = await db.put('inquilinos', { ...(c ? i : {}), nombre: x.nombre.trim(), dni: x.dni, telefono: x.telefono, email: x.email, iban: x.iban, avalista: x.avalista, idioma: x.idioma });
        inqId = inqObj.id;
      }
      const obj = { ...v, propiedadId: p.id, inquilinoId: inqId, inicio: x.inicio, fin: x.fin, renta: num(x.renta), diaPago: Number(x.diaPago) || 5, actualizacion: x.actualizacion,
        mesActualizacion: x.mesActualizacion ? Number(x.mesActualizacion) : (x.actualizacion !== 'Ninguna' ? Number(x.inicio.slice(5, 7)) : ''), fianza: num(x.fianza), fianzaDeposito: x.fianzaDeposito, basuraPaga: x.basuraPaga, basuraImporte: num(x.basuraImporte), estado: v.estado || 'activo',
        cobrosDesde: x.cobrosDesde || (() => { const ini = x.inicio.slice(0, 7); const hace12 = new Date(); hace12.setMonth(hace12.getMonth() - 12); const lim = hace12.toISOString().slice(0, 7); return ini >= lim ? ini : new Date().getFullYear() + '-01'; })() };
      await db.put('contratos', obj); toast('Contrato guardado'); done();
    },
  });
  const sel = document.querySelector('[name=inqSel]');
  if (sel) { const box = document.getElementById('nuevoInq'); const upd = () => { box.style.display = sel.value === 'nuevo' ? 'grid' : 'none'; box.querySelector('[name=nombre]').required = sel.value === 'nuevo'; }; sel.onchange = upd; upd(); }
}

function formInquilino(i, done) {
  modal({ title: 'Editar inquilino', body: `<div class="fgrid">${field('Nombre y apellidos', 'nombre', i.nombre, { required: true })}${field('DNI / NIE', 'dni', i.dni)}${field('Teléfono', 'telefono', i.telefono, { type: 'tel' })}${field('Email', 'email', i.email, { type: 'email' })}${field('IBAN desde el que paga', 'iban', i.iban)}${field('Avalista', 'avalista', i.avalista)}${select('Idioma de las cartas', 'idioma', i.idioma || 'es', [['es', 'Castellano'], ['ca', 'Català']])}</div>`,
    onSubmit: async (f) => { const x = fd(f); if (!x.nombre.trim()) { toast('Falta el nombre'); return false; } await db.put('inquilinos', { ...i, ...x }); toast('Inquilino guardado'); done(); } });
}

function formCobro(p, c, d, pre, done) {
  const hoy = hoyISO();
  const y0 = pre?.anio || Number(hoy.slice(0, 4)), m0 = pre?.mes || Number(hoy.slice(5, 7));
  const k = pre?.contratoId ? d.contratos.find(x => x.id === pre.contratoId) : c;
  const existentes = pre ? d.pagos.filter(x => x.contratoId === k.id && x.anio === y0 && x.mes === m0 && x.concepto === pre.concepto) : [];
  const conceptoOpts = k.basuraPaga === 'inquilino' ? [['ambos', 'Renta + basura'], ['renta', 'Renta'], ['basura', 'Basura']] : [['renta', 'Renta']];
  const falta = (con) => Math.max(0, esperado(k, y0, m0, con) - d.pagos.filter(x => x.contratoId === k.id && x.anio === y0 && x.mes === m0 && x.concepto === con).reduce((a, x) => a + Number(x.importe || 0), 0));
  const con0 = pre?.concepto || (conceptoOpts[0][0]);
  const imp0 = con0 === 'ambos' ? falta('renta') + falta('basura') : falta(con0);
  modal({
    title: 'Registrar cobro', submit: 'Guardar cobro',
    body: `<div class="small muted">${esc(p.direccion)} · ${esc(d.inq(k.inquilinoId)?.nombre || '')}</div>
    ${existentes.length ? `<div class="stack"><b>Cobros ya registrados en ${MESES[m0 - 1].toLowerCase()} ${y0}</b>${existentes.map(x => `<div class="alert" style="align-items:center"><div style="flex:1"><b class="num">${eur(x.importe)}</b> el ${fecha(x.fecha)}${x.forma ? ' · ' + esc(x.forma) : ''}${x.nota ? ' · ' + esc(x.nota) : ''}</div><button type="button" class="btn sm danger" data-delpago="${x.id}">Borrar</button></div>`).join('')}</div>` : ''}
    <div class="fgrid">
      ${select('Concepto', 'concepto', con0, conceptoOpts)}
      ${select('Mes que paga', 'mes', `${y0}-${m0}`, (() => { const o = []; for (let yy = y0 - 1; yy <= y0 + 1; yy++) for (let mm = 1; mm <= 12; mm++) if (cubreMes(k, yy, mm)) o.push([`${yy}-${mm}`, `${MESES[mm - 1]} ${yy}`]); return o; })())}
      ${money('Importe (€)', 'importe', imp0 || '', { required: true, hint: `Esperado: ${eur(esperado(k, y0, m0, 'renta'))} de renta${k.basuraPaga === 'inquilino' ? ' + ' + eur(k.basuraImporte) + ' de basura' : ''}` })}
      ${field('Fecha de cobro', 'fecha', hoy, { type: 'date', required: true })}
      ${select('Forma de pago', 'forma', 'Transferencia', ['Transferencia', 'Bizum', 'Efectivo', 'Domiciliación', 'Otro'])}
      ${field('Nota', 'nota', '', { placeholder: 'Opcional' })}
    </div>`,
    onSubmit: async (f) => {
      const x = fd(f); const imp = num(x.importe); if (!imp) { toast('Indica el importe'); return false; }
      const [yy, mm] = x.mes.split('-').map(Number);
      const base = { contratoId: k.id, propiedadId: p.id, anio: yy, mes: mm, fecha: x.fecha, forma: x.forma, nota: x.nota };
      if (x.concepto === 'ambos') {
        const fr = Math.max(0, esperado(k, yy, mm, 'renta') - d.pagos.filter(q => q.contratoId === k.id && q.anio === yy && q.mes === mm && q.concepto === 'renta').reduce((a, q) => a + Number(q.importe || 0), 0));
        const r = Math.min(imp, fr || imp), b = Math.round((imp - r) * 100) / 100;
        await db.put('pagos', { ...base, concepto: 'renta', importe: r });
        if (b > 0) await db.put('pagos', { ...base, concepto: 'basura', importe: b });
      } else await db.put('pagos', { ...base, concepto: x.concepto, importe: imp });
      toast('Cobro guardado'); done();
    },
  });
  document.querySelectorAll('[data-delpago]').forEach(b => b.onclick = async () => { await db.del('pagos', b.dataset.delpago); toast('Cobro borrado'); document.getElementById('modal-root').innerHTML = ''; done(); });
  const fs = document.querySelector('[name=concepto]'), fm = document.querySelector('[name=mes]'), fi = document.querySelector('[name=importe]');
  const upd = () => { const [yy, mm] = fm.value.split('-').map(Number); const fa = (con) => Math.max(0, esperado(k, yy, mm, con) - d.pagos.filter(q => q.contratoId === k.id && q.anio === yy && q.mes === mm && q.concepto === con).reduce((a, q) => a + Number(q.importe || 0), 0)); const v = fs.value === 'ambos' ? fa('renta') + fa('basura') : fa(fs.value); fi.value = v ? fmtNum(v) : ''; };
  fs.onchange = upd; fm.onchange = upd;
}

function formPago(pg, d, done) {
  modal({ title: 'Editar cobro', extra: '<button type="button" class="btn danger" data-del>Borrar</button>',
    body: `<div class="fgrid">${select('Concepto', 'concepto', pg.concepto, [['renta', 'Renta'], ['basura', 'Basura']])}${money('Importe (€)', 'importe', pg.importe, { required: true })}${field('Fecha de cobro', 'fecha', pg.fecha, { type: 'date' })}${select('Forma de pago', 'forma', pg.forma, ['Transferencia', 'Bizum', 'Efectivo', 'Domiciliación', 'Otro'])}${field('Nota', 'nota', pg.nota)}</div>`,
    onSubmit: async (f) => { const x = fd(f); await db.put('pagos', { ...pg, ...x, importe: num(x.importe) }); toast('Cobro guardado'); done(); } });
  document.querySelector('[data-del]').onclick = async () => { if (await confirmar('Borrar cobro', '¿Seguro que quieres borrar este cobro?')) { await db.del('pagos', pg.id); toast('Cobro borrado'); done(); } };
}

function formGasto(p, g, done) {
  const v = g || { fecha: hoyISO(), categoria: 'Comunidad', estado: 'pagado' };
  let archivo = null;
  modal({
    title: g ? 'Editar gasto' : 'Añadir gasto', wide: true, extra: g ? '<button type="button" class="btn danger" data-del>Borrar</button>' : '',
    body: `<div class="fgrid">${select('Categoría', 'categoria', v.categoria, CATEGORIAS_GASTO)}${field('Concepto', 'concepto', v.concepto, { required: true, placeholder: 'Cuota de comunidad de enero' })}
      ${field('Proveedor', 'proveedor', v.proveedor)}${money('Importe (€)', 'importe', v.importe, { required: true })}${field('Fecha', 'fecha', v.fecha, { type: 'date', required: true })}
      ${select('Estado', 'estado', v.estado, [['pagado', 'Pagado'], ['pendiente', 'Pendiente de pagar']])}
      ${!g ? select('Se repite', 'repite', '1', [['1', 'Una vez'], ['12', 'Cada mes (12 meses)'], ['4', 'Cada trimestre (4)'], ['2', 'Cada semestre (2)']], { hint: 'Crea los gastos futuros como pendientes' }) : ''}
      <label class="check span2"><input type="checkbox" name="repercutible" ${v.repercutible ? 'checked' : ''}> Se repercute al inquilino</label></div>
      <div class="drop" id="dropg" style="padding:12px">${v.docId ? 'Factura adjunta. Puedes sustituirla:' : 'Adjuntar factura o recibo (PDF o foto)'} <button type="button" class="btn sm" id="adj">Elegir archivo</button><span class="small" id="adjn"></span></div>`,
    onSubmit: async (f) => {
      const x = fd(f); const imp = num(x.importe);
      if (!x.concepto.trim() || !imp || !x.fecha) { toast('Faltan concepto, importe o fecha'); return false; }
      const obj = { ...v, propiedadId: p.id, categoria: x.categoria, concepto: x.concepto.trim(), proveedor: x.proveedor, importe: imp, fecha: x.fecha, estado: x.estado, repercutible: !!x.repercutible };
      if (archivo) { const doc = await guardarArchivo(archivo, { propiedadId: p.id, tipo: 'factura', nombre: (x.concepto.trim() + ' · ' + archivo.name).slice(0, 120) }); obj.docId = doc.id; }
      await db.put('gastos', obj);
      const n = Number(x.repite || 1);
      if (n > 1) {
        const paso = 12 / n; const [yy, mm, dd] = x.fecha.split('-').map(Number);
        for (let k = 1; k < n; k++) { const dt = new Date(yy, mm - 1 + paso * k, Math.min(dd, 28)); const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          await db.put('gastos', { propiedadId: p.id, categoria: obj.categoria, concepto: obj.concepto, proveedor: obj.proveedor, importe: imp, fecha: iso, estado: iso <= hoyISO() ? obj.estado : 'pendiente', repercutible: obj.repercutible }); }
      }
      toast('Gasto guardado'); done();
    },
  });
  document.getElementById('adj').onclick = async () => { const [f] = await elegirArchivos({ multiple: false }); if (f) { archivo = f; document.getElementById('adjn').textContent = f.name; } };
  const del = document.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmar('Borrar gasto', '¿Seguro que quieres borrar este gasto?')) { await db.del('gastos', g.id); toast('Gasto borrado'); done(); } };
}

async function subir(p, files, meta, done) {
  if (!files.length) return;
  for (const f of files) await guardarArchivo(f, { propiedadId: p.id, ...meta });
  toast(files.length === 1 ? 'Archivo guardado' : files.length + ' archivos guardados'); done();
}

/* ---------- Eventos ---------- */

export function bind(el, [id, tab], d, refresh) {
  const p = d.props.find(x => x.id === id); if (!p) return;
  const c = contratoActivo(d.contratos, p.id);
  const on = (sel, fn) => el.querySelectorAll(sel).forEach(b => b.addEventListener('click', (e) => fn(b, e)));
  const anio = el.querySelector('#anio'); if (anio) anio.onchange = () => { state.anio = Number(anio.value); refresh(); };
  on('[data-a=editarProp]', () => formPropiedad(p, refresh));
  on('[data-a=borrarProp]', async () => { if (await confirmar('Borrar propiedad', `Se borrará <b>${esc(p.direccion)}</b> con sus contratos, cobros, gastos, documentos y notas. No se puede deshacer.`)) { await borrarPropiedad(p.id); toast('Propiedad borrada'); location.hash = '#/propiedades'; } });
  on('[data-a=contrato]', () => formContrato(p, d, null, () => { location.hash = `#/propiedad/${p.id}/inquilino`; refresh(); }));
  on('[data-a=editContrato]', () => formContrato(p, d, c, refresh));
  on('[data-a=editInq]', () => formInquilino(d.inq(c.inquilinoId) || { id: c.inquilinoId }, refresh));
  on('[data-a=cobro]', () => c ? formCobro(p, c, d, null, refresh) : toast('Primero registra un contrato'));
  on('[data-a=gasto]', () => formGasto(p, null, refresh));
  on('[data-celda]', (b) => { const [cid, m, con] = b.dataset.celda.split('|'); formCobro(p, c, d, { contratoId: cid, anio: state.anio, mes: Number(m), concepto: con }, refresh); });
  on('[data-pagar]', async (b) => { const g = d.gastos.find(x => x.id === b.dataset.pagar); await db.put('gastos', { ...g, estado: 'pagado' }); toast('Marcado como pagado'); refresh(); });
  on('[data-edit]', (b) => { const [t, gid] = b.dataset.edit.split(':'); if (t === 'gasto') formGasto(p, d.gastos.find(x => x.id === gid), refresh); else formPago(d.pagos.find(x => x.id === gid), d, refresh); });
  on('[data-mf]', (b) => { state.movF = b.dataset.mf; refresh(); });
  on('[data-ver]', (b) => { const x = d.documentos.find(q => q.id === b.dataset.ver); if (x) abrirDoc(x); });
  on('[data-bajar]', (b) => { const x = d.documentos.find(q => q.id === b.dataset.bajar); if (x) descargar(x.blob, x.archivo || x.nombre); });
  on('[data-editdoc]', (b) => { const x = d.documentos.find(q => q.id === b.dataset.editdoc);
    modal({ title: 'Editar documento', extra: '<button type="button" class="btn danger" data-del>Borrar</button>', body: `<div class="fgrid">${field('Nombre', 'nombre', x.nombre, { span2: true })}${select('Tipo', 'tipo', x.tipo, TIPOS_DOC)}</div>`,
      onSubmit: async (f) => { const v = fd(f); await db.put('documentos', { ...x, ...v }); toast('Documento guardado'); refresh(); } });
    document.querySelector('[data-del]').onclick = async () => { if (await confirmar('Borrar documento', '¿Seguro que quieres borrar este documento?')) { await db.del('documentos', x.id); toast('Documento borrado'); refresh(); } }; });
  on('[data-a=subir]', async () => subir(p, await elegirArchivos(), {}, refresh));
  on('[data-a=foto]', async () => subir(p, await elegirArchivos({ accept: 'image/*', capture: true, multiple: false }), { tipo: 'foto' }, refresh));
  on('[data-subir]', async (b) => subir(p, await elegirArchivos(), { contratoId: c?.id, tipo: b.dataset.subir }, refresh));
  on('[data-a=subirInq]', () => {
    modal({ title: 'Subir documentos del inquilino', submit: 'Elegir archivos', body: select('Tipo de documento', 'tipo', 'dni', TIPOS_DOC.filter(t => DOCS_INQUILINO.includes(t[0]) || ['contrato', 'otro'].includes(t[0]))),
      onSubmit: async (f) => { const t = fd(f).tipo; const files = await elegirArchivos(); await subir(p, files, { contratoId: c?.id, tipo: t }, refresh); } });
  });
  const drop = el.querySelector('#drop');
  if (drop) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); subir(p, [...e.dataTransfer.files], {}, refresh); });
  }
  on('[data-a=actualizarRenta]', () => {
    const sig = new Date(); sig.setMonth(sig.getMonth() + 1);
    modal({ title: 'Actualizar renta', body: `<div class="fgrid">${money('Renta actual (€)', 'actual', c.renta)}${field('Índice aplicado (%)', 'pct', '', { inputmode: 'decimal', hint: 'IRAV o IPC publicado por el INE' })}
      ${money('Nueva renta (€)', 'nueva', '', { required: true })}${field('Desde el mes', 'desde', `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}`, { type: 'month', required: true })}</div><div class="small muted">Los meses anteriores conservan la renta antigua en los cobros.</div>`,
      onSubmit: async (f) => { const x = fd(f); const nueva = num(x.nueva); if (!nueva || !x.desde) { toast('Faltan la nueva renta o el mes'); return false; }
        const hist = (c.historialRenta || []).slice(); if (!hist.length) hist.push({ desde: c.inicio.slice(0, 7), importe: c.renta }); hist.push({ desde: x.desde, importe: nueva });
        await db.put('contratos', { ...c, historialRenta: hist, renta: nueva }); toast('Renta actualizada'); refresh(); } });
    const pct = document.querySelector('[name=pct]'), act = document.querySelector('[name=actual]'), nu = document.querySelector('[name=nueva]');
    pct.oninput = () => { const v = num(act.value) * (1 + num(pct.value) / 100); nu.value = v ? fmtNum(Math.round(v * 100) / 100) : ''; };
  });
  on('[data-a=finalizar]', () => {
    modal({ title: 'Finalizar contrato', submit: 'Finalizar y pasar a histórico', body: `<div class="fgrid">${field('Fecha de salida', 'fechaSalida', hoyISO(), { type: 'date', required: true })}${field('Motivo', 'motivoSalida', '', { placeholder: 'Fin de contrato, traslado…' })}
      ${money('Fianza devuelta (€)', 'fianzaDevuelta', c.fianza)}${field('Descuentos de la fianza', 'descuentos', '', { placeholder: 'Pintura, reparaciones…' })}</div><div class="small muted">El inquilino y sus documentos pasan al histórico. Los cobros se conservan.</div>`,
      onSubmit: async (f) => { const x = fd(f); await db.put('contratos', { ...c, estado: 'finalizado', fechaSalida: x.fechaSalida, motivoSalida: x.motivoSalida, fianzaDevuelta: num(x.fianzaDevuelta), descuentos: x.descuentos }); toast('Contrato finalizado'); refresh(); } });
  });
  on('[data-reabrir]', async (b) => { if (c) { toast('Ya hay un contrato activo. Finalízalo antes.'); return; } const k = d.contratos.find(x => x.id === b.dataset.reabrir); await db.put('contratos', { ...k, estado: 'activo', fechaSalida: '' }); toast('Contrato reabierto'); refresh(); });
  on('[data-borrarc]', async (b) => { if (await confirmar('Borrar contrato', 'Se borrará el contrato y todos sus cobros. No se puede deshacer.')) { for (const x of d.pagos.filter(q => q.contratoId === b.dataset.borrarc)) await db.del('pagos', x.id); await db.del('contratos', b.dataset.borrarc); toast('Contrato borrado'); refresh(); } });
  const fn = el.querySelector('#fnota');
  if (fn) fn.onsubmit = async (e) => { e.preventDefault(); const x = fd(fn); if (!x.texto.trim()) return; await db.put('notas', { propiedadId: p.id, fecha: hoyISO(), texto: x.texto.trim(), etiqueta: x.etiqueta }); toast('Nota guardada'); refresh(); };
  on('[data-editnota]', (b) => { const n = d.notas.find(x => x.id === b.dataset.editnota);
    modal({ title: 'Editar anotación', extra: '<button type="button" class="btn danger" data-del>Borrar</button>', body: `<div class="fgrid">${field('Fecha', 'fecha', n.fecha, { type: 'date' })}${select('Etiqueta', 'etiqueta', n.etiqueta, ['', 'Incidencia', 'Cobro', 'Contrato', 'Reparación'])}${textarea('Texto', 'texto', n.texto)}</div>`,
      onSubmit: async (f) => { await db.put('notas', { ...n, ...fd(f) }); toast('Nota guardada'); refresh(); } });
    document.querySelector('[data-del]').onclick = async () => { await db.del('notas', n.id); document.getElementById('modal-root').innerHTML = ''; toast('Nota borrada'); refresh(); }; });
}
