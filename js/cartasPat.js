// Cartas de Patrimonio (al inquilino actual o a inquilinos anteriores): configuración para el módulo común de cartas.
import { setAjustes, getAjustes } from './db.js';
import { esc, eur, fecha, MESES, MES3 } from './ui.js';
import { deudaContrato, rentaEn } from './calc.js';
import { paginaCarta } from './imprimir.js';
import { fechaLarga } from './fincas/docs.js';
import { rellenar, MARCAS, modelosCarta, htmlATexto } from './plantillas.js';
import { listaCartasHtml, enlazarListaCartas, redactarHtml, enlazarRedactar, textoCarta } from './cartas.js';

const MESCA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const detalle = (dd, l) => dd.detalle.map(z => z.concepto === 'basura' ? (l === 'ca' ? "escombraries " : 'basura ') + z.y : (l === 'ca' ? MESCA : MESES.map(m => m.toLowerCase()))[z.m - 1] + ' ' + z.y).join(', ');

// Destinatarios: un contrato = un inquilino (actual o anterior)
const destinatarios = (p, d) => d.contratos.filter(k => k.propiedadId === p.id).sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).map(k => {
  const i = d.inq(k.inquilinoId) || {};
  return { id: k.id, nombre: i.nombre || 'Inquilino', detalle: k.estado === 'finalizado' ? `Anterior (${fecha(k.inicio)} – ${fecha(k.fechaSalida || k.fin)})` : 'Contrato actual', idioma: i.idioma === 'ca' ? 'ca' : 'es', email: i.email, k, i };
});

function vars(p, k, d, l) {
  const i = d.inq(k.inquilinoId) || {}, pr = d.aj?.propietario || {}, dd = deudaContrato(k, d.pagos);
  const hoy = new Date(); const rent = rentaEn(k, hoy.getFullYear(), hoy.getMonth() + 1) || k.renta;
  return { inquilino: i.nombre || '', direccion_inmueble: [p.direccion, p.zona].filter(Boolean).join(', '), renta_actual: eur(rent), importe_pendiente: eur(dd.total), detalle_pendiente: detalle(dd, l) || '—',
    fecha_inicio_contrato: fechaLarga(k.inicio, l), fecha_fin_contrato: fechaLarga(k.fin, l), fianza: k.fianza ? eur(k.fianza) : '—', indice_actualizacion: k.actualizacion || 'IPC',
    mes_actualizacion: k.mesActualizacion ? (l === 'ca' ? MESCA : MESES.map(m => m.toLowerCase()))[k.mesActualizacion - 1] : '________',
    propietario_nombre: pr.nombre || '', propietario_telefono: pr.telefono || '', propietario_email: pr.email || '', iban_propietario: pr.iban || '________________', fecha_hoy: fechaLarga(hoy.toISOString().slice(0, 10), l) };
}

export function paginaCartaInquilino(carta, kid, p, d) {
  const k = d.contratos.find(x => x.id === kid); if (!k) return '';
  const i = d.inq(k.inquilinoId) || {}, pr = d.aj?.propietario || {};
  const { l, asunto, cuerpo } = textoCarta(carta, { idioma: i.idioma === 'ca' ? 'ca' : 'es' });
  const vv = vars(p, k, d, l);
  const loc = (p.zona || '').trim();
  return paginaCarta({ color: '#2F6B4F', cabIzq: `<b>${esc(pr.nombre || 'Propietario/a')}</b>${pr.dni ? '<br>' + esc(pr.dni) : ''}`, cabDer: `${esc(pr.direccion || '')}${pr.telefono ? '<br>' + esc(pr.telefono) : ''}${pr.email ? ' · ' + esc(pr.email) : ''}`,
    destinatario: `${esc(i.nombre || '')}<br>${esc(p.direccion || '')}${loc ? '<br>' + esc(loc) : ''}`, lugarFecha: `${loc ? loc + ', ' : ''}${fechaLarga(carta.fecha, l)}`,
    asunto: htmlATexto(rellenar(asunto, vv)), cuerpo: rellenar(cuerpo, vv), firma: `<div class="esp"></div>${esc(pr.nombre || '')}` });
}

