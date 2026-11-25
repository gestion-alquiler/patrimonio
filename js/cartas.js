// Cartas y comunicados (común a Patrimonio y Admon. Fincas): redactar, guardar, imprimir y enviar.
import { db } from './db.js';
import { esc, fecha, hoyISO, toast, confirmar, modal, field, fd } from './ui.js';
import { editorHtml, enlazarEditores, leerEditor, ponerEditor } from './editor.js';
import { abrirImpresion } from './imprimir.js';
import { htmlATexto } from './plantillas.js';

const sinMarcas = (t) => String(t || '').replace(/\s*[·-]?\s*\{[a-z_]+\}/g, '').trim();
const idiomaDe = (carta, dest) => (carta.idiomaModo === 'es' || carta.idiomaModo === 'ca' ? carta.idiomaModo : dest.idioma === 'es' ? 'es' : 'ca');
const texto = (obj, l) => (obj?.[l] && obj[l].replace(/<[^>]+>/g, '').trim() ? obj[l] : obj?.[l === 'es' ? 'ca' : 'es'] || '');
export const textoCarta = (carta, dest) => { const l = idiomaDe(carta, dest); return { l, asunto: texto(carta.asunto, l), cuerpo: texto(carta.cuerpo, l) }; };

/* ---------- Lista de cartas y detalle (pestaña «Cartas») ---------- */
// cfg: { cartas, destinatarios: Map id -> {nombre, detalle, idioma, email}, sel, nueva (hash), editar: (id) => hash, vacio }
export function listaCartasHtml(cfg) {
  const cs = cfg.cartas.slice().sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));
  const sel = cs.find(x => x.id === cfg.sel) || cs[0];
  let detalle = '';
  if (sel) {
    const env = sel.envios || {};
    const ds = (sel.destinatarios || []).map(id => [id, cfg.destinatarios.get(id)]).filter(([, x]) => x);
    detalle = `<section class="card"><div class="cardhead"><div><h2>${esc(sinMarcas(texto(sel.asunto, 'es')) || 'Sin asunto')}</h2><div class="small muted">${fecha(sel.fecha)} · ${ds.length} ${ds.length === 1 ? 'destinatario' : 'destinatarios'} · ${ds.filter(([id]) => env[id]).length} enviadas</div></div>
      <div class="actions"><a class="btn sm" href="${cfg.editar(sel.id)}">Editar</a><button class="btn sm" data-c="duplicar">Duplicar</button><button class="btn primary sm" data-c="pdfTodas">PDF de todas</button></div></div>
      <div class="tw"><table><thead><tr><th>Destinatario</th><th>Idioma</th><th>Enviada</th><th></th></tr></thead><tbody>
      ${ds.map(([id, x]) => `<tr><td class="b">${esc(x.nombre)}<div class="small muted" style="font-weight:400">${esc(x.detalle || '')}${x.email ? ' · ' + esc(x.email) : ''}</div></td><td class="small">${idiomaDe(sel, x) === 'es' ? 'Castellano' : 'Català'}</td>
        <td class="small nw">${env[id] ? `<button class="badge ok" style="border:0;cursor:pointer" data-cenv="${id}" title="Pulsa para desmarcar">${fecha(env[id].fecha)} · ${esc(env[id].via)}</button>` : `<button class="linkbtn small" data-cenv="${id}">Marcar</button>`}</td>
        <td class="nw"><button class="btn sm" data-cpdf="${id}">PDF</button>${x.email ? ` <button class="btn sm" data-cmail="${id}">Email</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin destinatarios</td></tr>'}
      </tbody></table></div>
      <div class="cardfoot">«Email» abre tu correo con la carta ya escrita. Para adjuntarla en PDF, guárdala antes con el botón «PDF».</div></section>
      <details class="card pad small"><summary style="cursor:pointer;color:var(--muted)">Opciones avanzadas</summary><div class="actions" style="margin-top:10px"><button class="btn sm danger" data-c="borrar">Borrar esta carta</button></div></details>`;
  }
  return `<div class="head" style="align-items:center"><div><h2>Cartas y comunicados</h2><div class="small muted">Cartas libres o a partir de un modelo. Quedan guardadas con la fecha y a quién se enviaron.</div></div>
    <div class="actions"><a class="btn primary" href="${cfg.nueva}">+ Nueva carta</a></div></div>
    ${cs.length ? `<section class="card"><div class="tw"><table><thead><tr><th>Fecha</th><th>Asunto</th><th>Destinatarios</th><th></th></tr></thead><tbody>
      ${cs.map(x => `<tr ${x.id === sel?.id ? 'style="background:var(--accent-soft)"' : ''}><td class="num nw">${fecha(x.fecha)}</td><td class="b">${esc(sinMarcas(texto(x.asunto, 'es')) || 'Sin asunto')}</td>
        <td class="small">${(x.destinatarios || []).length === 1 ? esc(cfg.destinatarios.get(x.destinatarios[0])?.nombre || '') : (x.destinatarios || []).length + ' destinatarios'}</td><td><button class="btn sm" data-csel="${x.id}">Ver</button></td></tr>`).join('')}
    </tbody></table></div></section>` : `<div class="card empty">${cfg.vacio || 'Aún no hay cartas.'}</div>`}
    ${detalle}`;
}

