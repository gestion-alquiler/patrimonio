// Documentos imprimibles de Admon. Fincas (convocatorias, anuncio para el tablón…), en català y castellano.
// Se abren en una ventana nueva preparada para imprimir o «Guardar como PDF».
import { eur } from '../ui.js';
import { abrirImpresion } from '../imprimir.js';
import { rellenar, textoConv, htmlATexto } from '../plantillas.js';
import { vecinosDe, deudaVecino } from './calc.js';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MES = { es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  ca: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'] };
const DIA = { es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], ca: ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'] };
const deMes = (m) => (/^[aeiouà]/i.test(m) ? "d'" : 'de ') + m;
export function fechaLarga(iso, l, conDia = false) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d);
  const dia = conDia ? DIA[l][dt.getDay()] + ', ' : '';
  return l === 'ca' ? `${dia}${d} ${deMes(MES.ca[m - 1])} de ${y}` : `${dia}${d} de ${MES.es[m - 1]} de ${y}`;
}
const localidadSola = (c) => (c.localidad || '').replace(/^\d{5}\s*/, '') || '';

/* ---------- Orden del día por defecto ---------- */
export function ordenPorDefecto(tipo, y) {
  if (tipo === 'extraordinaria') return [{ es: '', ca: '' }];
  return [
    { es: `Aprobación, si procede, de las cuentas del ejercicio ${y - 1} y de la liquidación de gastos.`, ca: `Aprovació, si escau, dels comptes de l'exercici ${y - 1} i de la liquidació de despeses.` },
    { es: `Aprobación, si procede, del presupuesto para el ejercicio ${y} y de las cuotas.`, ca: `Aprovació, si escau, del pressupost per a l'exercici ${y} i de les quotes.` },
    { es: 'Nombramiento o renovación de cargos.', ca: 'Nomenament o renovació de càrrecs.' },
    { es: 'Estado de deudas de los propietarios y, si procede, acuerdo para su reclamación judicial.', ca: "Estat de deutes dels propietaris i, si escau, acord per a la seva reclamació judicial." },
    { es: 'Ruegos y preguntas.', ca: 'Precs i preguntes.' },
  ];
}