function emailDe(carta, kid, p, d) {
  const k = d.contratos.find(x => x.id === kid), i = d.inq(k.inquilinoId) || {}, pr = d.aj?.propietario || {};
  const { l, asunto, cuerpo } = textoCarta(carta, { idioma: i.idioma === 'ca' ? 'ca' : 'es' }); const vv = vars(p, k, d, l);
  return { to: i.email || '', asunto: htmlATexto(rellenar(asunto, vv)), cuerpo: htmlATexto(rellenar(cuerpo, vv)) + `\n\n${pr.nombre || ''}\n${pr.telefono || ''}`.trimEnd() };
}

const st = { sel: null };
export function tabCartas(p, d) {
  const ds = new Map(destinatarios(p, d).map(x => [x.id, x]));
  return listaCartasHtml({ cartas: d.cartas.filter(x => x.propiedadId === p.id), destinatarios: ds, sel: st.sel, nueva: `#/propiedad/${p.id}/carta/nueva`, editar: (id) => `#/propiedad/${p.id}/carta/${id}`,
    vacio: ds.size ? 'Aún no hay cartas. Con «+ Nueva carta» puedes escribir al inquilino: reclamaciones, avisos de visita, actualización de renta, fin de contrato…' : 'Esta propiedad aún no tiene inquilinos.' });
}
export function bindTabCartas(el, p, d, refresh) {
  const ds = new Map(destinatarios(p, d).map(x => [x.id, x]));
  enlazarListaCartas(el, { cartas: d.cartas.filter(x => x.propiedadId === p.id), destinatarios: ds, sel: st.sel, store: 'cartas', editar: (id) => `#/propiedad/${p.id}/carta/${id}`,
    paginaDe: (carta, id) => paginaCartaInquilino(carta, id, p, d), emailDe: (carta, id) => emailDe(carta, id, p, d), alCambiar: (id) => { st.sel = id; refresh(); }, refresh });
}

function cfg(p, sub, pre, d) {
  const carta = sub === 'nueva' ? null : d.cartas.find(x => x.id === sub);
  const des = destinatarios(p, d);
  const actual = des.find(x => x.k.estado !== 'finalizado');
  const volver = pre ? `#/propiedad/${p.id}/historico/${pre}` : `#/propiedad/${p.id}/cartas`;
  return { titulo: carta ? 'Editar carta' : 'Nueva carta', volver, carta, base: { propiedadId: p.id }, destinatarios: des, filtros: actual ? [['Inquilino actual', [actual.id]]] : [],
    preseleccion: pre ? [pre] : actual ? [actual.id] : [], modelos: modelosCarta('pat', d.aj), marcas: MARCAS.pat, store: 'cartas',
    paginaDe: (cc, id) => paginaCartaInquilino(cc, id, p, d),
    guardarModelo: async (m) => { const aj = await getAjustes(); aj.cartasPlantillas = [...(aj.cartasPlantillas || []), m]; await setAjustes(aj); d.aj = aj; },
    alGuardar: (obj) => { st.sel = obj.id; location.hash = volver; } };
}
export const renderRedactar = (p, sub, pre, d) => redactarHtml(cfg(p, sub, pre, d));
export const bindRedactar = (el, p, sub, pre, d) => enlazarRedactar(el, cfg(p, sub, pre, d));

// Cartas de un contrato (para la ficha «Revisar» del histórico)
export function cartasDeContrato(p, k, d) {
  const cs = d.cartas.filter(x => x.propiedadId === p.id && (x.destinatarios || []).includes(k.id)).sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));
  const i = d.inq(k.inquilinoId) || {};
  return `<section class="card"><div class="cardhead"><div><h2>Cartas enviadas</h2><div class="small muted">Quedan guardadas para siempre, con su fecha.</div></div><a class="btn sm primary" href="#/propiedad/${p.id}/carta/nueva/${k.id}">Escribir carta</a></div>
    <div class="tw"><table><thead><tr><th>Fecha</th><th>Asunto</th><th>Enviada</th><th></th></tr></thead><tbody>
    ${cs.map(x => { const env = (x.envios || {})[k.id]; const { l, asunto } = textoCarta(x, { idioma: i.idioma === 'ca' ? 'ca' : 'es' });
      return `<tr><td class="num nw">${fecha(x.fecha)}</td><td class="b">${esc(htmlATexto(rellenar(asunto, vars(p, k, d, l))) || 'Sin asunto')}</td><td class="small">${env ? fecha(env.fecha) + ' · ' + esc(env.via) : '—'}</td><td><button type="button" class="btn sm" data-kcarta="${x.id}">PDF</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Ninguna carta enviada a este inquilino.</td></tr>'}
    </tbody></table></div></section>`;
}
