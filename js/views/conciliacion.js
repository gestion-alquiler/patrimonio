// Patrimonio → Conciliación bancaria: emparejar el extracto con rentas, basuras y gastos.
import { db, getAjustes, setAjustes } from '../db.js';
import { esc, eur, fecha, modal, fd, toast, field, select, MESES } from '../ui.js';
import { estadoMes, esperado, cubreMes, basuraAnio, CATEGORIAS_GASTO } from '../calc.js';
import { bancoHtml, enlazarBanco, importarExtracto, clave, coincide, diasEntre, deshacerVinculo, norm } from '../banco.js';

let filtro = 'pendiente';
const CAT = [[/\bIBI\b|BIENES INMUEBLES|BENS IMMOBLES/, 'IBI'], [/COMUNIDAD|COMUNITAT|PROPIETARI|FINQUES|FINCAS/, 'Comunidad'], [/SEGUR|MAPFRE|ALLIANZ|ZURICH|LINEA DIRECTA|AXA|GENERALI/, 'Seguro'],
  [/RESIDUS|RESIDUOS|BASURA|ESCOMBRAR/, 'Basuras'], [/ENDESA|IBERDROLA|NATURGY|AIGUES|AGUAS|GAS NATURAL|REPSOL/, 'Suministros'], [/GESTORIA|NOTARI|ASESOR|HONORAR/, 'Gestoría / honorarios']];
const r2 = (n) => Math.round(n * 100) / 100;

function nombreContrato(d, k) { const i = d.inq(k.inquilinoId) || {}, p = d.props.find(x => x.id === k.propiedadId) || {}; return { i, p, txt: `${i.nombre || 'Inquilino'} · ${p.direccion || ''}` }; }

