// Ficha de un vecino en su propia página: se edita y solo se guarda con «Guardar».
import { db } from '../../db.js';
import { esc, eur, num, modal, confirmar, field, select, textarea, money, fd, toast, fecha, hoyISO, MESES, MES3 } from '../../ui.js';
import { vecinosDe, deudaVecino, coefTxt } from '../calc.js';
import { cartasDeVecino, paginaCartaVecino } from '../cartasFin.js';
import { abrirImpresion } from '../../imprimir.js';

const resDeuda = (x) => x.det.length <= 3 ? x.det.map(z => z.tipo === 'cuota' ? MES3[z.m - 1] + ' ' + String(z.y).slice(2) : z.tipo === 'saldo' ? 'saldo anterior' : `derrama (plazo ${z.plazo})`).join(', ') : `${x.det.length} recibos`;

export function renderVecino(c, vid, d) {
  const vs = vecinosDe(d, c.id);
  const nuevo = vid === 'nuevo';
  const x = nuevo ? { comunidadId: c.id, formaPago: 'Domiciliado', idioma: c.idioma || 'ca', avisosEmail: true, orden: vs.length } : vs.find(v => v.id === vid);
  if (!x) return `<div class="page"><a class="back" href="#/finca/${c.id}/vecinos">← Vecinos</a><div class="card empty"><h2>No se encuentra este vecino</h2></div></div>`;
  const hist = (x.cuotaHistorial || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : -1));
  const dd = nuevo ? { total: 0, det: [] } : deudaVecino(c, x, d);
  const ant = (x.historialPropietarios || []).slice().sort((a, b) => ((a.hasta || '') < (b.hasta || '') ? 1 : -1));
  const cobrosV = nuevo ? [] : d.cobros.filter(q => q.vecinoId === x.id);
  const cobradoEntre = (desde, hasta) => cobrosV.filter(q => (!desde || q.fecha >= desde) && (!hasta || q.fecha <= hasta)).reduce((a, q) => a + Number(q.importe || 0), 0);
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))';
  return `<div class="page" style="padding-bottom:90px">
  <a class="back" href="#/finca/${c.id}/vecinos">← Vecinos de ${esc(c.nombre)}</a>
  <div class="head"><div><h1>${nuevo ? 'Nuevo vecino' : esc(x.piso)}</h1><div class="sub">${nuevo ? 'Rellena los datos y pulsa Guardar.' : esc(x.propietario) + (x.propietarioDesde ? ' · propietario desde el ' + fecha(x.propietarioDesde) : '')}</div></div>
    ${nuevo ? '' : `<div class="actions"><span class="badge ${dd.total > 0.1 ? 'bad' : 'ok'}" title="${esc(resDeuda(dd))}">${dd.total > 0.1 ? 'Pendiente ' + eur(dd.total) : 'Al corriente'}</span><a class="btn" href="#/finca/${c.id}/carta/nueva/${x.id}">Escribir carta</a><button class="btn" data-v="cambio">Cambio de propietario</button></div>`}</div>
  <form id="fvec" class="stack" style="gap:20px" autocomplete="off">
  <section class="card pad stack"><h2>Piso</h2><div style="${grid};gap:14px">
    ${field('Piso / local', 'piso', x.piso, { required: true, placeholder: '1º 2ª, Baixos 1…' })}${field('Coeficiente (%)', 'coef', x.coef != null ? String(x.coef).replace('.', ',') : '', { inputmode: 'decimal', required: true, hint: 'Como en la escritura, p. ej. 14,4839' })}
    ${money('Cuota ' + (c.periodicidad === 'trimestral' ? 'trimestral' : 'mensual') + ' (€)', 'cuota', x.cuota)}${nuevo ? '' : field('Si cambias la cuota, se aplica desde', 'cuotaDesde', hoyISO().slice(0, 7), { type: 'month' })}
    ${field('Ocupante (si no es el propietario)', 'ocupante', x.ocupante)}${field('Teléfono del ocupante', 'ocupanteTel', x.ocupanteTel, { type: 'tel' })}</div>
    ${hist.length ? `<div class="small"><b>Historial de cuota:</b> ${hist.map(h => `${eur(h.importe)} desde ${MES3[Number(h.desde.slice(5, 7)) - 1]} ${h.desde.slice(0, 4)}`).join(' · ')}</div>` : ''}</section>
  <section class="card pad stack"><h2>Propietario</h2><div style="${grid};gap:14px">
    ${field('Nombre o razón social', 'propietario', x.propietario, { required: true })}${field('DNI / NIE / CIF', 'dni', x.dni)}${field('Teléfono', 'telefono', x.telefono, { type: 'tel' })}${field('Email', 'email', x.email, { type: 'email' })}
    ${field('Dirección para notificaciones', 'direccionNotif', x.direccionNotif, { placeholder: 'Si no vive en la finca' })}${select('Idioma de los escritos', 'idioma', x.idioma, [['ca', 'Català'], ['es', 'Castellano']])}
    ${field('Propietario desde', 'propietarioDesde', x.propietarioDesde, { type: 'date' })}<label class="check" style="align-self:end"><input type="checkbox" name="avisosEmail" ${x.avisosEmail ? 'checked' : ''}> Acepta avisos por email</label></div></section>
  <section class="card pad stack"><h2>Banco</h2><div style="${grid};gap:14px">
    ${select('Forma de pago', 'formaPago', x.formaPago, ['Domiciliado', 'Transferencia', 'Efectivo'])}${field('IBAN', 'iban', x.iban)}${field('Titular de la cuenta', 'titular', x.titular)}${field('Mandato SEPA (referencia y fecha)', 'mandato', x.mandato)}</div></section>
  <section class="card pad stack"><h2>Otros</h2><div class="fgrid">${money('Saldo anterior (€)', 'saldoAnterior', x.saldoAnterior, { hint: 'Negativo si arrastra deuda de antes del control de cuotas' })}${textarea('Observaciones', 'obs', x.obs)}</div></section>
  </form>
  ${nuevo ? '' : `<section class="card"><div class="cardhead"><div><h2>Propietarios anteriores</h2><div class="small muted">Se guardan para siempre, con sus datos y lo que quedó pendiente al cambiar.</div></div></div>
    <div class="tw"><table style="min-width:720px"><thead><tr><th>Propietario</th><th>Periodo</th><th>Contacto</th><th class="r">Cobrado en su periodo</th><th class="r">Pendiente al cambiar</th><th></th></tr></thead><tbody>
    ${ant.map((a, i) => `<tr><td class="b">${esc(a.propietario)}${a.dni ? `<div class="small muted" style="font-weight:400">${esc(a.dni)}</div>` : ''}</td><td class="num nw small">${a.desde ? fecha(a.desde) : '—'} – ${a.hasta ? fecha(a.hasta) : '—'}</td>
      <td class="small">${[a.telefono, a.email].filter(Boolean).map(esc).join('<br>') || '—'}</td><td class="r num">${eur(cobradoEntre(a.desde, a.hasta))}</td>
      <td class="r num ${a.pendiente > 0.1 ? 'neg b' : 'muted'}">${a.pendiente > 0.1 ? eur(a.pendiente) : '—'}${a.detallePendiente ? `<div class="small muted" style="font-weight:400">${esc(a.detallePendiente)}</div>` : ''}</td>
      <td class="nw"><button type="button" class="btn sm" data-ant="${i}">Revisar</button></td></tr>`).join('') || `<tr><td colspan="6" class="muted">${(x.propietariosAnteriores || []).length ? 'Nombres anteriores (importados): ' + x.propietariosAnteriores.map(esc).join(', ') : 'No hay cambios de propietario registrados.'}</td></tr>`}
    </tbody></table></div></section>
  ${cartasDeVecino(c, x, d)}
  <details class="card pad small"><summary style="cursor:pointer;color:var(--muted)">Opciones avanzadas</summary>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn sm danger" data-v="borrar">Borrar este vecino</button></div>
    <div class="muted" style="margin-top:6px">Borra el piso y todos sus cobros. Si solo ha cambiado el dueño, usa «Cambio de propietario».</div></details>`}
  <div class="barra-guardar"><span id="estadoForm" class="small muted">Sin cambios</span><a class="btn" href="#/finca/${c.id}/vecinos">Cancelar</a><button class="btn primary" data-v="guardar">Guardar</button></div>
  </div>`;
}

