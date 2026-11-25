// Importa un Excel de contabilidad de cuotas con el formato de «Contabilidad_cuotas» (Sant Llorenç, 19):
// hojas INGRESOS AAAA, CALCULO NUEVAS CUOTAS, IMPORTES DERRAMAS, COSTES OBRA y REPARTIMENT GASTOS AAAA.
// Es tolerante: lee lo que encuentra y avisa de lo que no ha podido interpretar.

function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de Excel')); document.head.appendChild(s); });
}

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Ç/g, 'C').trim();
const normPiso = (s) => sinAcentos(s).replace(/^BAJOS/, 'BAIXOS').replace(/\s+/g, ' ').replace(/[ºª]/g, (c) => c === 'º' ? 'O' : 'A');
const MES = { GENER: 1, ENERO: 1, FEBRER: 2, FEBRERO: 2, MARC: 3, MARZO: 3, ABRIL: 4, MAIG: 5, MAYO: 5, JUNY: 6, JUNIO: 6, JULIOL: 7, JULIO: 7, AGOST: 8, AGOSTO: 8,
  SETEMBRE: 9, SEPTEMBRE: 9, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVEMBRE: 11, NOVIEMBRE: 11, DESEMBRE: 12, DECEMBRE: 12, DICIEMBRE: 12 };