/* ---------- Textos fijos (los editables están en plantillas.js) ---------- */
const T = {
  es: { comunidad: 'Comunidad de Propietarios', orden: 'Orden del día', firmaProp: 'Firma del propietario/a', tipo: (t) => (t === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria'),
    titulo: (t) => `Convocatoria de junta general ${t === 'extraordinaria' ? 'extraordinaria' : 'ordinaria'}`, anuncio: (t) => `Anuncio de convocatoria de junta general ${t === 'extraordinaria' ? 'extraordinaria' : 'ordinaria'}`,
    segunda: (h) => ` en primera convocatoria y, de no existir quórum suficiente, a las <b>${e(h)} horas</b> en segunda convocatoria` },
  ca: { comunidad: 'Comunitat de Propietaris', orden: 'Ordre del dia', firmaProp: 'Signatura del propietari/ària', tipo: (t) => (t === 'extraordinaria' ? 'Extraordinària' : 'Ordinària'),
    titulo: (t) => `Convocatòria de junta general ${t === 'extraordinaria' ? 'extraordinària' : 'ordinària'}`, anuncio: (t) => `Anunci de convocatòria de junta general ${t === 'extraordinaria' ? 'extraordinària' : 'ordinària'}`,
    segunda: (h) => ` en primera convocatòria i, si no hi ha quòrum suficient, a les <b>${e(h)} hores</b> en segona convocatòria` },
};

/* ---------- Piezas ---------- */
export const cabeceraCom = (c, l) => ({ izq: `${T[l].comunidad}<br><b>${e(c.nombre)}</b>`, der: `${e([c.direccion, c.localidad].filter(Boolean).join(' · '))}${c.cif ? '<br>CIF ' + e(c.cif) : ''}` });
export const destinatarioVecino = (v, c) => { const dir = v.direccionNotif || [c.direccion, v.piso].filter(Boolean).join(', ');
  return `${e(v.propietario)}<br>${String(dir).split(/\s+·\s+|\n/).map(e).join('<br>')}${v.direccionNotif ? '' : '<br>' + e(c.localidad || '')}`; };
const puntos = (j, l) => `<ol class="odd">${(j.puntos || []).map(p => `<li>${e(p[l] || p[l === 'ca' ? 'es' : 'ca'] || '')}</li>`).join('')}</ol>`;
const lph = (c) => /horizontal/i.test(c.normativa || '');
export const lugarFechaCom = (c, iso, l) => `${localidadSola(c)}${localidadSola(c) ? ', ' : ''}${fechaLarga(iso || new Date().toISOString().slice(0, 10), l)}`;

function deudoresDe(c, d) {
  return vecinosDe(d, c.id).map(v => ({ v, deuda: deudaVecino(c, v, d).total })).filter(x => x.deuda > 0.1).map(x => ({ id: x.v.id, piso: x.v.piso, propietario: x.v.propietario, deuda: x.deuda }));
}

function varsConv(j, c, v, d, l) {
  const deudores = deudoresDe(c, d), suya = v ? deudores.find(x => x.id === v.id) : null;
  return { deudores, suya, vars: {
    comunidad: c.nombre, presidente: c.presidente || '', tipo_junta: T[l].tipo(j.tipo), fecha_junta: fechaLarga(j.fecha, l, true), hora: j.hora || '', lugar: j.lugar || '',
    segunda_convocatoria_html: j.hora2 ? T[l].segunda(j.hora2) : '', propietario: v?.propietario || '________________________________', piso: v?.piso || '________',
    importe_pendiente: suya ? eur(suya.deuda) : '', lista_deudores: deudores.map(x => `${x.piso} (${x.propietario})`).join('; '), anio_junta: (j.fecha || '').slice(0, 4), administrador: d.aj?.admin?.nombre || '' } };
}
// Las marcas {segunda_convocatoria} llevan formato: se insertan como HTML
const tx = (aj, k, l, vars) => rellenar(textoConv(aj, k, l).replace(/\{segunda_convocatoria\}/g, '{segunda_convocatoria_html}'), vars);

export function paginaConvocatoria(j, c, v, d, ad) {
  const l = v ? (v.idioma === 'es' ? 'es' : 'ca') : (j.idiomaTablon || c.idioma || 'ca');
  const t = T[l], aj = d.aj;
  const { deudores, suya, vars } = varsConv(j, c, v, d, l);
  const cab = cabeceraCom(c, l);
  return `<section class="hoja">
    <header class="cab"><div class="com">${cab.izq}</div><div class="dat">${cab.der}</div></header>
    ${v ? `<div class="dest">${destinatarioVecino(v, c)}</div>` : ''}
    <p class="lugar">${e(lugarFechaCom(c, j.fechaEmision, l))}</p>
    <h1>${v ? t.titulo(j.tipo) : t.anuncio(j.tipo)}</h1>
    ${v ? `<p>${tx(aj, 'saludo', l, vars)}</p>` : ''}
    <p>${tx(aj, v ? 'cuerpo' : 'cuerpo_tablon', l, vars)}</p>
    <h2>${t.orden}</h2>
    ${puntos(j, l)}
    ${suya ? `<p class="aviso">${tx(aj, 'su_deuda', l, vars)}</p>` : ''}
    <p class="peq">${tx(aj, lph(c) ? 'ausentes_lph' : 'ausentes_cat', l, vars)}</p>
    <p class="peq">${tx(aj, 'docs', l, vars)}</p>
    <p class="peq">${tx(aj, deudores.length ? 'deudores' : 'sin_deudores', l, vars)}</p>
    ${v ? `<p class="peq">${tx(aj, 'representacion', l, vars)}</p>` : ''}
    ${j.nota && j.nota[l] ? `<p class="peq">${e(j.nota[l])}</p>` : ''}
    <div class="firmas"><div>${tx(aj, 'firma_sec', l, vars)}<div class="esp"></div>${e(ad.nombre || '')}${ad.colegiado ? '<br><span class="peq">Col. ' + e(ad.colegiado) + '</span>' : ''}</div><div>${tx(aj, 'firma_pres', l, vars)}<div class="esp"></div>${e(c.presidente || '')}</div></div>
    ${v ? `<div class="deleg"><div class="tijera">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div><h3>${tx(aj, 'deleg_titulo', l, vars)}</h3><p>${tx(aj, 'delegacion', l, vars)}</p>
      <div class="firmas"><div class="peq">${e(localidadSola(c))}, ____ de ______________ de ${j.fecha ? j.fecha.slice(0, 4) : ''}</div><div>${t.firmaProp}<div class="esp"></div></div></div></div>` : ''}
  </section>`;
}

// Texto plano para enviar por email (sin adjuntos)
export function textoEmail(j, c, v, d, ad) {
  const l = v.idioma === 'es' ? 'es' : 'ca', t = T[l], aj = d.aj;
  const { deudores, suya, vars } = varsConv(j, c, v, d, l);
  const pl = (k) => htmlATexto(tx(aj, k, l, vars));
  const asunto = `${t.titulo(j.tipo)} · ${c.nombre} · ${fechaLarga(j.fecha, l)}`;
  const cuerpo = [pl('saludo'), '', pl('cuerpo') + ':', '', t.orden.toUpperCase(), ...(j.puntos || []).map((p, i) => `${i + 1}. ${p[l] || p[l === 'ca' ? 'es' : 'ca'] || ''}`), '',
    ...(suya ? [pl('su_deuda'), ''] : []), pl(lph(c) ? 'ausentes_lph' : 'ausentes_cat'), '', pl('docs'), '', pl(deudores.length ? 'deudores' : 'sin_deudores'), '', pl('representacion'), '',
    pl('firma_sec'), ad.nombre || '', ad.telefono || '', ad.email || ''].join('\n');
  return { asunto, cuerpo };
}

export { deudoresDe, abrirImpresion, localidadSola };