export function bindVecino(el, c, vid, d, refresh) {
  const vs = vecinosDe(d, c.id);
  const nuevo = vid === 'nuevo';
  const x = nuevo ? { comunidadId: c.id, orden: vs.length } : vs.find(v => v.id === vid);
  if (!x) return;
  const form = el.querySelector('#fvec'), est = el.querySelector('#estadoForm');
  let sucio = false;
  const marcar = () => { if (!sucio) { sucio = true; est.textContent = 'Hay cambios sin guardar'; est.classList.remove('muted'); est.style.color = 'var(--bad)'; est.style.fontWeight = '600'; } };
  form.addEventListener('input', marcar); form.addEventListener('change', marcar);
  window.__guard = async () => !sucio || await confirmar('Cambios sin guardar', 'Has hecho cambios en la ficha y no los has guardado. Si sales, se perderán.', 'Salir sin guardar');
  window.onbeforeunload = () => (sucio ? true : undefined);
  const volver = () => { sucio = false; window.onbeforeunload = null; location.hash = `#/finca/${c.id}/vecinos`; };

  el.querySelector('[data-v=guardar]').onclick = async () => {
    if (!form.reportValidity()) return;
    const y = fd(form);
    if (!y.piso.trim() || !y.propietario.trim()) { toast('Faltan el piso o el propietario'); return; }
    const nueva = num(y.cuota);
    const obj = { ...x, piso: y.piso.trim(), coef: num(y.coef), propietario: y.propietario.trim(), dni: y.dni, telefono: y.telefono, email: y.email, direccionNotif: y.direccionNotif, idioma: y.idioma, avisosEmail: !!y.avisosEmail, propietarioDesde: y.propietarioDesde,
      formaPago: y.formaPago, iban: y.iban, titular: y.titular, mandato: y.mandato, ocupante: y.ocupante, ocupanteTel: y.ocupanteTel, saldoAnterior: num(y.saldoAnterior), obs: y.obs };
    if (!nuevo && Math.abs(nueva - (Number(x.cuota) || 0)) > 0.001) {
      const h = (x.cuotaHistorial || []).slice(); if (!h.length && x.cuota) h.push({ desde: c.cobrosDesde || '2000-01', importe: Number(x.cuota) });
      const k = y.cuotaDesde || hoyISO().slice(0, 7); const i = h.findIndex(q => q.desde === k); if (i >= 0) h[i].importe = nueva; else h.push({ desde: k, importe: nueva });
      obj.cuotaHistorial = h;
    }
    obj.cuota = nueva;
    await db.put('f_vecinos', obj); toast(nuevo ? 'Vecino añadido' : 'Cambios guardados'); volver();
  };
  if (nuevo) return;

  el.querySelectorAll('[data-vcarta]').forEach(b => b.onclick = () => { const carta = d.cartas.find(q => q.id === b.dataset.vcarta); if (!abrirImpresion('Carta', [paginaCartaVecino(carta, x.id, c, d)])) toast('Permite las ventanas emergentes para esta página'); });
  el.querySelectorAll('[data-ant]').forEach(b => b.onclick = () => {
    const a = (x.historialPropietarios || []).slice().sort((p, q) => ((p.hasta || '') < (q.hasta || '') ? 1 : -1))[Number(b.dataset.ant)];
    modal({ title: 'Propietario anterior · ' + a.propietario, submit: 'Guardar', wide: true,
      body: `<div class="small muted">${esc(x.piso)} · de ${a.desde ? fecha(a.desde) : '—'} a ${a.hasta ? fecha(a.hasta) : '—'}</div>
      <div class="fgrid">${field('Nombre', 'propietario', a.propietario)}${field('DNI / NIE / CIF', 'dni', a.dni)}${field('Teléfono', 'telefono', a.telefono)}${field('Email', 'email', a.email)}
      ${field('Dirección para notificaciones', 'direccionNotif', a.direccionNotif)}${field('IBAN', 'iban', a.iban)}${field('Desde', 'desde', a.desde, { type: 'date' })}${field('Hasta', 'hasta', a.hasta, { type: 'date' })}
      ${money('Pendiente al cambiar (€)', 'pendiente', a.pendiente)}${field('Detalle de lo pendiente', 'detallePendiente', a.detallePendiente)}${textarea('Notas (notaría, acuerdos, reclamaciones…)', 'nota', a.nota)}</div>`,
      onSubmit: async (f) => { const y = fd(f); const lista = (x.historialPropietarios || []).map(q => q === a ? { ...a, ...y, pendiente: num(y.pendiente) } : q);
        await db.put('f_vecinos', { ...x, historialPropietarios: lista }); toast('Guardado'); refresh(); } });
  });

  el.querySelector('[data-v=cambio]').onclick = async () => {
    if (sucio && !(await confirmar('Cambios sin guardar', 'Antes del cambio de propietario se descartarán los cambios que no has guardado.', 'Continuar'))) return;
    const dd = deudaVecino(c, x, d);
    modal({ title: `Cambio de propietario · ${x.piso}`, submit: 'Registrar el cambio', wide: true,
      body: `<div class="alert"><div><b>${esc(x.propietario)}</b> pasará a «Propietarios anteriores» con todos sus datos.${dd.total > 0.1 ? `<br>Tiene <b>${eur(dd.total)}</b> pendientes (${esc(resDeuda(dd))}): quedarán anotados en su histórico.` : ''}</div></div>
      <div class="fgrid">${field('Fecha del cambio (escritura)', 'fecha', hoyISO(), { type: 'date', required: true })}${field('Nuevo propietario', 'propietario', '', { required: true })}
      ${field('DNI / NIE / CIF', 'dni', '')}${field('Teléfono', 'telefono', '', { type: 'tel' })}${field('Email', 'email', '', { type: 'email' })}${select('Idioma de los escritos', 'idioma', x.idioma || 'ca', [['ca', 'Català'], ['es', 'Castellano']])}
      ${select('Forma de pago', 'formaPago', 'Domiciliado', ['Domiciliado', 'Transferencia', 'Efectivo'])}${field('IBAN', 'iban', '')}${field('Dirección para notificaciones', 'direccionNotif', '')}
      ${textarea('Notas del cambio', 'nota', '', { placeholder: 'Notaría, quién asume lo pendiente, certificado de deudas emitido…' })}</div>
      <div class="small muted">El ocupante, el coeficiente y la cuota del piso no cambian. Revisa con la notaría y el nuevo propietario quién asume lo pendiente.</div>`,
      onSubmit: async (f) => {
        const y = fd(f); if (!y.propietario.trim() || !y.fecha) { toast('Faltan el nuevo propietario o la fecha'); return false; }
        const anterior = { propietario: x.propietario, dni: x.dni, telefono: x.telefono, email: x.email, direccionNotif: x.direccionNotif, iban: x.iban, titular: x.titular, idioma: x.idioma,
          desde: x.propietarioDesde || x.alta || '', hasta: y.fecha, pendiente: Math.round(dd.total * 100) / 100, detallePendiente: dd.total > 0.1 ? resDeuda(dd) : '', nota: y.nota };
        await db.put('f_vecinos', { ...x, historialPropietarios: [...(x.historialPropietarios || []), anterior], propietariosAnteriores: [...new Set([...(x.propietariosAnteriores || []), x.propietario])],
          propietario: y.propietario.trim(), dni: y.dni, telefono: y.telefono, email: y.email, idioma: y.idioma, formaPago: y.formaPago, iban: y.iban, titular: y.propietario.trim(), mandato: '', direccionNotif: y.direccionNotif, propietarioDesde: y.fecha });
        toast('Cambio de propietario registrado'); sucio = false; refresh();
      } });
  };

  el.querySelector('[data-v=borrar]').onclick = async () => {
    if (await confirmar('Borrar vecino', `Se borrará <b>${esc(x.piso)}</b> y todos sus cobros. No se puede deshacer.`)) {
      for (const q of d.cobros.filter(q => q.vecinoId === x.id)) await db.del('f_cobros', q.id);
      await db.del('f_vecinos', x.id); toast('Vecino borrado'); volver();
    }
  };
}
