// Admon. Fincas → pestaña «Banco»: conciliar el extracto de la cuenta de cada comunidad.
import { db } from '../db.js';
import { esc, eur, fecha, modal, fd, toast, field, select, MESES } from '../ui.js';
import { vecinosDe, estadoCuota, tocaCobrar, parteDerrama, cobradoDerrama, GRUPOS } from './calc.js';
import { bancoHtml, enlazarBanco, importarExtracto, clave, coincide, diasEntre, deshacerVinculo, norm } from '../banco.js';

const st = { filtro: 'pendiente' };
// ¿Aparece el piso en el concepto del banco? (1º 2ª → «1 2», «1R 2A», «12»; Baixos 1 → «BAIXOS 1», «BAJOS 1», «BJ 1»)
function pisoEn(concepto, piso) {
  const C = ' ' + norm(concepto) + ' ', P = norm(piso);
  const dig = P.match(/\d+/g) || [];
  if (/^(BAIXOS|BAJOS|BAJO|BX|BJ)/.test(P)) return new RegExp(`\\b(BAIXOS|BAJOS|BAJO|BX|BJ)\\s*${dig[0] || ''}\\b`).test(C);
  if (/^(ATIC|ATICO)/.test(P)) return /\b(ATIC|ATICO)\b/.test(C);
  if (/^LOCAL/.test(P)) return new RegExp(`\\bLOCAL\\s*${dig[0] || ''}\\b`).test(C);
  if (dig.length >= 2) return new RegExp(`\\b${dig[0]}\\s*(R|O|ER|N)?\\s*${dig[1]}\\s*(A|O)?\\b`).test(C);
  if (dig.length === 1) return new RegExp(`\\b${dig[0]}\\s*(R|O|ER|N)\\b`).test(C);
  return false;
}
const r2 = (n) => Math.round(n * 100) / 100;