// cfg: { ...lo de arriba, store, paginaDe(carta, id), emailDe(carta, id), alCambiar(sel), refresh }
export function enlazarListaCartas(el, cfg) {
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  const cs = cfg.cartas.slice().sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));
  const sel = cs.find(x => x.id === cfg.sel) || cs[0];
  on('[data-csel]', (b) => cfg.alCambiar(b.dataset.csel));
  if (!sel) return;
  const abrir = (t, p) => { if (!abrirImpresion(t, p)) toast('El navegador ha bloqueado la ventana: permite las ventanas emergentes para esta página'); };
  const guardarEnv = async (envios) => { await db.put(cfg.store, { ...sel, envios }); cfg.refresh(); };
  on('[data-c=pdfTodas]', () => abrir(sinMarcas(texto(sel.asunto, 'es')) || 'Carta', (sel.destinatarios || []).filter(id => cfg.destinatarios.get(id)).map(id => cfg.paginaDe(sel, id))));
  on('[data-cpdf]', (b) => abrir(sinMarcas(texto(sel.asunto, 'es')) || 'Carta', [cfg.paginaDe(sel, b.dataset.cpdf)]));
  on('[data-cmail]', async (b) => { const m = cfg.emailDe(sel, b.dataset.cmail);
    location.href = `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.asunto)}&body=${encodeURIComponent(m.cuerpo)}`;
    await guardarEnv({ ...(sel.envios || {}), [b.dataset.cmail]: { fecha: hoyISO(), via: 'Email' } }); });
  on('[data-cenv]', async (b) => { const env = { ...(sel.envios || {}) }; if (env[b.dataset.cenv]) delete env[b.dataset.cenv]; else env[b.dataset.cenv] = { fecha: hoyISO(), via: 'Entregada' }; await guardarEnv(env); });
  on('[data-c=duplicar]', async () => { const { id, envios, ...resto } = sel; const n = await db.put(cfg.store, { ...resto, fecha: hoyISO(), envios: {} }); location.hash = cfg.editar(n.id); });
  on('[data-c=borrar]', async () => { if (await confirmar('Borrar carta', '¿Borrar esta carta del historial? No se puede deshacer.')) { await db.del(cfg.store, sel.id); cfg.alCambiar(null); toast('Carta borrada'); } });
}

