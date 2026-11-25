// Actas de las juntas: asistencia y quórum, acuerdos y votaciones, PDF y notificación a los ausentes.
import { db } from '../db.js';
import { esc, fecha, hoyISO, toast, confirmar } from '../ui.js';
import { vecinosDe, coefTxt } from './calc.js';
import { fechaLarga, cabeceraCom, deudoresDe, lugarFechaCom } from './docs.js';
import { abrirImpresion } from '../imprimir.js';
import { rellenar, textoActa, htmlATexto } from '../plantillas.js';
import { editorHtml, enlazarEditores, leerEditor } from '../editor.js';

const TIPO = { es: (t) => (t === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria'), ca: (t) => (t === 'extraordinaria' ? 'Extraordinària' : 'Ordinària') };
const pct = (n) => n.toFixed(2).replace('.', ',') + ' %';
const RES = {
  es: { unanimidad: 'Sometido a votación, se aprueba por unanimidad de los asistentes con derecho a voto.', mayoria: 'Sometido a votación, se aprueba por mayoría', rechazado: 'Sometido a votación, no se aprueba', informativo: '' },
  ca: { unanimidad: "Sotmès a votació, s'aprova per unanimitat dels assistents amb dret de vot.", mayoria: "Sotmès a votació, s'aprova per majoria", rechazado: "Sotmès a votació, no s'aprova", informativo: '' },
};
const VOT = { es: ['a favor', 'en contra', 'abstenciones', 'propietarios'], ca: ['a favor', 'en contra', 'abstencions', 'propietaris'] };

function actaVacia(j, c, vs, d) {
  return { idioma: c.idioma === 'es' ? 'es' : 'ca', horaInicio: j.hora || '', horaFin: '', preside: c.presidente || '', secretario: d.aj?.admin?.nombre || 'El administrador',
    asistencia: Object.fromEntries(vs.map(v => [v.id, { estado: 'ausente', representante: '' }])), acuerdos: (j.puntos || []).map(() => ({ texto: '', resultado: 'unanimidad', votos: null })), ruegos: '' };
}

// Totales de asistencia y de una votación (en número de propietarios y % de coeficientes)
export function quorum(acta, vs, sinVoto) {
  const as = vs.filter(v => ['presente', 'representado'].includes(acta.asistencia?.[v.id]?.estado));
  return { n: as.length, coef: as.reduce((a, v) => a + (Number(v.coef) || 0), 0), total: vs.length, votantes: as.filter(v => !sinVoto.has(v.id)) };
}
export function recuento(votos, votantes) {
  const r = { f: [0, 0], c: [0, 0], a: [0, 0] };
  votantes.forEach(v => { const k = votos?.[v.id] || 'f'; r[k][0]++; r[k][1] += Number(v.coef) || 0; });
  return r;
}
function textoResultado(ac, l, votantes) {
  if (ac.resultado === 'informativo') return '';
  let t = RES[l][ac.resultado];
  if (ac.resultado !== 'unanimidad') {
    if (ac.votos) { const r = recuento(ac.votos, votantes), w = VOT[l];
      t += `: ${w[0]} ${r.f[0]} ${w[3]} (${pct(r.f[1])}), ${w[1]} ${r.c[0]} (${pct(r.c[1])}), ${w[2]} ${r.a[0]} (${pct(r.a[1])}).`; }
    else t += '.';
  }
  return t;
}

function varsActa(j, c, acta, q, l, sinVotoLista) {
  return { comunidad: c.nombre, tipo_junta: TIPO[l](j.tipo), fecha_junta: fechaLarga(j.fecha, l, true), lugar: j.lugar || '', hora_inicio: acta.horaInicio || '', hora_fin: acta.horaFin || '____',
    preside: acta.preside || '', secretario: acta.secretario || '', num_asistentes: String(q.n), total_propietarios: String(q.total), coef_asistentes: pct(q.coef), lista_sin_voto: sinVotoLista };
}

export function paginaActa(j, c, d) {
  const acta = j.acta, l = acta.idioma || 'ca', aj = d.aj;
  const vs = vecinosDe(d, c.id);
  const sinVoto = new Set(acta.sinVoto || []);
  const q = quorum(acta, vs, sinVoto);
  const presentesSinVoto = vs.filter(v => sinVoto.has(v.id) && ['presente', 'representado'].includes(acta.asistencia?.[v.id]?.estado));
  const vars = varsActa(j, c, acta, q, l, presentesSinVoto.map(v => `${v.piso} (${v.propietario})`).join('; '));
  const cab = cabeceraCom(c, l);
  const T = l === 'ca' ? { tit: `Acta de la junta general ${j.tipo === 'extraordinaria' ? 'extraordinària' : 'ordinària'}`, asis: 'Assistents', piso: 'Pis', prop: 'Propietari', coef: 'Coef.', como: 'Assistència', pres: 'Present', repr: 'Representat per', punto: 'Punt', ruegos: 'Precs i preguntes', fP: 'El President', fS: 'El Secretari' }
    : { tit: `Acta de la junta general ${j.tipo === 'extraordinaria' ? 'extraordinaria' : 'ordinaria'}`, asis: 'Asistentes', piso: 'Piso', prop: 'Propietario', coef: 'Coef.', como: 'Asistencia', pres: 'Presente', repr: 'Representado por', punto: 'Punto', ruegos: 'Ruegos y preguntas', fP: 'El Presidente', fS: 'El Secretario' };
  const asist = vs.filter(v => ['presente', 'representado'].includes(acta.asistencia?.[v.id]?.estado));
  return `<section class="hoja acta">
    <header class="cab"><div class="com">${cab.izq}</div><div class="dat">${cab.der}</div></header>
    <h1 style="margin-top:6mm">${T.tit}</h1><p class="peq" style="margin-top:-2mm">${esc(fechaLarga(j.fecha, l, true))}</p>
    <p>${rellenar(textoActa(aj, 'intro', l), vars)}</p>
    <h2>${T.asis}</h2>
    <table class="tabla"><thead><tr><th>${T.piso}</th><th>${T.prop}</th><th class="r">${T.coef}</th><th>${T.como}</th></tr></thead><tbody>
    ${asist.map(v => { const a = acta.asistencia[v.id]; return `<tr><td>${esc(v.piso)}</td><td>${esc(v.propietario)}</td><td class="r">${coefTxt(v.coef)}</td><td>${a.estado === 'representado' ? T.repr + ' ' + esc(a.representante || '—') : T.pres}</td></tr>`; }).join('')}
    <tr class="tot"><td colspan="2">${q.n} / ${q.total}</td><td class="r">${coefTxt(q.coef)}</td><td></td></tr></tbody></table>
    ${presentesSinVoto.length ? `<p class="peq">${rellenar(textoActa(aj, 'sin_voto', l), vars)}</p>` : ''}
    <p>${rellenar(textoActa(aj, 'desarrollo', l), vars)}</p>
    ${(j.puntos || []).map((p, i) => { const ac = acta.acuerdos?.[i] || {}; const res = textoResultado(ac, l, q.votantes);
      return `<div class="punto"><h3>${T.punto} ${i + 1}. ${esc(p[l] || p[l === 'ca' ? 'es' : 'ca'] || '')}</h3>${ac.texto || ''}${res ? `<p><b>${esc(res)}</b></p>` : ''}</div>`; }).join('')}
    ${acta.ruegos && acta.ruegos.replace(/<[^>]+>/g, '').trim() ? `<div class="punto"><h3>${T.ruegos}</h3>${acta.ruegos}</div>` : ''}
    <p>${rellenar(textoActa(aj, 'cierre', l), vars)}</p>
    <div class="firmas"><div>${T.fP}<div class="esp"></div>${esc(acta.preside || '')}</div><div>${T.fS}<div class="esp"></div>${esc(acta.secretario || '')}</div></div>
  </section>`;
}

/* ---------- Pantalla de redacción ---------- */
export function renderActa(c, jid, d) {
  const j = d.juntas.find(x => x.id === jid && x.comunidadId === c.id);
  if (!j) return `<div class="page"><a class="back" href="#/finca/${c.id}/juntas">← Juntas</a><div class="card empty"><h2>No se encuentra la junta</h2></div></div>`;
  const vs = vecinosDe(d, c.id);
  const acta = j.acta || actaVacia(j, c, vs, d);
  const sinVoto = new Set(j.acta?.sinVoto || deudoresDe(c, d).map(x => x.id));
  const l = acta.idioma;
  const sel = (name, val, opts, attrs = '') => `<select name="${name}" class="inp" ${attrs}>${opts.map(([k, t]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<div class="page" style="padding-bottom:90px">
  <a class="back" href="#/finca/${c.id}/juntas">← Juntas de ${esc(c.nombre)}</a>
  <div class="head"><div><h1>Acta · junta ${j.tipo} del ${fecha(j.fecha)}</h1><div class="sub">${esc(j.lugar || '')} · ${esc(j.hora || '')} h${j.acta?.firmada ? ' · <span class="badge ok">Firmada</span>' : ''}</div></div></div>
  <form id="facta" class="stack" style="gap:20px" autocomplete="off">
  <section class="card pad"><div class="fgrid">
    <label class="field">Idioma del acta${sel('idioma', l, [['ca', 'Català'], ['es', 'Castellano']])}</label>
    <label class="field">Hora de inicio<input type="time" name="horaInicio" value="${esc(acta.horaInicio)}"></label><label class="field">Hora de fin<input type="time" name="horaFin" value="${esc(acta.horaFin)}"></label>
    <label class="field">Preside<input name="preside" value="${esc(acta.preside)}"></label><label class="field">Secretario/a<input name="secretario" value="${esc(acta.secretario)}"></label></div></section>
  <section class="card"><div class="cardhead"><div><h2>Asistencia</h2><div class="small muted" id="quorum"></div></div><div class="actions"><button type="button" class="btn sm" data-ac="todosPresentes">Todos presentes</button><button type="button" class="btn sm" data-ac="todosAusentes">Todos ausentes</button></div></div>
    <div class="tw"><table style="min-width:720px"><thead><tr><th>Piso</th><th>Propietario</th><th class="r">Coef.</th><th>Asistencia</th><th>Representante</th><th>Voto</th></tr></thead><tbody>
    ${vs.map(v => { const a = acta.asistencia?.[v.id] || { estado: 'ausente' }; return `<tr data-v="${v.id}" data-coef="${Number(v.coef) || 0}"><td class="b nw">${esc(v.piso)}</td><td>${esc(v.propietario)}</td><td class="r num">${coefTxt(v.coef)}</td>
      <td>${sel('as_' + v.id, a.estado, [['presente', 'Presente'], ['representado', 'Representado'], ['ausente', 'Ausente']], 'data-asis')}</td><td><input class="inp" name="rep_${v.id}" value="${esc(a.representante || '')}" placeholder="Nombre" ${a.estado === 'representado' ? '' : 'style="display:none"'}></td>
      <td><label class="check small"><input type="checkbox" name="sv_${v.id}" ${sinVoto.has(v.id) ? 'checked' : ''}> Sin voto</label></td></tr>`; }).join('')}
    </tbody></table></div><div class="cardfoot">«Sin voto» viene marcado para quien tenía importes pendientes al convocar. Desmárcalo si pagó antes de la junta.</div></section>
  ${(j.puntos || []).map((p, i) => { const ac = acta.acuerdos?.[i] || { resultado: 'unanimidad' }; const det = !!ac.votos;
    return `<section class="card pad stack" data-punto="${i}"><h2>Punto ${i + 1}. ${esc(p[l] || p.es || p.ca)}</h2>
      ${editorHtml('ac_' + i, ac.texto || '', { alto: 110 })}
      <div class="fgrid"><label class="field">Resultado${sel('res_' + i, ac.resultado, [['unanimidad', 'Aprobado por unanimidad'], ['mayoria', 'Aprobado por mayoría'], ['rechazado', 'No aprobado'], ['informativo', 'Sin votación (informativo)']])}</label>
      <label class="check" style="align-self:end"><input type="checkbox" name="det_${i}" ${det ? 'checked' : ''}> Anotar el voto de cada propietario</label></div>
      <div class="votos" ${det ? '' : 'style="display:none"'}><div class="tw"><table><thead><tr><th>Piso</th><th>Propietario</th><th class="r">Coef.</th><th>Voto</th></tr></thead><tbody>
      ${vs.map(v => `<tr data-vv="${v.id}"><td class="b">${esc(v.piso)}</td><td>${esc(v.propietario)}</td><td class="r num">${coefTxt(v.coef)}</td><td>${sel(`vo_${i}_${v.id}`, ac.votos?.[v.id] || 'f', [['f', 'A favor'], ['c', 'En contra'], ['a', 'Abstención']])}</td></tr>`).join('')}
      </tbody></table></div><div class="small b" data-tot="${i}" style="margin-top:8px"></div></div></section>`; }).join('')}
  <section class="card pad stack"><h2>Ruegos y preguntas / otras intervenciones</h2>${editorHtml('ruegos', acta.ruegos || '', { alto: 90 })}</section>
  </form>
  <div class="barra-guardar"><span id="estadoForm" class="small muted">${j.acta ? 'Sin cambios' : 'Acta nueva'}</span>
    <button class="btn" data-ac="pdf">Vista previa / PDF</button><button class="btn" data-ac="notificar">Notificar a los ausentes</button><a class="btn" href="#/finca/${c.id}/juntas">Cancelar</a><button class="btn primary" data-ac="guardar">Guardar acta</button></div>
  </div>`;
}

export function bindActa(el, c, jid, d) {
  const j = d.juntas.find(x => x.id === jid); if (!j) return;
  const vs = vecinosDe(d, c.id);
  const form = el.querySelector('#facta');
  enlazarEditores(form);
  let sucio = false;
  const est = el.querySelector('#estadoForm');
  const marcar = () => { if (!sucio) { sucio = true; est.textContent = 'Hay cambios sin guardar'; est.classList.remove('muted'); est.style.color = 'var(--bad)'; est.style.fontWeight = '600'; } };
  window.__guard = async () => !sucio || await confirmar('Cambios sin guardar', 'El acta tiene cambios sin guardar. Si sales, se perderán.', 'Salir sin guardar');
  window.onbeforeunload = () => (sucio ? true : undefined);
  const leer = () => {
    const f = new FormData(form), g = (k) => f.get(k) || '';
    const asistencia = {}, sinVoto = [];
    vs.forEach(v => { asistencia[v.id] = { estado: g('as_' + v.id) || 'ausente', representante: g('rep_' + v.id) }; if (f.get('sv_' + v.id)) sinVoto.push(v.id); });
    const acuerdos = (j.puntos || []).map((p, i) => ({ texto: leerEditor(form, 'ac_' + i), resultado: g('res_' + i), votos: f.get('det_' + i) ? Object.fromEntries(vs.map(v => [v.id, g(`vo_${i}_${v.id}`) || 'f'])) : null }));
    return { ...(j.acta || {}), idioma: g('idioma'), horaInicio: g('horaInicio'), horaFin: g('horaFin'), preside: g('preside'), secretario: g('secretario'), asistencia, sinVoto, acuerdos, ruegos: leerEditor(form, 'ruegos') };
  };
  const pinta = () => {
    const a = leer(); const q = quorum(a, vs, new Set(a.sinVoto));
    el.querySelector('#quorum').textContent = `Asisten ${q.n} de ${q.total} propietarios (presentes o representados), con el ${pct(q.coef)} de los coeficientes. Votan ${q.votantes.length}.`;
    form.querySelectorAll('[data-punto]').forEach(sec => { const i = Number(sec.dataset.punto); const ac = a.acuerdos[i];
      sec.querySelector('.votos').style.display = ac.votos ? '' : 'none';
      sec.querySelectorAll('[data-vv]').forEach(tr => { tr.style.display = q.votantes.some(v => v.id === tr.dataset.vv) ? '' : 'none'; });
      if (ac.votos) { const r = recuento(ac.votos, q.votantes); sec.querySelector(`[data-tot="${i}"]`).textContent = `A favor: ${r.f[0]} (${pct(r.f[1])}) · En contra: ${r.c[0]} (${pct(r.c[1])}) · Abstenciones: ${r.a[0]} (${pct(r.a[1])})`; } });
    vs.forEach(v => { const rep = form.querySelector(`[name="rep_${v.id}"]`); rep.style.display = form.querySelector(`[name="as_${v.id}"]`).value === 'representado' ? '' : 'none'; });
  };
  pinta();
  form.addEventListener('input', () => { marcar(); pinta(); }); form.addEventListener('change', () => { marcar(); pinta(); });
  const todos = (estado) => { form.querySelectorAll('[data-asis]').forEach(s => { s.value = estado; }); marcar(); pinta(); };
  el.querySelector('[data-ac=todosPresentes]').onclick = () => todos('presente');
  el.querySelector('[data-ac=todosAusentes]').onclick = () => todos('ausente');
  const guardar = async () => { const acta = leer(); await db.put('f_juntas', { ...j, acta }); j.acta = acta; sucio = false; est.textContent = 'Guardada'; est.style.color = ''; est.style.fontWeight = ''; est.classList.add('muted'); return acta; };
  el.querySelector('[data-ac=guardar]').onclick = async () => { await guardar(); toast('Acta guardada'); };
  el.querySelector('[data-ac=pdf]').onclick = () => { const acta = leer(); if (!abrirImpresion(`Acta ${c.nombre} ${fecha(j.fecha)}`, [paginaActa({ ...j, acta }, c, d)])) toast('Permite las ventanas emergentes para esta página'); };
  el.querySelector('[data-ac=notificar]').onclick = async () => {
    const acta = await guardar();
    const aus = vs.filter(v => acta.asistencia[v.id]?.estado === 'ausente');
    if (!aus.length) { toast('No hay propietarios ausentes'); return; }
    const lph = /horizontal/i.test(c.normativa || '');
    const carta = { comunidadId: c.id, fecha: hoyISO(), idiomaModo: 'cada', destinatarios: aus.map(v => v.id), envios: {}, juntaId: j.id, asunto: {}, cuerpo: {} };
    const q = quorum(acta, vs, new Set(acta.sinVoto));
    for (const l of ['es', 'ca']) {
      const acuerdos = `<ol>${(j.puntos || []).map((p, i) => { const ac = acta.acuerdos[i] || {}; const r = textoResultado(ac, l, q.votantes); return `<li><b>${esc(p[l] || p.es || p.ca)}</b>${ac.texto ? ' ' + esc(htmlATexto(ac.texto).replace(/\n+/g, ' ')) : ''}${r ? ' ' + esc(r) : ''}</li>`; }).join('')}</ol>`;
      const op = lph ? (l === 'ca' ? "Disposeu de 30 dies naturals per manifestar la vostra discrepància; si no ho feu, el vostre vot es computarà com a favorable." : 'Dispone de 30 días naturales para manifestar su discrepancia; si no lo hace, su voto se computará como favorable.')
        : (l === 'ca' ? "Disposeu d'un mes des d'aquesta notificació per manifestar-hi la vostra oposició; si no ho feu, el vostre vot es computarà com a favorable." : 'Dispone de un mes desde esta notificación para manifestar su oposición; si no lo hace, su voto se computará como favorable.');
      const vars = { ...varsActa(j, c, acta, q, l, ''), acuerdos_html: acuerdos, texto_oposicion: op };
      carta.asunto[l] = htmlATexto(rellenar(textoActa(d.aj, 'notif_asunto', l), vars));
      carta.cuerpo[l] = rellenar(textoActa(d.aj, 'notif_cuerpo', l), vars);
    }
    const n = await db.put('f_cartas', carta);
    toast(`Notificación preparada para ${aus.length} ${aus.length === 1 ? 'ausente' : 'ausentes'}`); location.hash = `#/finca/${c.id}/carta/${n.id}`;
  };
}
