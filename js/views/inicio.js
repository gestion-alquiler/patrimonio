import { esc, eur, fecha, hoyISO, diasEntre, MESES, MES3 } from '../ui.js';
import { contratoActivo, deudaContrato, balanceAnual, estadoMes } from '../calc.js';
import { resumenDeuda } from './ficha.js';
import { ultimaCopiaComun, esMovil } from '../copias.js';

export async function render(_, d) {
  const hoy = hoyISO(), y = Number(hoy.slice(0, 4)), m = Number(hoy.slice(5, 7));
  const activos = d.props.map(p => ({ p, c: contratoActivo(d.contratos, p.id) }));
  const alq = activos.filter(x => x.c);
  const bal = balanceAnual(y, d.pagos, d.gastos);
  let espMes = 0, cobMes = 0, deudaTot = 0;
  const filas = alq.map(({ p, c }) => {
    const r = estadoMes(c, d.pagos, y, m, 'renta'), b = estadoMes(c, d.pagos, y, m, 'basura');
    const esp = r.esp + b.esp, pag = r.pag + b.pag; espMes += esp; cobMes += Math.min(pag, esp);
    const deuda = deudaContrato(c, d.pagos); deudaTot += deuda.total;
    const est = pag >= esp - 0.005 ? ['Cobrado', 'ok'] : pag > 0 ? ['Parcial ' + eur(pag), 'warn'] : (r.estado === 'debe' ? ['Sin cobrar', 'bad'] : ['Vence el día ' + (c.diaPago || 5), 'neutral']);
    return { p, c, inq: d.inq(c.inquilinoId), esp, est, deuda };
  });
  const avisos = [];
  filas.filter(f => f.deuda.total > 0.005).forEach(f => avisos.push({ cls: 'bad', tipo: 'Pendiente', t: `${f.p.direccion} · ${f.inq?.nombre || ''}`, dsc: `Pendiente ${eur(f.deuda.total)} · ${resumenDeuda(f.deuda.detalle)}`, href: `#/propiedad/${f.p.id}/pagos` }));
  alq.forEach(({ p, c }) => {
    if (c.fin) { const dd = diasEntre(hoy, c.fin); if (dd >= 0 && dd <= 150) avisos.push({ cls: 'warn', tipo: 'Contrato', t: `${p.direccion} · vence el ${fecha(c.fin)}`, dsc: `Faltan ${dd} días. Si no quieres renovar, el preaviso del arrendador es de 4 meses.`, href: `#/propiedad/${p.id}/inquilino` }); }
    if (c.mesActualizacion && c.actualizacion && c.actualizacion !== 'Ninguna') {
      const prox = (m % 12) + 1;
      if (Number(c.mesActualizacion) === m || Number(c.mesActualizacion) === prox) {
        const k = `${Number(c.mesActualizacion) === prox && prox === 1 ? y + 1 : y}-${String(c.mesActualizacion).padStart(2, '0')}`;
        const hecho = (c.historialRenta || []).some(h => h.desde === k);
        if (!hecho) avisos.push({ cls: 'info', tipo: c.actualizacion, t: `${p.direccion} · actualizar renta`, dsc: `Toca en ${MESES[c.mesActualizacion - 1].toLowerCase()}. Comunícalo por escrito al inquilino.`, href: `#/propiedad/${p.id}/inquilino` });
      }
    }
  });
  const pendientes = d.gastos.filter(g => g.estado === 'pendiente' && g.fecha && diasEntre(hoy, g.fecha) <= 10);
  const porProp = {};
  pendientes.forEach(g => { (porProp[g.propiedadId] = porProp[g.propiedadId] || []).push(g); });
  Object.entries(porProp).forEach(([pid, gs]) => { const p = d.props.find(x => x.id === pid); const tot = gs.reduce((a, g) => a + Number(g.importe || 0), 0);
    avisos.push({ cls: 'warn', tipo: 'Pagar', t: `${p?.direccion || ''} · ${gs.length === 1 ? gs[0].concepto : gs.length + ' gastos pendientes'}`, dsc: `${eur(tot)}${gs.length === 1 ? ' · vence el ' + fecha(gs[0].fecha) : ''}`, href: `#/propiedad/${pid}/gastos` }); });
  const u = await ultimaCopiaComun(), dias = u ? diasEntre(u.slice(0, 10), hoy) : null;
  if (d.props.length && !esMovil() && (dias === null || dias > (d.aj.recordatorioDias || 15))) avisos.push({ cls: 'neutral', tipo: 'Copia', t: 'Copia de seguridad completa', dsc: u ? `La última es de hace ${dias} días` : 'Aún no has hecho ninguna', href: '#/ajustes' });

  const ultGastos = d.gastos.filter(g => g.fecha && g.fecha <= hoy).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 4);
  const ft = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); const fechaTxt = ft.charAt(0).toUpperCase() + ft.slice(1);
  if (!d.props.length) return `<div class="page"><div class="head"><div><div class="sub">${esc(fechaTxt)}</div><h1>Bienvenido</h1></div></div>
    <div class="card empty"><h2>Empieza por tus propiedades</h2><p style="margin:0;max-width:520px">Da de alta tus viviendas y locales, sus inquilinos y contratos. A partir de ahí la app controla cobros, gastos y margen de cada una.</p>
    <div class="actions"><a class="btn primary" href="#/propiedades">Ir a Propiedades</a><a class="btn" href="#/ajustes">Restaurar una copia</a></div></div></div>`;
  return `<div class="page">
  <div class="head"><div><div class="sub">${esc(fechaTxt)}</div><h1>Resumen de ${MESES[m - 1].toLowerCase()}</h1></div>
    <div class="actions"><a class="btn" href="#/propiedades">Ver propiedades</a></div></div>
  <section class="kpis" aria-label="Indicadores">
    <div class="card kpi"><div class="l">Propiedades</div><div class="v">${d.props.length}</div><div class="s">${alq.length} alquiladas · ${d.props.length - alq.length} libres</div></div>
    <div class="card kpi"><div class="l">Cobrado este mes</div><div class="v">${eur(cobMes, 0)}</div><div class="s">de ${eur(espMes, 0)} previstos</div></div>
    <div class="card kpi"><div class="l">Pendiente de cobro</div><div class="v ${deudaTot > 0.005 ? 'neg' : ''}">${eur(deudaTot, 0)}</div><div class="s">${filas.filter(f => f.deuda.total > 0.005).length} inquilinos con importes pendientes</div></div>
    <div class="card kpi"><div class="l">Margen ${y}</div><div class="v ${bal.margen < 0 ? 'neg' : ''}">${eur(bal.margen, 0)}</div><div class="s">Ingresos ${eur(bal.ing, 0)} − gastos ${eur(bal.gas, 0)}</div></div>
  </section>
  <div class="row">
    <section class="card pad stack grow1"><div class="head" style="align-items:center"><h2>Avisos</h2>${avisos.length ? `<span class="badge ${avisos.some(a => a.cls === 'bad') ? 'bad' : 'warn'}">${avisos.length}</span>` : ''}</div>
      ${avisos.map(a => `<a class="alert" href="${a.href}" style="text-decoration:none;color:inherit"><span class="badge ${a.cls}">${esc(a.tipo)}</span><div><div class="t">${esc(a.t)}</div><div class="d">${esc(a.dsc)}</div></div></a>`).join('') || '<div class="muted">Todo en orden.</div>'}
    </section>
    <section class="card grow2"><div class="cardhead"><h2>Cobros de ${MESES[m - 1].toLowerCase()}</h2></div>
      <div class="tw"><table><thead><tr><th>Vivienda</th><th>Inquilino</th><th class="r">Previsto</th><th>Estado</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td><a class="b" style="color:inherit;text-decoration:none" href="#/propiedad/${f.p.id}/pagos">${esc(f.p.direccion)}</a></td><td>${esc(f.inq?.nombre || '')}</td><td class="r num">${eur(f.esp)}</td><td><span class="badge ${f.est[1]}">${esc(f.est[0])}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No hay contratos activos</td></tr>'}
      </tbody></table></div></section>
  </div>
  <section class="card pad stack"><h2>Últimos gastos</h2>
    <div class="kpis">${ultGastos.map(g => { const p = d.props.find(x => x.id === g.propiedadId); return `<a href="#/propiedad/${g.propiedadId}/gastos" style="text-decoration:none;color:inherit;padding:14px;border:1px solid var(--line2);border-radius:10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="badge neutral">${esc(g.categoria)}</span><b class="num">${eur(g.importe)}</b></div><b>${esc(g.concepto)}</b><span class="small muted">${esc(p?.direccion || '')} · ${fecha(g.fecha)}</span></a>`; }).join('') || '<div class="muted">Sin gastos registrados.</div>'}</div></section>
  </div>`;
}