const esFecha = (v) => v instanceof Date && !isNaN(v);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esNum = (v) => typeof v === 'number' && isFinite(v);
const r2 = (n) => Math.round(n * 100) / 100;
const anioDe = (name) => { const m = String(name).match(/(20\d\d)/); return m ? Number(m[1]) : null; };
const titulo = (s) => String(s || '').trim().toLowerCase().replace(/(^|[\s'·(-])\p{L}/gu, (c) => c.toUpperCase());

export async function importarExcel(file) {
  await cargarXLSX();
  const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const hoja = (name) => window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
  const avisos = [];
  const vec = {}; // clave piso -> datos
  const cobros = [];
  let nombreCom = '';
  let primerMes = null;

  /* ---------- INGRESOS (cuotas cobradas con su fecha) ---------- */
  const hojasIng = wb.SheetNames.filter(n => /INGRES/i.test(n) && anioDe(n)).sort((a, b) => anioDe(a) - anioDe(b));
  if (!hojasIng.length) throw new Error('No encuentro ninguna hoja «INGRESOS año»');
  hojasIng.forEach((name, iHoja) => {
    const y = anioDe(name), rows = hoja(name);
    if (!nombreCom) nombreCom = String((rows[0] || []).find(x => typeof x === 'string') || '').trim();
    const hi = rows.findIndex(r => r && sinAcentos(r[0]) === 'PISO');
    if (hi < 0) { avisos.push(`${name}: no encuentro la fila de cabecera «PISO»`); return; }
    const cols = {}; let colAjuste = -1;
    rows[hi].forEach((h, c) => { const k = sinAcentos(h); if (MES[k]) cols[c] = MES[k]; if (/^AJUST/.test(k)) colAjuste = c; });
    let ignorados = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const piso = typeof row[0] === 'string' ? row[0].trim() : '';
      if (!piso) { Object.keys(cols).forEach(c => { if (esNum(row[c]) && row[c] !== 0) ignorados++; }); continue; }
      const key = normPiso(piso);
      const nombre = String(row[1] || '').trim();
      const v = vec[key] || (vec[key] = { piso, nombres: [], meses: {}, orden: Object.keys(vec).length });
      if (nombre && !v.nombres.includes(nombre)) v.nombres.push(nombre);
      v.ultimoNombre = nombre || v.ultimoNombre;
      const fechaArriba = (c) => { for (let k = r - 1; k >= Math.max(hi + 1, r - 2); k--) { const x = (rows[k] || [])[c]; if (esFecha(x)) return iso(x); if (typeof (rows[k] || [])[0] === 'string' && (rows[k] || [])[0].trim()) break; } return null; };
      for (const [c, m] of Object.entries(cols)) {
        const val = row[c], k = `${y}-${String(m).padStart(2, '0')}`;
        if (esNum(val)) {
          if (!primerMes || k < primerMes) primerMes = k;
          if (val > 0) {
            v.meses[k] = (v.meses[k] || 0) + val;
            const f = fechaArriba(c);
            cobros.push({ _v: key, concepto: 'cuota', anio: y, mes: m, importe: r2(val), fecha: f || `${k}-01`, forma: '', nota: (f ? '' : 'Fecha aproximada. ') + (v.nombres.length > 1 ? 'Pagado por ' + nombre : ''), importado: true });
          } else if (!(k in v.meses)) v.meses[k] = 0;
        }
      }
      if (colAjuste >= 0 && esNum(row[colAjuste]) && row[colAjuste] > 0) {
        const f = fechaArriba(colAjuste);
        cobros.push({ _v: key, concepto: 'otro', anio: y, mes: f ? Number(f.slice(5, 7)) : 1, importe: r2(row[colAjuste]), fecha: f || `${y}-01-01`, nota: String(rows[hi][colAjuste] || 'Ajuste') + (nombre ? ' · ' + nombre : ''), importado: true });
      }
    }
    if (ignorados) avisos.push(`${name}: ${ignorados} importes en filas sin piso (ajustes o notas a mano) no se han importado`);
  });

  /* ---------- Coeficientes ---------- */
  const hojaCoef = wb.SheetNames.find(n => /NUEVAS/i.test(n)) || wb.SheetNames.find(n => /CALCUL/i.test(n));
  const coef = {}, cuotaCalc = {};
  if (hojaCoef) {
    const rows = hoja(hojaCoef);
    const hi = rows.findIndex(r => r && r.some(x => sinAcentos(x) === 'PISO'));
    if (hi >= 0) {
      const cp = rows[hi].findIndex(x => sinAcentos(x) === 'PISO');
      const cc = rows[hi].findIndex(x => /^COEFICIEN/.test(sinAcentos(x)));
      const cNueva = rows[hi].reduce((best, x, i) => (esNum(x) && x > 2000 && (best < 0 || x > rows[hi][best]) ? i : best), -1);
      for (let r = hi + 1; r < rows.length; r++) { const row = rows[r] || []; if (typeof row[cp] === 'string' && esNum(row[cc])) { coef[normPiso(row[cp])] = row[cc]; if (cNueva >= 0 && esNum(row[cNueva])) cuotaCalc[normPiso(row[cp])] = r2(row[cNueva]); } }
    }
  }

  /* ---------- Derramas ---------- */
  const derramas = [];
  const hojaDer = wb.SheetNames.find(n => /DERRAM/i.test(n));
  if (hojaDer) {
    const rows = hoja(hojaDer), y = anioDe(hojaDer) || new Date().getFullYear();
    const hi = rows.findIndex(r => r && r.some(x => sinAcentos(x) === 'PISO'));
    if (hi >= 0) {
      rows[hi].forEach((h, c) => {
        if (sinAcentos(h) !== 'PISO') return;
        const col = (re) => { for (let k = c; k < c + 9; k++) if (re.test(sinAcentos(rows[hi][k]))) return k; return -1; };
        const cCoef = col(/^COEF/), cImp = col(/^IMPORT/), cCob = col(/^COBRAD/), cIng = col(/^INGRES|^FECHA|^DATA/);
        let total = null, nombre = '';
        for (let r = 0; r < hi; r++) for (let k = Math.max(0, c - 1); k < c + 9; k++) {
          const x = (rows[r] || [])[k];
          if (/IMPORT TOTAL/.test(sinAcentos(x))) { for (let j = k + 1; j < k + 8; j++) if (esNum(rows[r][j])) { total = rows[r][j]; break; } }
          if (!nombre && typeof x === 'string' && /^(PRIMERA|SEGUNDA|TERCERA|CUARTA|PRIMERA|SEGONA|TERCERA)/.test(sinAcentos(x))) nombre = x.trim();
        }
        const key = 'd' + derramas.length;
        let primera = null; let suma = 0;
        for (let r = hi + 1; r < rows.length; r++) {
          const row = rows[r] || [], piso = row[c];
          if (typeof piso !== 'string' || !piso.trim() || /TOTAL/.test(sinAcentos(piso))) continue;
          const k = normPiso(piso);
          if (!coef[k] && esNum(row[cCoef])) coef[k] = row[cCoef] < 1.5 ? row[cCoef] * 100 : row[cCoef];
          if (cImp >= 0 && esNum(row[cImp])) suma += row[cImp];
          const cob = cCob >= 0 ? row[cCob] : null;
          if (esNum(cob) && cob > 0) {
            const f = cIng >= 0 && esFecha(row[cIng]) ? iso(row[cIng]) : null;
            if (f && (!primera || f < primera)) primera = f;
            cobros.push({ _v: k, _d: key, concepto: 'derrama', plazo: 0, importe: r2(cob), fecha: f || `${y}-01-01`, anio: Number((f || `${y}`).slice(0, 4)), mes: f ? Number(f.slice(5, 7)) : 1, nota: f ? '' : 'Fecha aproximada', importado: true });
          }
        }
        derramas.push({ _key: key, concepto: `Derrama obras ${y}${nombre ? ' · ' + titulo(nombre) : ''}`, total: r2(total ?? suma), reparto: 'coef', plazos: [{ mes: (primera || `${y}-01-01`).slice(0, 7) }], fechaJunta: '', presupuesto: [] });
      });
    }
  }

  /* ---------- Presupuesto de obra ---------- */
  const hojaObra = wb.SheetNames.find(n => /COSTES|OBRA/i.test(n) && !/DERRAM/i.test(n));
  if (hojaObra && derramas.length) {
    const rows = hoja(hojaObra);
    for (const row of rows) {
      if (!row) continue;
      const t = row.find(x => typeof x === 'string' && x.trim());
      const n = [...row].reverse().find(esNum);
      if (!t || n == null) continue;
      if (/TOTAL/.test(sinAcentos(t))) break;
      if (/PREVISION/.test(sinAcentos(t))) continue;
      derramas[0].presupuesto.push({ partida: t.trim(), importe: r2(n) });
    }
  }

  /* ---------- Gastos (repartiment) ---------- */
  const gastos = [];
  const vistos = new Set();
  let saldoInicial = null, saldoFecha = null, fondo = null; const saldosFin = [];
  wb.SheetNames.filter(n => /REPART|GASTOS/i.test(n) && anioDe(n)).sort((a, b) => anioDe(a) - anioDe(b)).forEach((name) => {
    const y = anioDe(name), rows = hoja(name);
    let grupo = null, cC = 2, cF = 5, cG = 6, cK = 10, ctx = {}, tieneLista = false;
    rows.forEach((row, r) => {
      if (!row) return;
      const textos = row.map(sinAcentos);
      const all = textos.join(' ');
      if (/GRUP 1|GRUPO 1/.test(all) && /IGUAL/.test(all)) { grupo = 'iguales'; ctx = {}; }
      else if (/GRUP 2|GRUPO 2/.test(all) && /COEFIC/.test(all)) { grupo = 'coef'; ctx = {}; }
      else if (/GRUP 3|GRUPO 3/.test(all)) { grupo = 'derrama'; ctx = {}; }
      if (/^RESUM/.test(all.trim())) grupo = null;
      const iC = textos.indexOf('CONCEPTE') >= 0 ? textos.indexOf('CONCEPTE') : textos.indexOf('CONCEPTO');
      if (iC >= 0) { cC = iC; cF = textos.findIndex(t => t === 'DATA' || t === 'FECHA'); cG = textos.findIndex(t => t === 'EMPRESA' || t === 'PROVEEDOR'); cK = textos.findIndex(t => t === 'IMPORT' || t === 'IMPORTE'); return; }
      // Lista de pagos de obra a la derecha («Obras pagos»)
      const iObra = textos.findIndex(t => /OBRAS PAGOS|PAGOS OBRA/.test(t));
      if (iObra >= 0) tieneLista = { c: iObra, desde: r };
      if (tieneLista && r > tieneLista.desde) {
        const q = row[tieneLista.c], s = row[tieneLista.c + 2], tt = row[tieneLista.c + 3], v = row[tieneLista.c + 5];
        if (typeof q === 'string' && esNum(v) && !/TOTAL/.test(sinAcentos(tt))) {
          const k = `obra|${sinAcentos(q)}|${r2(v)}`;
          if (!vistos.has(k)) { vistos.add(k); gastos.push({ fecha: esFecha(s) ? iso(s) : `${y}-12-31`, concepto: q.trim(), proveedor: typeof tt === 'string' ? tt.trim() : '', importe: r2(v), grupo: 'derrama', _d: derramas[0]?._key, estado: 'pagado', importado: true }); }
        }
      }
      // Saldo inicial y fondo de reserva
      const iLab = row.findIndex(x => typeof x === 'string' && /^(SALDO INICIAL|FONDO RESERVA|FONS RESERVA)/.test(sinAcentos(x)));
      if (iLab >= 0) {
        const lab = sinAcentos(row[iLab]); const val = row.slice(iLab + 1).find(esNum);
        if (/^SALDO INICIAL/.test(lab) && esNum(val) && saldoInicial == null) {
          saldoInicial = val;
          const m = String(row[iLab]).match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          saldoFecha = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : `${y}-01-01`;
        }
        if (/RESERVA/.test(lab) && esNum(val) && fondo == null) fondo = Math.abs(val);
      }
      const iFin = row.findIndex(x => typeof x === 'string' && /^SALDO EN CUENTA/.test(sinAcentos(x)));
      if (iFin >= 0) { const val = row.slice(iFin + 1).find(esNum); if (val) saldosFin.push({ y, val });
      }
      if (!grupo) return;
      const con = row[cC];
      if (typeof con === 'string' && con.trim() && !/^X+$/.test(con.trim())) { ctx = { concepto: con.trim() }; }
      if (cF >= 0 && esFecha(row[cF])) ctx.fecha = iso(row[cF]);
      if (cG >= 0 && typeof row[cG] === 'string' && row[cG].trim()) ctx.detalle = row[cG].trim();
      const imp = cK >= 0 ? row[cK] : null;
      if (esNum(imp) && imp !== 0 && ctx.concepto) {
        if (grupo === 'derrama' && tieneLista) { ctx.fecha = null; ctx.detalle = null; return; }
        const concepto = ctx.concepto + (ctx.detalle ? ' · ' + ctx.detalle : '');
        const k = `${grupo}|${sinAcentos(concepto)}|${r2(imp)}`;
        if (!vistos.has(k)) {
          vistos.add(k);
          gastos.push({ fecha: ctx.fecha || `${y}-12-31`, concepto, proveedor: '', importe: r2(imp), grupo, _d: grupo === 'derrama' ? derramas[0]?._key : undefined, estado: 'pagado', importado: true, nota: ctx.fecha ? '' : 'Sin fecha en el Excel' });
        }
        ctx.fecha = null; ctx.detalle = null;
      }
    });
  });

  /* ---------- Vecinos: cuota actual e historial ---------- */
  const vecinos = Object.entries(vec).map(([key, v]) => {
    const meses = Object.keys(v.meses).sort();
    const pos = meses.filter(k => v.meses[k] > 0);
    const hist = [];
    pos.forEach((k, i) => {
      const val = r2(v.meses[k]);
      const cur = hist.length ? hist[hist.length - 1].importe : null;
      if (cur === null) { hist.push({ desde: k, importe: val }); return; }
      if (Math.abs(val - cur) > 0.05) {
        const sig = pos[i + 1] ? r2(v.meses[pos[i + 1]]) : null;
        if (sig !== null && Math.abs(sig - val) <= 0.05) hist.push({ desde: k, importe: val });
      }
    });
    const c = coef[key];
    const actual = hist.length ? hist[hist.length - 1].importe : 0;
    if (cuotaCalc[key] && actual && Math.abs(cuotaCalc[key] - actual) > 0.05) avisos.push(`${v.piso}: paga ahora ${String(actual.toFixed(2)).replace('.', ',')} € y en la hoja de nuevas cuotas pone ${String(cuotaCalc[key].toFixed(2)).replace('.', ',')} €. Revisa su cuota.`);
    if (c == null) avisos.push(`${v.piso}: no he encontrado su coeficiente`);
    return { _key: key, piso: v.piso, orden: v.orden, propietario: titulo(v.ultimoNombre || v.nombres[v.nombres.length - 1] || ''), propietariosAnteriores: v.nombres.slice(0, -1).map(titulo),
      coef: c != null ? (c < 1.5 ? c * 100 : c) : 0, cuota: hist.length ? hist[hist.length - 1].importe : 0, cuotaHistorial: hist, formaPago: 'Transferencia', idioma: 'ca', avisosEmail: true };
  });
  const sumaCoef = vecinos.reduce((a, v) => a + (Number(v.coef) || 0), 0);
  if (Math.abs(sumaCoef - 100) > 0.01) avisos.push(`Los coeficientes suman ${sumaCoef.toFixed(4).replace('.', ',')} % (no exactamente 100). Las derramas se reparten igual que en tu Excel.`);
  const anios = hojasIng.map(anioDe);
  const comunidad = { nombre: titulo(nombreCom) || file.name.replace(/\.\w+$/, ''), direccion: titulo(nombreCom), periodicidad: 'mensual', diaCobro: 10, cobrosDesde: primerMes || `${anios[0]}-01`,
    saldoInicial: saldoInicial != null ? r2(saldoInicial) : 0, saldoFecha: saldoFecha || '', fondoReserva: fondo != null ? r2(fondo) : 0, idioma: 'ca', normativa: 'Codi civil de Catalunya',
    notas: `Importada de ${file.name} el ${iso(new Date())}.` };
  for (const { y, val } of saldosFin) {
    if (saldoInicial == null) break;
    const fin = `${y}-12-31`, desde = saldoFecha || '0000';
    const calc = saldoInicial + cobros.filter(c => c.fecha > desde && c.fecha <= fin).reduce((a, c) => a + c.importe, 0) - gastos.filter(g => g.fecha > desde && g.fecha <= fin).reduce((a, g) => a + g.importe, 0);
    if (Math.abs(calc - val) > 0.5) avisos.push(`Saldo a 31/12/${y}: en el Excel pone ${val.toFixed(2).replace('.', ',')} € y con los movimientos importados sale ${calc.toFixed(2).replace('.', ',')} €. La diferencia (${(val - calc).toFixed(2).replace('.', ',')} €) no está detallada en el Excel; puedes apuntarla como «Otro ingreso».`);
  }
  if (!saldoInicial) avisos.push('No he encontrado el saldo inicial del banco: indícalo en Datos de la comunidad');
  return { comunidad, vecinos, cobros, derramas, gastos, avisos, anios, sumaCoef };
}
