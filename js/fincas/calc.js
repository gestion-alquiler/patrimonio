// Admon. Fincas: cuotas esperadas, cobros, deudas, derramas y balance de cada comunidad
import { hoyISO } from '../ui.js';

const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const TOL = 0.10; // diferencias de céntimos (redondeos del Excel) se dan por cobradas

export const vecinosDe = (d, comId) => d.vecinos.filter(v => v.comunidadId === comId);

export function tocaCobrar(com, m) {
  return com.periodicidad === 'trimestral' ? [1, 4, 7, 10].includes(m) : true;
}

export function cuotaEn(v, y, m) {
  const k = ym(y, m);
  const all = (v.cuotaHistorial || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : 1));
  const h = all.filter(x => x.desde <= k);
  if (h.length) return Number(h[h.length - 1].importe) || 0;
  if (all.length) return Number(all[0].importe) || 0;
  return Number(v.cuota) || 0;
}

export function cobradoCuota(cobros, vId, y, m) {
  const cs = cobros.filter(c => c.vecinoId === vId && c.concepto === 'cuota' && c.anio === y && c.mes === m);
  return { imp: cs.reduce((a, c) => a + (Number(c.importe) || 0), 0), cubre: cs.some(c => c.cubre), lista: cs };
}

// Estado de una casilla de cuota: na | previo | pagado | parcial | debe | futuro | pendiente
export function estadoCuota(com, v, cobros, y, m, hoy = hoyISO()) {
  const k = ym(y, m);
  const cob = cobradoCuota(cobros, v.id, y, m);
  if (!tocaCobrar(com, m)) return { estado: 'na', esp: 0, pag: cob.imp, cob };
  if ((com.cobrosDesde && k < com.cobrosDesde) || (v.alta && k < v.alta.slice(0, 7))) return { estado: cob.imp ? 'pagado' : 'previo', esp: 0, pag: cob.imp, cob };
  const esp = cuotaEn(v, y, m);
  if (!esp) return { estado: cob.imp ? 'pagado' : 'na', esp, pag: cob.imp, cob };
  if (cob.cubre || cob.imp >= esp - TOL) return { estado: 'pagado', esp, pag: cob.imp, cob };
  const venc = `${k}-${String(Math.min(Number(com.diaCobro) || 10, 28)).padStart(2, '0')}`;
  if (cob.imp > 0) return { estado: venc < hoy ? 'parcial' : 'parcial', esp, pag: cob.imp, cob };
  if (venc < hoy) return { estado: 'debe', esp, pag: 0, cob };
  if (k > hoy.slice(0, 7)) return { estado: 'futuro', esp, pag: 0, cob };
  return { estado: 'pendiente', esp, pag: 0, cob };
}

// Parte de una derrama que corresponde a un vecino
export function parteDerrama(der, v, vecinosCom) {
  if (der.reparto === 'iguales') return (Number(der.total) || 0) / Math.max(1, vecinosCom.length);
  return (Number(der.total) || 0) * (Number(v.coef) || 0) / 100;
}
export function cobradoDerrama(cobros, vId, derId, plazo) {
  const cs = cobros.filter(c => c.vecinoId === vId && c.concepto === 'derrama' && c.derramaId === derId && (plazo == null || Number(c.plazo || 0) === plazo));
  return { imp: cs.reduce((a, c) => a + (Number(c.importe) || 0), 0), lista: cs };
}

export function deudaVecino(com, v, d, hoy = hoyISO()) {
  const det = [];
  let total = 0;
  const desde = [com.cobrosDesde, v.alta ? v.alta.slice(0, 7) : null].filter(Boolean).sort().pop() || hoy.slice(0, 4) + '-01';
  let [y, m] = desde.split('-').map(Number);
  const [hy, hm] = hoy.slice(0, 7).split('-').map(Number);
  let guard = 0;
  while ((y < hy || (y === hy && m <= hm)) && guard++ < 600) {
    const e = estadoCuota(com, v, d.cobros, y, m, hoy);
    if (e.estado === 'debe' || (e.estado === 'parcial' && `${ym(y, m)}-${String(Math.min(Number(com.diaCobro) || 10, 28)).padStart(2, '0')}` < hoy)) {
      const falta = e.esp - e.pag; total += falta; det.push({ tipo: 'cuota', y, m, falta });
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  const vc = vecinosDe(d, com.id);
  d.derramas.filter(x => x.comunidadId === com.id).forEach(der => {
    const parte = parteDerrama(der, v, vc), n = (der.plazos || []).length || 1;
    (der.plazos || [{ mes: der.fechaJunta?.slice(0, 7) || hoy.slice(0, 7) }]).forEach((pl, i) => {
      if (pl.mes > hoy.slice(0, 7)) return;
      const c = cobradoDerrama(d.cobros, v.id, der.id, i).imp;
      const falta = parte / n - c;
      if (falta > TOL) { total += falta; det.push({ tipo: 'derrama', der: der.concepto, plazo: i + 1, falta }); }
    });
  });
  if (Number(v.saldoAnterior) < 0) { total += -Number(v.saldoAnterior); det.unshift({ tipo: 'saldo', falta: -Number(v.saldoAnterior) }); }
  return { total, det };
}

// Saldo bancario al inicio de un año y movimientos del año
export function balanceComunidad(com, d, y) {
  const cobros = d.cobros.filter(c => c.comunidadId === com.id && c.fecha);
  const gastos = d.gastos.filter(g => g.comunidadId === com.id && g.fecha && g.estado !== 'pendiente');
  const base = com.saldoFecha || '0000-01-01';
  let saldoIni = Number(com.saldoInicial) || 0;
  const ini = `${y}-01-01`;
  if (base < ini) {
    cobros.forEach(c => { if (c.fecha > base && c.fecha < ini) saldoIni += Number(c.importe) || 0; });
    gastos.forEach(g => { if (g.fecha > base && g.fecha < ini) saldoIni -= Number(g.importe) || 0; });
  }
  const meses = Array.from({ length: 12 }, () => ({ ing: 0, gas: 0 }));
  const enAnio = (f) => Number(f.slice(0, 4)) === y && f > (base < ini ? '0000' : base);
  cobros.forEach(c => { if (enAnio(c.fecha)) meses[Number(c.fecha.slice(5, 7)) - 1].ing += Number(c.importe) || 0; });
  gastos.forEach(g => { if (enAnio(g.fecha)) meses[Number(g.fecha.slice(5, 7)) - 1].gas += Number(g.importe) || 0; });
  const ing = meses.reduce((a, x) => a + x.ing, 0), gas = meses.reduce((a, x) => a + x.gas, 0);
  return { saldoIni, meses, ing, gas, saldoFin: saldoIni + ing - gas, base };
}

export function saldoActual(com, d) {
  const y = Number(hoyISO().slice(0, 4));
  return balanceComunidad(com, d, y).saldoFin;
}

export const GRUPOS = [['coef', 'Por coeficiente'], ['iguales', 'A partes iguales'], ['derrama', 'Derrama / obra']];
export const grupoTxt = (g) => (GRUPOS.find(x => x[0] === g) || [, 'Por coeficiente'])[1];
export const sumaCoef = (vs) => vs.reduce((a, v) => a + (Number(v.coef) || 0), 0);
export const coefTxt = (c) => (Number(c) || 0).toFixed(4).replace('.', ',');
