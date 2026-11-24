// Cálculos: qué se espera cobrar cada mes, qué se ha cobrado, deudas, balance
import { hoyISO } from './ui.js';

const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

// ¿El contrato cubre el mes (y, m)?
export function cubreMes(c, y, m) {
  const ini = (c.inicio || '').slice(0, 7);
  const finEf = (c.estado === 'finalizado' && c.fechaSalida) ? c.fechaSalida : c.fin;
  const fin = (finEf || '9999-12').slice(0, 7);
  const k = ym(y, m);
  return ini && k >= ini && k <= fin;
}

// Renta vigente en un mes, teniendo en cuenta las actualizaciones guardadas
export function rentaEn(c, y, m) {
  const k = ym(y, m);
  const hist = (c.historialRenta || []).filter(h => h.desde <= k).sort((a, b) => a.desde < b.desde ? 1 : -1);
  return hist.length ? Number(hist[0].importe) : Number(c.renta) || 0;
}

export function esperado(c, y, m, concepto) {
  if (!cubreMes(c, y, m)) return 0;
  if (concepto === 'basura') return c.basuraPaga === 'inquilino' ? Number(c.basuraImporte) || 0 : 0;
  return rentaEn(c, y, m);
}

export function pagadoMes(pagos, contratoId, y, m, concepto) {
  return pagos.filter(p => p.contratoId === contratoId && p.anio === y && p.mes === m && p.concepto === concepto)
    .reduce((a, p) => a + (Number(p.importe) || 0), 0);
}

// Estado de la casilla: na | futuro | pagado | parcial | debe | pendiente (aún no vencido)
export function estadoMes(c, pagos, y, m, concepto, hoy = hoyISO()) {
  const esp = esperado(c, y, m, concepto);
  if (!esp) return { estado: 'na', esp: 0, pag: 0 };
  if (c.cobrosDesde && ym(y, m) < c.cobrosDesde) return { estado: 'previo', esp, pag: pagadoMes(pagos, c.id, y, m, concepto) };
  const pag = pagadoMes(pagos, c.id, y, m, concepto);
  const venc = `${ym(y, m)}-${String(Math.min(Number(c.diaPago) || 5, 28)).padStart(2, '0')}`;
  if (pag >= esp - 0.005) return { estado: 'pagado', esp, pag };
  if (pag > 0) return { estado: venc < hoy ? 'parcial' : 'parcial', esp, pag };
  if (venc < hoy) return { estado: 'debe', esp, pag };
  if (ym(y, m) > hoy.slice(0, 7)) return { estado: 'futuro', esp, pag };
  return { estado: 'pendiente', esp, pag };
}

// Deuda acumulada de un contrato hasta hoy (solo meses ya vencidos)
export function deudaContrato(c, pagos, hoy = hoyISO()) {
  if (!c.inicio) return { total: 0, detalle: [] };
  const desde = c.cobrosDesde && c.cobrosDesde > c.inicio.slice(0, 7) ? c.cobrosDesde : c.inicio.slice(0, 7);
  let [y, m] = desde.split('-').map(Number);
  const [hy, hm] = hoy.slice(0, 7).split('-').map(Number);
  const detalle = [];
  let total = 0, guard = 0;
  while ((y < hy || (y === hy && m <= hm)) && guard++ < 600) {
    for (const concepto of ['renta', 'basura']) {
      const e = estadoMes(c, pagos, y, m, concepto, hoy);
      if (e.estado === 'debe' || (e.estado === 'parcial' && `${ym(y, m)}-${String(Math.min(Number(c.diaPago) || 5, 28)).padStart(2, '0')}` < hoy)) {
        const falta = e.esp - e.pag; total += falta; detalle.push({ y, m, concepto, falta });
      }
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  return { total, detalle };
}

export function contratoActivo(contratos, propiedadId) {
  return contratos.filter(c => c.propiedadId === propiedadId && c.estado !== 'finalizado')
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0] || null;
}

// Balance mensual de una propiedad (o de todas si propiedadId es null)
export function balanceAnual(y, pagos, gastos, propiedadId = null) {
  const meses = Array.from({ length: 12 }, () => ({ ing: 0, gas: 0 }));
  for (const p of pagos) {
    if (propiedadId && p.propiedadId !== propiedadId) continue;
    const f = p.fecha || `${ym(p.anio, p.mes)}-01`;
    if (Number(f.slice(0, 4)) === y) meses[Number(f.slice(5, 7)) - 1].ing += Number(p.importe) || 0;
  }
  for (const g of gastos) {
    if (propiedadId && g.propiedadId !== propiedadId) continue;
    if (!g.fecha || Number(g.fecha.slice(0, 4)) !== y) continue;
    if (g.estado === 'pendiente' && g.fecha > hoyISO()) continue; // gastos futuros aún no realizados
    meses[Number(g.fecha.slice(5, 7)) - 1].gas += Number(g.importe) || 0;
  }
  const ing = meses.reduce((a, x) => a + x.ing, 0), gas = meses.reduce((a, x) => a + x.gas, 0);
  return { meses, ing, gas, margen: ing - gas, pct: ing ? (ing - gas) / ing : 0 };
}

export const CATEGORIAS_GASTO = ['Comunidad', 'IBI', 'Mantenimiento', 'Extraordinario / obras', 'Seguro', 'Basuras', 'Suministros', 'Gestoría / honorarios', 'Otros'];
export const TIPOS_DOC = [['contrato', 'Contrato'], ['dni', 'DNI / NIE'], ['cuenta', 'Certificado de cuenta'], ['nominas', 'Nóminas'], ['trabajo', 'Contrato de trabajo'], ['aval', 'Aval / DNI avalista'], ['renta', 'Declaración de la renta'], ['fianza', 'Depósito de fianza'], ['inventario', 'Inventario / entrega de llaves'], ['escritura', 'Escritura'], ['certificado', 'Certificado energético'], ['factura', 'Factura / recibo'], ['foto', 'Foto'], ['otro', 'Otro']];
export const DOCS_INQUILINO = ['dni', 'cuenta', 'nominas', 'trabajo', 'aval', 'renta', 'fianza', 'inventario'];
