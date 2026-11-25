// Cartas de Admon. Fincas: configuración para el módulo común de cartas.
import { db, setAjustesFincas, getAjustesFincas } from '../db.js';
import { esc, eur, fecha, MES3 } from '../ui.js';
import { vecinosDe, deudaVecino } from './calc.js';
import { cabeceraCom, destinatarioVecino, lugarFechaCom, fechaLarga } from './docs.js';
import { paginaCarta } from '../imprimir.js';
import { rellenar, MARCAS, modelosCarta, htmlATexto } from '../plantillas.js';
import { listaCartasHtml, enlazarListaCartas, redactarHtml, enlazarRedactar, textoCarta } from '../cartas.js';

export const detalleDeuda = (x, l = 'es') => x.det.map(z => z.tipo === 'cuota' ? MES3[z.m - 1].toLowerCase() + ' ' + z.y : z.tipo === 'saldo' ? (l === 'ca' ? 'saldo anterior' : 'saldo anterior') : `derrama (${l === 'ca' ? 'termini' : 'plazo'} ${z.plazo})`).join(', ');

const destinatarios = (c, d) => vecinosDe(d, c.id).map(v => ({ id: v.id, nombre: `${v.piso} · ${v.propietario}`, detalle: v.ocupante ? 'Ocupante: ' + v.ocupante : (v.formaPago || ''), idioma: v.idioma === 'es' ? 'es' : 'ca', email: v.email, v }));

function vars(c, v, d, l) {
  const dd = deudaVecino(c, v, d), ad = d.aj?.admin || {};
  return { propietario: v.propietario, piso: v.piso, ocupante: v.ocupante || '', comunidad: c.nombre, direccion_comunidad: [c.direccion, c.localidad].filter(Boolean).join(', '),
    importe_pendiente: eur(dd.total), detalle_pendiente: detalleDeuda(dd, l) || '—', iban_comunidad: c.iban || '________________', presidente: c.presidente || '',
    administrador: ad.nombre || '', telefono_administrador: ad.telefono || '', fecha_hoy: fechaLarga(new Date().toISOString().slice(0, 10), l) };
}

function firma(d, l) { const ad = d.aj?.admin || {}; return `${l === 'ca' ? "L'Administrador" : 'El Administrador'}<div class="esp"></div>${esc(ad.nombre || '')}${ad.colegiado ? '<br><span class="peq">Col. ' + esc(ad.colegiado) + '</span>' : ''}`; }

export function paginaCartaVecino(carta, vid, c, d) {
  const v = d.vecinos.find(x => x.id === vid); if (!v) return '';
  const { l, asunto, cuerpo } = textoCarta(carta, { idioma: v.idioma });
  const vv = vars(c, v, d, l), cab = cabeceraCom(c, l);
  return paginaCarta({ cabIzq: cab.izq, cabDer: cab.der, destinatario: destinatarioVecino(v, c), lugarFecha: lugarFechaCom(c, carta.fecha, l), asunto: htmlATexto(rellenar(asunto, vv)), cuerpo: rellenar(cuerpo, vv), firma: firma(d, l) });
}

function emailDe(carta, vid, c, d) {
  const v = d.vecinos.find(x => x.id === vid); const { l, asunto, cuerpo } = textoCarta(carta, { idioma: v.idioma }); const vv = vars(c, v, d, l); const ad = d.aj?.admin || {};
  return { to: v.email || '', asunto: htmlATexto(rellenar(asunto, vv)), cuerpo: htmlATexto(rellenar(cuerpo, vv)) + `\n\n${ad.nombre || ''}\n${ad.telefono || ''}\n${ad.email || ''}`.trimEnd() };
}

const st = { sel: null };