function huecosCuota(c, v, d, hasta) {
  const out = []; const [hy, hm] = hasta.slice(0, 7).split('-').map(Number);
  let [y, m] = (c.cobrosDesde || `${hy}-01`).split('-').map(Number);
  while (y < hy || (y === hy && m <= hm)) {
    if (tocaCobrar(c, m)) { const e = estadoCuota(c, v, d.cobros, y, m); if (['debe', 'pendiente', 'parcial'].includes(e.estado)) out.push({ y, m, falta: r2(e.esp - e.pag) }); }
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function sugerir(m, c, d) {
  const vs = vecinosDe(d, c.id), out = [];
  const cobro = async (v, extra, forma) => { const o = await db.put('f_cobros', { comunidadId: c.id, vecinoId: v.id, pagador: v.propietario, fecha: m.fecha, forma, banco: m.id, ...extra }); d.cobros.push(o); return { store: 'f_cobros', id: o.id }; };
  if (m.importe > 0) {
    d.cobros.filter(q => q.comunidadId === c.id && !q.banco && Math.abs(q.importe - m.importe) < 0.011 && diasEntre(q.fecha, m.fecha) <= 5).forEach(q => {
      const v = vs.find(x => x.id === q.vecinoId) || {};
      out.push({ pts: 50, seguro: true, texto: `Cobro ya apuntado: ${q.concepto === 'cuota' ? 'cuota ' + MESES[q.mes - 1].toLowerCase() + ' ' + q.anio : q.concepto}`, detalle: `${v.piso || ''} · ${v.propietario || ''}`,
        aplicar: async () => { await db.put('f_cobros', { ...q, banco: m.id }); q.banco = m.id; return { vinculados: [{ store: 'f_cobros', id: q.id }] }; } });
    });
    // Remesa de recibos domiciliados de un mes
    const [y, mm] = m.fecha.slice(0, 7).split('-').map(Number);
    for (const [yy, mes] of [[y, mm], mm === 1 ? [y - 1, 12] : [y, mm - 1]]) {
      if (!tocaCobrar(c, mes)) continue;
      const pend = vs.filter(v => v.formaPago === 'Domiciliado').map(v => ({ v, e: estadoCuota(c, v, d.cobros, yy, mes) })).filter(x => ['debe', 'pendiente', 'parcial'].includes(x.e.estado)).map(x => ({ v: x.v, falta: r2(x.e.esp - x.e.pag) }));
      const suma = r2(pend.reduce((a, x) => a + x.falta, 0));
      if (pend.length > 1 && Math.abs(suma - m.importe) < 0.06)
        out.push({ pts: 40, seguro: true, texto: `Remesa de recibos de ${MESES[mes - 1].toLowerCase()} ${yy}`, detalle: `${pend.length} vecinos domiciliados`,
          aplicar: async () => { const creados = []; for (const x of pend) creados.push(await cobro(x.v, { concepto: 'cuota', anio: yy, mes, importe: x.falta }, 'Recibo domiciliado')); return { creados }; } });
    }
    // Cuotas de un vecino (una o varias) o un plazo de derrama
    vs.forEach(v => {
      const nm = coincide(m.concepto, v.propietario) + coincide(m.concepto, v.titular || '') + (pisoEn(m.concepto, v.piso) ? 1 : 0);
      const hs = huecosCuota(c, v, d, m.fecha); let suma = 0;
      for (let n = 0; n < Math.min(hs.length, 6); n++) {
        suma = r2(suma + hs[n].falta);
        if (Math.abs(suma - m.importe) < 0.011) { const sel = hs.slice(0, n + 1);
          out.push({ pts: 20 + nm * 10 - n, seguro: nm >= 1, texto: sel.length === 1 ? `Cuota ${MESES[sel[0].m - 1].toLowerCase()} ${sel[0].y}` : `Cuotas de ${MESES[sel[0].m - 1].toLowerCase()} a ${MESES[sel[n].m - 1].toLowerCase()} ${sel[n].y}`, detalle: `${v.piso} · ${v.propietario}`,
            aplicar: async () => { const creados = []; for (const h of sel) creados.push(await cobro(v, { concepto: 'cuota', anio: h.y, mes: h.m, importe: h.falta }, 'Transferencia')); return { creados }; } });
          break; }
      }
      d.derramas.filter(x => x.comunidadId === c.id).forEach(der => { const np = (der.plazos || []).length || 1;
        (der.plazos || [{}]).forEach((pl, i) => { const falta = r2(parteDerrama(der, v, vs) / np - cobradoDerrama(d.cobros, v.id, der.id, i).imp);
          if (falta > 0.01 && Math.abs(falta - m.importe) < 0.011) out.push({ pts: 18 + nm * 10 - i, seguro: nm >= 1, texto: `${der.concepto} · plazo ${i + 1}`, detalle: `${v.piso} · ${v.propietario}`,
            aplicar: async () => ({ creados: [await cobro(v, { concepto: 'derrama', derramaId: der.id, plazo: i, anio: Number(m.fecha.slice(0, 4)), mes: Number(m.fecha.slice(5, 7)), importe: m.importe }, 'Transferencia')] }) }); }); });
    });
  } else {
    const abs = -m.importe;
    d.gastos.filter(g => g.comunidadId === c.id && !g.banco && Math.abs(g.importe - abs) < 0.011 && diasEntre(g.fecha, m.fecha) <= 12).forEach(g => {
      out.push({ pts: 40 - diasEntre(g.fecha, m.fecha) + coincide(m.concepto, (g.proveedor || '') + ' ' + g.concepto) * 5, seguro: true, texto: `Gasto apuntado: ${g.concepto}${g.estado === 'pendiente' ? ' (se marca pagado)' : ''}`, detalle: g.proveedor || '',
        aplicar: async () => { const prev = g.estado; await db.put('f_gastos', { ...g, estado: 'pagado', banco: m.id }); g.banco = m.id; return { vinculados: [{ store: 'f_gastos', id: g.id, estadoPrevio: prev }] }; } });
    });
    if (!out.length) {
      const pv = d.proveedores.map(p => [p, coincide(m.concepto, p.nombre)]).sort((a, b) => b[1] - a[1]).find(x => x[1] > 0)?.[0];
      if (pv) { const ult = d.gastos.filter(g => g.comunidadId === c.id && g.proveedorId === pv.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
        out.push({ pts: 10, seguro: false, texto: `Crear gasto de ${pv.nombre}`, detalle: ult ? `como el último: ${ult.partida || ult.grupo}` : (pv.servicio || ''),
          aplicar: async () => { const o = await db.put('f_gastos', { comunidadId: c.id, fecha: m.fecha, concepto: ult ? ult.concepto.replace(/\b(gener|febrer|març|abril|maig|juny|juliol|agost|setembre|octubre|novembre|desembre)\b/i, '').trim() || m.concepto : m.concepto, proveedor: pv.nombre, proveedorId: pv.id, importe: abs, grupo: ult?.grupo || 'coef', partida: ult?.partida || '', estado: 'pagado', banco: m.id }); d.gastos.push(o); return { creados: [{ store: 'f_gastos', id: o.id }] }; } }); }
    }
  }
  out.sort((a, b) => b.pts - a.pts);
  if (out.length > 1 && out[0].pts === out[1].pts) out.forEach(o => { o.seguro = false; });
  return out;
}

function manual(m, c, d, done) {
  const vs = vecinosDe(d, c.id);
  const y = Number(m.fecha.slice(0, 4)), mm = Number(m.fecha.slice(5, 7));
  if (m.importe > 0) {
    const ders = d.derramas.filter(x => x.comunidadId === c.id);
    modal({ title: `Asignar cobro de ${eur(m.importe)}`, submit: 'Conciliar',
      body: `<div class="small muted">${fecha(m.fecha)} · ${esc(m.concepto)}</div><div class="fgrid">
        ${select('Vecino', 'vecino', vs[0]?.id, [['', '— No es de ningún vecino (otro ingreso de la comunidad) —'], ...vs.map(v => [v.id, `${v.piso} · ${v.propietario}`])])}
        ${select('Concepto', 'concepto', 'cuota', [['cuota', 'Cuota'], ...ders.flatMap(der => (der.plazos || [{}]).map((pl, i) => [`der|${der.id}|${i}`, `${der.concepto} · plazo ${i + 1}`])), ['otro', 'Otro ingreso']])}
        ${select('Mes de la cuota', 'mes', `${y}-${mm}`, [y - 1, y].flatMap(yy => MESES.map((n, i) => [`${yy}-${i + 1}`, `${n} ${yy}`])))}</div>`,
      onSubmit: async (f) => { const x = fd(f); let v;
        const v0 = vs.find(q => q.id === x.vecino);
        const base = { comunidadId: c.id, vecinoId: x.vecino || null, pagador: v0?.propietario || '', importe: m.importe, fecha: m.fecha, forma: 'Transferencia', banco: m.id };
        let o;
        if (x.concepto === 'cuota' && v0) { const [yy, mes] = x.mes.split('-').map(Number); o = await db.put('f_cobros', { ...base, concepto: 'cuota', anio: yy, mes }); v = { texto: `Cuota ${MESES[mes - 1].toLowerCase()} ${yy} · ${v0.piso}` }; }
        else if (x.concepto.startsWith('der|') && v0) { const [, did, i] = x.concepto.split('|'); o = await db.put('f_cobros', { ...base, concepto: 'derrama', derramaId: did, plazo: Number(i), anio: y, mes: mm }); v = { texto: `Derrama · ${v0.piso}` }; }
        else { o = await db.put('f_cobros', { ...base, concepto: 'otro', anio: y, mes: mm, nota: m.concepto }); v = { texto: `Otro ingreso${v0 ? ' · ' + v0.piso : ''}` }; }
        v.creados = [{ store: 'f_cobros', id: o.id }];
        await db.put('f_banco', { ...m, estado: 'conciliado', vinculo: v }); toast('Conciliado'); done(); } });
  } else {
    const abs = -m.importe;
    const libres = d.gastos.filter(g => g.comunidadId === c.id && !g.banco).sort((a, b) => Math.abs(a.importe - abs) - Math.abs(b.importe - abs)).slice(0, 30);
    const pres = ((c.presupuestos || {})[y] || []).map(p => p.partida);
    modal({ title: `Asignar gasto de ${eur(abs)}`, submit: 'Conciliar', wide: true,
      body: `<div class="small muted">${fecha(m.fecha)} · ${esc(m.concepto)}</div>
        <div class="fgrid">${select('Qué es', 'modo', 'nuevo', [['nuevo', 'Un gasto nuevo'], ['existe', 'Un gasto que ya está apuntado']])}</div>
        <div id="mNuevo" class="fgrid">${field('Concepto', 'concepto', m.concepto, { span2: true })}${select('Proveedor', 'prov', '', [['', '—'], ...d.proveedores.map(p => [p.id, p.nombre])])}
          ${select('Cómo se reparte', 'grupo', 'coef', GRUPOS)}${select('Partida', 'partida', '', [['', '—'], ...pres.map(p => [p, p])])}</div>
        <div id="mExiste" class="fgrid" style="display:none">${select('Gasto', 'gasto', libres[0]?.id, libres.map(g => [g.id, `${fecha(g.fecha)} · ${g.concepto} · ${eur(g.importe)}`]), { span2: true })}</div>`,
      onSubmit: async (f) => { const x = fd(f); let v;
        if (x.modo === 'existe') { const g = d.gastos.find(q => q.id === x.gasto); if (!g) return false; const prev = g.estado; await db.put('f_gastos', { ...g, estado: 'pagado', banco: m.id }); v = { texto: `Gasto apuntado: ${g.concepto}`, vinculados: [{ store: 'f_gastos', id: g.id, estadoPrevio: prev }] }; }
        else { const pv = d.proveedores.find(p => p.id === x.prov); const o = await db.put('f_gastos', { comunidadId: c.id, fecha: m.fecha, concepto: x.concepto || m.concepto, proveedor: pv?.nombre || '', proveedorId: pv?.id || '', importe: abs, grupo: x.grupo, partida: x.partida, estado: 'pagado', banco: m.id });
          v = { texto: `Gasto nuevo: ${x.concepto || m.concepto}`, creados: [{ store: 'f_gastos', id: o.id }] }; }
        await db.put('f_banco', { ...m, estado: 'conciliado', vinculo: v }); toast('Conciliado'); done(); } });
    const mo = document.querySelector('.dialog [name=modo]'); mo.onchange = () => { document.getElementById('mNuevo').style.display = mo.value === 'nuevo' ? '' : 'none'; document.getElementById('mExiste').style.display = mo.value === 'existe' ? '' : 'none'; };
  }
}

const cfgDe = (c, d, refresh) => {
  const movs = d.banco.filter(x => x.comunidadId === c.id);
  const sb = (c.saldosBanco || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null;
  return { titulo: 'Banco y conciliación', movs, filtro: st.filtro, store: 'f_banco', ultimoSaldo: sb, refresh,
    sugerir: (m) => sugerir(m, c, d), manual: (m) => manual(m, c, d, refresh), deshacer: (m) => deshacerVinculo(m.vinculo), alFiltro: (f) => { st.filtro = f; refresh(); },
    prueba: d.coms.some(x => x.prueba), ejemplo: async () => { const { extractoPrueba } = await import('../prueba.js'); const { descargar } = await import('../ui.js'); descargar(new Blob([await extractoPrueba('fin', c.id)], { type: 'text/csv;charset=utf-8' }), 'extracto_prueba.csv'); toast('Extracto de prueba descargado: ahora pulsa «Importar extracto»'); },
    importar: () => importarExtracto({ store: 'f_banco', base: { comunidadId: c.id }, existentes: new Set(movs.map(clave)), done: refresh,
      alSaldo: async (f, s) => { const cc = await db.get('f_comunidades', c.id); if ((cc.saldosBanco || []).some(x => x.fecha === f && Math.abs(x.importe - s) < 0.01)) return;
        await db.put('f_comunidades', { ...cc, saldosBanco: [...(cc.saldosBanco || []), { fecha: f, importe: s, origen: 'Conciliación' }] }); } }) };
};
export const tabBanco = (c, d) => bancoHtml(cfgDe(c, d, () => {}));
export const bindTabBanco = (el, c, d, refresh) => enlazarBanco(el, cfgDe(c, d, refresh));