/* ---------- Redactar una carta ---------- */
// cfg: { titulo, volver, carta, base (campos fijos: propiedadId/comunidadId), destinatarios: [{id, nombre, detalle, idioma, email}], filtros: [[etiqueta, ids]],
//        preseleccion: [ids], modelos, marcas, idiomaDefecto, store, paginaDe(carta, id), guardarModelo(modelo), alGuardar(obj) }
export function redactarHtml(cfg) {
  const c = cfg.carta || { destinatarios: cfg.preseleccion || [], idiomaModo: 'cada', asunto: { es: '', ca: '' }, cuerpo: { es: '', ca: '' } };
  const selIds = new Set(c.destinatarios || []);
  return `<div class="page" style="padding-bottom:90px">
  <a class="back" href="${cfg.volver}">← Volver</a>
  <div class="head"><div><h1>${esc(cfg.titulo)}</h1><div class="sub">Escribe la carta o parte de un modelo. Los datos entre llaves, como {${esc(cfg.marcas[0]?.[0] || 'dato')}}, se rellenan solos para cada destinatario.</div></div></div>
  <div class="row" style="align-items:flex-start">
  <section class="card pad stack grow1" style="max-width:380px"><h2>Destinatarios</h2>
    <div class="chips"><button type="button" class="chip" data-dsel="todos">Todos</button><button type="button" class="chip" data-dsel="ninguno">Ninguno</button>${(cfg.filtros || []).map(([l], i) => `<button type="button" class="chip" data-dsel="f${i}">${esc(l)}</button>`).join('')}</div>
    <div class="stack" style="gap:0;max-height:420px;overflow:auto" id="destList">${cfg.destinatarios.map(x => `<label class="check" style="border-bottom:1px solid var(--line2);padding:6px 0;align-items:flex-start"><input type="checkbox" name="dest" value="${x.id}" ${selIds.has(x.id) ? 'checked' : ''} style="margin-top:3px"><span><b>${esc(x.nombre)}</b><br><span class="small muted">${esc(x.detalle || '')} · ${x.idioma === 'es' ? 'castellano' : 'català'}</span></span></label>`).join('') || '<div class="muted">No hay destinatarios.</div>'}</div>
    <div class="small muted" id="destCuenta"></div></section>
  <section class="card pad stack grow2"><div class="fgrid">
    <label class="field">Partir de un modelo<select id="modelo"><option value="">— Carta en blanco —</option>${cfg.modelos.map(m => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join('')}</select></label>
    <label class="field">Idioma<select id="idiomaModo">${[['cada', 'Cada destinatario en su idioma'], ['es', 'Todos en castellano'], ['ca', 'Todos en català']].map(([k, l]) => `<option value="${k}" ${c.idiomaModo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${field('Fecha de la carta', 'fechaCarta', c.fecha || hoyISO(), { type: 'date' })}</div>
    <div class="tabs" role="tablist" style="margin:4px 0 0"><a href="javascript:void 0" role="tab" data-lt="es" class="on">Castellano</a><a href="javascript:void 0" role="tab" data-lt="ca">Català</a></div>
    ${['es', 'ca'].map(l => `<div class="stack" data-lp="${l}" style="gap:10px;${l === 'ca' ? 'display:none' : ''}">
      <label class="field">Asunto<input name="asunto_${l}" value="${esc(c.asunto?.[l] || '')}" placeholder="${l === 'es' ? 'Asunto de la carta' : 'Assumpte de la carta'}"></label>
      ${editorHtml('cuerpo_' + l, c.cuerpo?.[l] || '', { marcas: cfg.marcas, alto: 300 })}</div>`).join('')}
    <div class="small muted" id="avisoIdioma"></div>
  </section></div>
  <div class="barra-guardar"><span id="estadoForm" class="small muted">${cfg.carta ? 'Sin cambios' : 'Carta nueva'}</span><button class="btn" data-r="previa">Vista previa / PDF</button><button class="btn" data-r="modelo">Guardar como modelo</button><a class="btn" href="${cfg.volver}">Cancelar</a><button class="btn primary" data-r="guardar">Guardar carta</button></div>
  </div>`;
}

export function enlazarRedactar(el, cfg) {
  enlazarEditores(el);
  let sucio = false;
  const est = el.querySelector('#estadoForm');
  const marcar = () => { if (!sucio) { sucio = true; est.textContent = 'Hay cambios sin guardar'; est.classList.remove('muted'); est.style.color = 'var(--bad)'; est.style.fontWeight = '600'; } aviso(); };
  const pg = el.querySelector('.page');
  pg.addEventListener('input', marcar); pg.addEventListener('change', (e) => { if (e.target.id !== 'modelo') marcar(); });
  window.__guard = async () => !sucio || await confirmar('Cambios sin guardar', 'La carta tiene cambios sin guardar. Si sales, se perderán.', 'Salir sin guardar');
  window.onbeforeunload = () => (sucio ? true : undefined);
  const cuenta = () => { const n = el.querySelectorAll('[name=dest]:checked').length; el.querySelector('#destCuenta').textContent = `${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`; };
  cuenta(); el.querySelector('#destList').addEventListener('change', cuenta);
  el.querySelectorAll('[data-dsel]').forEach(b => b.onclick = () => {
    const k = b.dataset.dsel; const ids = k === 'todos' ? cfg.destinatarios.map(x => x.id) : k === 'ninguno' ? [] : cfg.filtros[Number(k.slice(1))][1];
    el.querySelectorAll('[name=dest]').forEach(i => { i.checked = ids.includes(i.value); }); cuenta(); marcar(); });
  el.querySelectorAll('[data-lt]').forEach(t => t.onclick = () => { el.querySelectorAll('[data-lt]').forEach(x => x.classList.toggle('on', x === t)); el.querySelectorAll('[data-lp]').forEach(p => { p.style.display = p.dataset.lp === t.dataset.lt ? '' : 'none'; }); });
  const leer = () => ({ ...(cfg.carta || {}), ...cfg.base, fecha: el.querySelector('[name=fechaCarta]').value || hoyISO(), idiomaModo: el.querySelector('#idiomaModo').value,
    destinatarios: [...el.querySelectorAll('[name=dest]:checked')].map(i => i.value),
    asunto: { es: el.querySelector('[name=asunto_es]').value.trim(), ca: el.querySelector('[name=asunto_ca]').value.trim() },
    cuerpo: { es: leerEditor(el, 'cuerpo_es'), ca: leerEditor(el, 'cuerpo_ca') } });
  const vacio = (h) => !h || !h.replace(/<[^>]+>/g, '').trim();
  const aviso = () => { const c = leer(); const falta = [];
    const necesita = new Set(c.idiomaModo === 'cada' ? c.destinatarios.map(id => cfg.destinatarios.find(x => x.id === id)?.idioma === 'es' ? 'es' : 'ca') : [c.idiomaModo]);
    necesita.forEach(l => { if (vacio(c.cuerpo[l])) falta.push(l === 'es' ? 'castellano' : 'català'); });
    el.querySelector('#avisoIdioma').textContent = falta.length ? `Falta el texto en ${falta.join(' y ')}: esos destinatarios la recibirán en el otro idioma.` : ''; };
  aviso();
  el.querySelector('#modelo').onchange = async (e) => {
    const m = cfg.modelos.find(x => x.id === e.target.value); if (!m) return;
    const c = leer();
    if ((!vacio(c.cuerpo.es) || !vacio(c.cuerpo.ca)) && !(await confirmar('Cargar modelo', 'Se sustituirá el texto que has escrito por el del modelo.', 'Sustituir'))) { e.target.value = ''; return; }
    el.querySelector('[name=asunto_es]').value = m.asunto?.es || ''; el.querySelector('[name=asunto_ca]').value = m.asunto?.ca || '';
    ponerEditor(el, 'cuerpo_es', m.cuerpo?.es || ''); ponerEditor(el, 'cuerpo_ca', m.cuerpo?.ca || ''); e.target.value = ''; marcar();
  };
  el.querySelector('[data-r=previa]').onclick = () => {
    const c = leer(); if (!c.destinatarios.length) { toast('Elige al menos un destinatario'); return; }
    if (!abrirImpresion(sinMarcas(c.asunto.es || c.asunto.ca) || 'Carta', c.destinatarios.map(id => cfg.paginaDe(c, id)))) toast('El navegador ha bloqueado la ventana: permite las ventanas emergentes para esta página');
  };
  el.querySelector('[data-r=modelo]').onclick = () => {
    const c = leer(); if (vacio(c.cuerpo.es) && vacio(c.cuerpo.ca)) { toast('Escribe primero la carta'); return; }
    modal({ title: 'Guardar como modelo', submit: 'Guardar modelo', body: `${field('Nombre del modelo', 'nombre', c.asunto.es || c.asunto.ca || '', { required: true })}<div class="small muted">Lo encontrarás en «Partir de un modelo» y en Ajustes → Plantillas.</div>`,
      onSubmit: async (f) => { const n = fd(f).nombre.trim(); if (!n) return false; await cfg.guardarModelo({ id: 'u-' + Date.now().toString(36), nombre: n, asunto: c.asunto, cuerpo: c.cuerpo }); toast('Modelo guardado'); } });
  };
  el.querySelector('[data-r=guardar]').onclick = async () => {
    const c = leer();
    if (!c.destinatarios.length) { toast('Elige al menos un destinatario'); return; }
    if (vacio(c.cuerpo.es) && vacio(c.cuerpo.ca)) { toast('La carta está vacía'); return; }
    const obj = await db.put(cfg.store, { ...c, envios: c.envios || {} });
    sucio = false; window.onbeforeunload = null; toast('Carta guardada'); cfg.alGuardar(obj);
  };
}

// Email en texto plano a partir de la carta ya rellenada
export function emailCarta(asunto, cuerpoHtml, firma) { return { asunto: htmlATexto(asunto), cuerpo: htmlATexto(cuerpoHtml) + (firma ? '\n\n' + firma : '') }; }