export function tabCartas(c, d) {
  const ds = new Map(destinatarios(c, d).map(x => [x.id, x]));
  return listaCartasHtml({ cartas: d.cartas.filter(x => x.comunidadId === c.id), destinatarios: ds, sel: st.sel, nueva: `#/finca/${c.id}/carta/nueva`, editar: (id) => `#/finca/${c.id}/carta/${id}`,
    vacio: 'Aún no hay cartas. Con «+ Nueva carta» puedes escribir a un vecino, a varios o a todos (comunicados).' });
}
export function bindTabCartas(el, c, d, refresh) {
  const ds = new Map(destinatarios(c, d).map(x => [x.id, x]));
  enlazarListaCartas(el, { cartas: d.cartas.filter(x => x.comunidadId === c.id), destinatarios: ds, sel: st.sel, store: 'f_cartas', editar: (id) => `#/finca/${c.id}/carta/${id}`,
    paginaDe: (carta, id) => paginaCartaVecino(carta, id, c, d), emailDe: (carta, id) => emailDe(carta, id, c, d), alCambiar: (id) => { st.sel = id; refresh(); }, refresh });
}

function cfgRedactar(c, sub, pre, d) {
  const carta = sub === 'nueva' ? null : d.cartas.find(x => x.id === sub);
  const des = destinatarios(c, d);
  const conDeuda = des.filter(x => deudaVecino(c, x.v, d).total > 0.1).map(x => x.id);
  return { titulo: carta ? 'Editar carta' : 'Nueva carta', volver: pre ? `#/finca/${c.id}/vecino/${pre}` : `#/finca/${c.id}/cartas`, carta, base: { comunidadId: c.id }, destinatarios: des,
    filtros: [['Con importes pendientes', conDeuda], ['En castellano', des.filter(x => x.idioma === 'es').map(x => x.id)], ['En català', des.filter(x => x.idioma === 'ca').map(x => x.id)]],
    preseleccion: pre ? [pre] : [], modelos: modelosCarta('fin', d.aj), marcas: MARCAS.fin, store: 'f_cartas',
    paginaDe: (cc, id) => paginaCartaVecino(cc, id, c, d),
    guardarModelo: async (m) => { const aj = await getAjustesFincas(); aj.cartasPlantillas = [...(aj.cartasPlantillas || []), m]; await setAjustesFincas(aj); d.aj = aj; },
    alGuardar: (obj) => { st.sel = obj.id; location.hash = pre ? `#/finca/${c.id}/vecino/${pre}` : `#/finca/${c.id}/cartas`; } };
}
export const renderRedactar = (c, sub, pre, d) => redactarHtml(cfgRedactar(c, sub, pre, d));
export const bindRedactar = (el, c, sub, pre, d) => enlazarRedactar(el, cfgRedactar(c, sub, pre, d));

// Cartas enviadas a un vecino (para su ficha)
export function cartasDeVecino(c, v, d) {
  const cs = d.cartas.filter(x => x.comunidadId === c.id && (x.destinatarios || []).includes(v.id)).sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));
  return `<section class="card"><div class="cardhead"><div><h2>Cartas enviadas</h2><div class="small muted">Quedan guardadas para siempre, con su fecha.</div></div><a class="btn sm primary" href="#/finca/${c.id}/carta/nueva/${v.id}">Escribir carta</a></div>
    <div class="tw"><table><thead><tr><th>Fecha</th><th>Asunto</th><th>Enviada</th><th></th></tr></thead><tbody>
    ${cs.map(x => { const env = (x.envios || {})[v.id]; const { l, asunto } = textoCarta(x, { idioma: v.idioma });
      return `<tr><td class="num nw">${fecha(x.fecha)}</td><td class="b">${esc(htmlATexto(rellenar(asunto, vars(c, v, d, l))) || 'Sin asunto')}</td><td class="small">${env ? fecha(env.fecha) + ' · ' + esc(env.via) : '—'}</td><td class="nw"><button type="button" class="btn sm" data-vcarta="${x.id}">PDF</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Ninguna carta enviada a este vecino.</td></tr>'}
    </tbody></table></div></section>`;
}