// Meses de renta sin cobrar (o a medias) de un contrato hasta el mes del movimiento
function huecos(k, d, hasta) {
  const out = []; const [hy, hm] = hasta.slice(0, 7).split('-').map(Number);
  let [y, m] = (k.cobrosDesde || k.inicio.slice(0, 7)).split('-').map(Number);
  while (y < hy || (y === hy && m <= hm)) {
    if (cubreMes(k, y, m)) { const e = estadoMes(k, d.pagos, y, m, 'renta'); if (['debe', 'pendiente', 'parcial'].includes(e.estado)) out.push({ y, m, falta: r2((e.esp || esperado(k, y, m, 'renta')) - (e.pag || 0)) }); }
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function sugerir(m, d) {
  const out = [];
  if (m.importe > 0) {
    // 1. Un cobro ya apuntado a mano con el mismo importe
    d.pagos.filter(p => !p.banco && Math.abs(p.importe - m.importe) < 0.01 && diasEntre(p.fecha, m.fecha) <= 5).forEach(p => {
      const k = d.contratos.find(x => x.id === p.contratoId); const n = k ? nombreContrato(d, k).txt : '';
      out.push({ pts: 50, seguro: true, texto: `Cobro ya apuntado: ${p.concepto === 'basura' ? 'basura ' + p.anio : 'renta ' + MESES[p.mes - 1].toLowerCase() + ' ' + p.anio}`, detalle: n,
        aplicar: async () => { await db.put('pagos', { ...p, banco: m.id }); p.banco = m.id; return { vinculados: [{ store: 'pagos', id: p.id }] }; } });
    });
    // 2. Rentas pendientes (una o varias seguidas) o la basura del año
    d.contratos.forEach(k => {
      const { i, p, txt } = nombreContrato(d, k); const nm = coincide(m.concepto, i.nombre) + coincide(m.concepto, p.direccion) * 0.5;
      const hs = huecos(k, d, m.fecha); let suma = 0;
      for (let n = 0; n < Math.min(hs.length, 6); n++) {
        suma = r2(suma + hs[n].falta);
        if (Math.abs(suma - m.importe) < 0.011) { const sel = hs.slice(0, n + 1);
          out.push({ pts: 20 + nm * 10 - n, seguro: nm >= 1, texto: sel.length === 1 ? `Renta ${MESES[sel[0].m - 1].toLowerCase()} ${sel[0].y}` : `Rentas de ${MESES[sel[0].m - 1].toLowerCase()} a ${MESES[sel[n].m - 1].toLowerCase()} ${sel[n].y}`, detalle: txt,
            aplicar: async () => { const creados = []; for (const h of sel) { const o = await db.put('pagos', { contratoId: k.id, propiedadId: k.propiedadId, concepto: 'renta', anio: h.y, mes: h.m, importe: h.falta, fecha: m.fecha, forma: 'Transferencia', banco: m.id }); d.pagos.push(o); creados.push({ store: 'pagos', id: o.id }); } return { creados }; } });
          break; }
      }
      const y = Number(m.fecha.slice(0, 4)); const b = basuraAnio(k, d.pagos, y);
      if (b && b.estado !== 'pagado' && Math.abs(b.esp - b.pag - m.importe) < 0.011)
        out.push({ pts: 15 + nm * 10, seguro: nm >= 1, texto: `Basura ${y}`, detalle: txt,
          aplicar: async () => { const o = await db.put('pagos', { contratoId: k.id, propiedadId: k.propiedadId, concepto: 'basura', anio: y, mes: 0, importe: m.importe, fecha: m.fecha, forma: 'Transferencia', banco: m.id }); d.pagos.push(o); return { creados: [{ store: 'pagos', id: o.id }] }; } });
    });
  } else {
    const abs = -m.importe;
    // 1. Un gasto ya apuntado (pagado o pendiente) con el mismo importe
    d.gastos.filter(g => !g.banco && Math.abs(g.importe - abs) < 0.011 && diasEntre(g.fecha, m.fecha) <= 12).forEach(g => {
      const p = d.props.find(x => x.id === g.propiedadId) || {};
      out.push({ pts: 40 - diasEntre(g.fecha, m.fecha) + coincide(m.concepto, (g.proveedor || '') + ' ' + g.concepto + ' ' + (p.direccion || '')) * 5, seguro: true, texto: `Gasto apuntado: ${g.concepto}${g.estado === 'pendiente' ? ' (se marca pagado)' : ''}`, detalle: p.direccion,
        aplicar: async () => { const prev = g.estado; await db.put('gastos', { ...g, estado: 'pagado', banco: m.id }); g.banco = m.id; return { vinculados: [{ store: 'gastos', id: g.id, estadoPrevio: prev }] }; } });
    });
    // 2. Crear el gasto: categoría por palabras clave e inmueble por la dirección
    if (!out.length) {
      const C = norm(m.concepto); const cat = (CAT.find(([re]) => re.test(C)) || [, 'Otros'])[1];
      const p = d.props.map(x => [x, coincide(m.concepto, x.direccion)]).sort((a, b) => b[1] - a[1]).find(x => x[1] > 0)?.[0];
      if (p) out.push({ pts: 5, seguro: false, texto: `Crear gasto: ${cat}`, detalle: p.direccion,
        aplicar: async () => { const o = await db.put('gastos', { propiedadId: p.id, categoria: cat, concepto: m.concepto, proveedor: '', importe: abs, fecha: m.fecha, estado: 'pagado', banco: m.id }); d.gastos.push(o); return { creados: [{ store: 'gastos', id: o.id }] }; } });
    }
  }
  out.sort((a, b) => b.pts - a.pts);
  if (out.length > 1 && out[0].pts === out[1].pts) out.forEach(o => { o.seguro = false; });
  return out;
}

function manual(m, d, done) {
  const props = d.props.slice().sort((a, b) => (a.direccion || '').localeCompare(b.direccion || '', 'es'));
  if (m.importe > 0) {
    const ks = d.contratos.slice().sort((a, b) => (a.estado === 'finalizado') - (b.estado === 'finalizado'));
    const y = Number(m.fecha.slice(0, 4));
    modal({ title: `Asignar cobro de ${eur(m.importe)}`, submit: 'Conciliar',
      body: `<div class="small muted">${fecha(m.fecha)} · ${esc(m.concepto)}</div><div class="fgrid">
        ${select('Inquilino', 'contrato', ks[0]?.id, [['', '— No es de ningún inquilino (otro ingreso) —'], ...ks.map(k => [k.id, nombreContrato(d, k).txt + (k.estado === 'finalizado' ? ' (anterior)' : '')])])}
        ${select('Concepto', 'concepto', 'renta', [['renta', 'Renta'], ['basura', 'Basura (anual)']])}
        ${select('Mes', 'mes', `${y}-${Number(m.fecha.slice(5, 7))}`, [y - 1, y].flatMap(yy => MESES.map((n, i) => [`${yy}-${i + 1}`, `${n} ${yy}`])))}</div>`,
      onSubmit: async (f) => { const x = fd(f); let v;
        if (!x.contrato) v = { texto: 'Otro ingreso (no se apunta en ninguna propiedad)' };
        else { const k = d.contratos.find(q => q.id === x.contrato); const [yy, mm] = x.mes.split('-').map(Number);
          const o = await db.put('pagos', { contratoId: k.id, propiedadId: k.propiedadId, concepto: x.concepto, anio: yy, mes: x.concepto === 'basura' ? 0 : mm, importe: m.importe, fecha: m.fecha, forma: 'Transferencia', banco: m.id });
          v = { texto: `${x.concepto === 'basura' ? 'Basura ' + yy : 'Renta ' + MESES[mm - 1].toLowerCase() + ' ' + yy} · ${nombreContrato(d, k).txt}`, creados: [{ store: 'pagos', id: o.id }] }; }
        await db.put('banco', { ...m, estado: 'conciliado', vinculo: v }); toast('Conciliado'); done(); } });
  } else {
    const abs = -m.importe;
    const libres = d.gastos.filter(g => !g.banco).sort((a, b) => Math.abs(a.importe - abs) - Math.abs(b.importe - abs)).slice(0, 30);
    modal({ title: `Asignar gasto de ${eur(abs)}`, submit: 'Conciliar', wide: true,
      body: `<div class="small muted">${fecha(m.fecha)} · ${esc(m.concepto)}</div>
        <div class="fgrid">${select('Qué es', 'modo', 'nuevo', [['nuevo', 'Un gasto nuevo'], ['existe', 'Un gasto que ya está apuntado']])}</div>
        <div id="mNuevo" class="fgrid">${select('Propiedad', 'prop', props[0]?.id, props.map(p => [p.id, p.direccion]))}${select('Categoría', 'cat', (CAT.find(([re]) => re.test(norm(m.concepto))) || [, 'Otros'])[1], CATEGORIAS_GASTO)}${field('Concepto', 'concepto', m.concepto, { span2: true })}</div>
        <div id="mExiste" class="fgrid" style="display:none">${select('Gasto', 'gasto', libres[0]?.id, libres.map(g => [g.id, `${fecha(g.fecha)} · ${g.concepto} · ${eur(g.importe)} · ${(d.props.find(p => p.id === g.propiedadId) || {}).direccion || ''}`]), { span2: true })}</div>`,
      onSubmit: async (f) => { const x = fd(f); let v;
        if (x.modo === 'existe') { const g = d.gastos.find(q => q.id === x.gasto); if (!g) return false; const prev = g.estado; await db.put('gastos', { ...g, estado: 'pagado', banco: m.id }); v = { texto: `Gasto apuntado: ${g.concepto}`, vinculados: [{ store: 'gastos', id: g.id, estadoPrevio: prev }] }; }
        else { const o = await db.put('gastos', { propiedadId: x.prop, categoria: x.cat, concepto: x.concepto || m.concepto, proveedor: '', importe: abs, fecha: m.fecha, estado: 'pagado', banco: m.id }); v = { texto: `Gasto nuevo: ${x.cat} · ${(d.props.find(p => p.id === x.prop) || {}).direccion || ''}`, creados: [{ store: 'gastos', id: o.id }] }; }
        await db.put('banco', { ...m, estado: 'conciliado', vinculo: v }); toast('Conciliado'); done(); } });
    const mo = document.querySelector('.dialog [name=modo]'); mo.onchange = () => { document.getElementById('mNuevo').style.display = mo.value === 'nuevo' ? '' : 'none'; document.getElementById('mExiste').style.display = mo.value === 'existe' ? '' : 'none'; };
  }
}

const cfgDe = (d, refresh) => ({ titulo: 'Conciliación bancaria', movs: d.banco, filtro, store: 'banco', ultimoSaldo: d.aj.saldoBanco || null, refresh,
  sugerir: (m) => sugerir(m, d), manual: (m) => manual(m, d, refresh), deshacer: (m) => deshacerVinculo(m.vinculo), alFiltro: (f) => { filtro = f; refresh(); },
  prueba: d.props.some(x => x.prueba), ejemplo: async () => { const { extractoPrueba } = await import('../prueba.js'); const { descargar } = await import('../ui.js'); descargar(new Blob([await extractoPrueba('pat', undefined)], { type: 'text/csv;charset=utf-8' }), 'extracto_prueba.csv'); toast('Extracto de prueba descargado: ahora pulsa «Importar extracto»'); },
    importar: () => importarExtracto({ store: 'banco', base: { cuenta: 'principal' }, existentes: new Set(d.banco.map(clave)), done: refresh,
    alSaldo: async (f, s) => { const aj = await getAjustes(); if (!aj.saldoBanco || aj.saldoBanco.fecha <= f) { aj.saldoBanco = { fecha: f, importe: s }; await setAjustes(aj); } } }) });

export async function render(_, d) { return `<div class="page">${bancoHtml(cfgDe(d, () => {}))}</div>`; }
export function bind(el, _, d, refresh) { enlazarBanco(el, cfgDe(d, refresh)); }
