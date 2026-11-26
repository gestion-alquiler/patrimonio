import { db, borrarComunidad } from '../../db.js';
import { esc, eur, num, modal, confirmar, field, select, textarea, money, fd, toast } from '../../ui.js';
import { vecinosDe, deudaVecino, cuotaEn } from '../calc.js';
import { importarExcel, leerListado, normPiso, clavePiso, CONTACTO, soloDesde } from '../importar.js';
import { elegirArchivos } from '../../files.js';

let verArchivadas = false;
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const coefTxt = (n) => String(Math.round(n * 10000) / 10000).replace('.', ',');

export async function render(_, d) {
  const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth() + 1;
  const items = d.coms.filter(c => !!c.archivada === verArchivadas).map(c => {
    const vs = vecinosDe(d, c.id);
    const deudas = vs.map(v => deudaVecino(c, v, d).total);
    const pend = deudas.reduce((a, x) => a + x, 0), morosos = deudas.filter(x => x > 0.1).length;
    return { c, vs, pend, morosos, cuotaMes: vs.reduce((a, v) => a + cuotaEn(v, y, m), 0), gastosAnio: d.gastos.filter(g => g.comunidadId === c.id && g.estado !== 'pendiente' && (g.fecha || '').startsWith(String(y))).reduce((a, g) => a + Number(g.importe || 0), 0) };
  });
  const nArch = d.coms.filter(c => c.archivada).length;
  const act = d.coms.filter(c => !c.archivada);
  const tot = items.reduce((a, i) => ({ pend: a.pend + i.pend, n: a.n + i.vs.length }), { pend: 0, n: 0 });
  return `<div class="page">
  <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">Admon. Fincas</div><h1>${verArchivadas ? 'Comunidades archivadas' : 'Comunidades de propietarios'}</h1></div>
    <div class="actions"><button class="btn" data-a="importar">Importar desde Excel</button><button class="btn primary" data-a="nueva">+ Nueva comunidad</button></div></div>
  ${!verArchivadas && act.length ? `<section class="kpis" aria-label="Indicadores" style="grid-template-columns:repeat(2,minmax(0,1fr))">
    <div class="card kpi"><div class="l">Comunidades</div><div class="v">${act.length}</div><div class="s">${tot.n} pisos y locales</div></div>
    <div class="card kpi"><div class="l">Pendiente de cobro</div><div class="v ${tot.pend > 0.1 ? 'neg' : ''}">${eur(tot.pend, 0)}</div><div class="s">${items.reduce((a, i) => a + i.morosos, 0)} propietarios con importes pendientes</div></div>
  </section>` : ''}
  ${items.length ? `<div class="grid-props" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${items.map(i => `<article class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;gap:12px;align-items:flex-start"><div style="width:44px;height:44px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex:none"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M16 9h3a1 1 0 0 1 1 1v11"/><path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1M3 21h18"/></svg></div>
      <div style="flex:1;min-width:0"><a href="#/finca/${i.c.id}" style="font:600 18px 'Space Grotesk',sans-serif;color:var(--ink);text-decoration:none">${esc(i.c.nombre)}</a><div class="small muted">${esc([i.c.localidad, i.vs.length + ' pisos y locales', i.c.cif ? 'CIF ' + i.c.cif : ''].filter(Boolean).join(' · '))}</div></div>
      <span class="badge ${i.c.archivada ? 'neutral' : i.morosos ? 'bad' : 'ok'}">${i.c.archivada ? 'Archivada' : i.morosos ? i.morosos + (i.morosos === 1 ? ' con pendiente' : ' con pendiente') : 'Al día'}</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 0;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)">
      <div><div class="small muted">Cuotas/mes</div><b class="num">${eur(i.cuotaMes)}</b></div><div><div class="small muted">Gastos ${y}</div><b class="num">${eur(i.gastosAnio, 0)}</b></div><div><div class="small muted">Pendiente</div><b class="num ${i.pend > 0.1 ? 'neg' : ''}">${eur(i.pend)}</b></div></div>
    <div class="actions" style="justify-content:flex-end">${i.c.archivada ? `<button class="btn sm" data-recuperar="${i.c.id}">Recuperar</button><button class="btn sm danger" data-eliminar="${i.c.id}">Eliminar</button>` : `<a class="btn sm" href="#/finca/${i.c.id}">Abrir</a><button class="btn sm danger" data-baja="${i.c.id}">Dar de baja</button>`}</div>
  </article>`).join('')}</div>`
  : `<div class="card empty"><h2>${verArchivadas ? 'No hay comunidades archivadas' : 'Aún no hay comunidades'}</h2>${verArchivadas ? '' : `<p style="margin:0;max-width:540px">Crea una comunidad y ve añadiendo sus vecinos, o importa directamente tu Excel de contabilidad de cuotas.</p>
    <div class="actions"><button class="btn primary" data-a="nueva">+ Nueva comunidad</button><button class="btn" data-a="importar">Importar desde Excel</button>${/[?&]prueba\b/.test(location.search) ? '<button class="btn" data-a="prueba">Cargar datos de prueba</button>' : ''}</div>`}</div>`}
  ${nArch || verArchivadas ? `<div><button class="linkbtn" data-a="archivadas">${verArchivadas ? '← Ver comunidades activas' : `Ver comunidades archivadas (${nArch})`}</button></div>` : ''}
  </div>`;
}

export function bind(el, _, d, refresh) {
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  on('[data-a=nueva]', () => formComunidad(null, (c) => { location.hash = '#/finca/' + c.id; }));
  on('[data-a=archivadas]', () => { verArchivadas = !verArchivadas; refresh(); });
  on('[data-a=importar]', () => importarDialogo(d, refresh));
  on('[data-a=prueba]', async (b) => { b.disabled = true; b.textContent = 'Cargando…'; const { cargarPrueba } = await import('../../prueba.js'); await cargarPrueba(); toast('Datos de prueba cargados. Se borran desde Ajustes.'); refresh(); });
  on('[data-baja]', (b) => darDeBaja(d.coms.find(c => c.id === b.dataset.baja), refresh));
  on('[data-recuperar]', async (b) => { const c = d.coms.find(x => x.id === b.dataset.recuperar); await db.put('f_comunidades', { ...c, archivada: false }); toast('Comunidad recuperada'); refresh(); });
  on('[data-eliminar]', async (b) => { const c = d.coms.find(x => x.id === b.dataset.eliminar);
    if (await confirmar('Eliminar definitivamente', `Se borrará <b>${esc(c.nombre)}</b> con todos sus vecinos, cuotas, gastos y derramas. No se puede deshacer. Si quieres conservarla, exporta antes una copia desde Ajustes.`, 'Eliminar')) { await borrarComunidad(c.id); toast('Comunidad eliminada'); refresh(); } });
}

export function darDeBaja(c, done) {
  modal({ title: `Dar de baja «${c.nombre}»`, submit: 'Dar de baja', danger: true,
    body: `<p style="margin:0">Dejarás de administrar esta comunidad. ¿Qué hacemos con sus datos?</p>
      <label class="alert" style="cursor:pointer"><input type="radio" name="modo" value="archivar" checked style="margin-top:4px"><span><b>Archivar</b> (recomendado)<br><span class="small muted">Desaparece de la lista, pero conservas cuentas y cobros por si te los piden. Se puede recuperar.</span></span></label>
      <label class="alert" style="cursor:pointer;border-color:#F2C2BE"><input type="radio" name="modo" value="eliminar" style="margin-top:4px"><span><b>Eliminar definitivamente</b><br><span class="small muted">Se borra todo. Haz antes una copia desde Ajustes si la quieres guardar.</span></span></label>`,
    onSubmit: async (f) => { if (fd(f).modo === 'eliminar') { await borrarComunidad(c.id); toast('Comunidad eliminada'); } else { await db.put('f_comunidades', { ...c, archivada: true }); toast('Comunidad archivada'); } location.hash = '#/fincas'; done(); } });
}

export async function formComunidad(c, done) {
  const vecs = c ? (await db.by('f_vecinos', 'comunidadId', c.id)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) : [];
  const v = c || { periodicidad: 'mensual', idioma: 'ca', normativa: 'Codi civil de Catalunya', diaCobro: 10, cobrosDesde: new Date().toISOString().slice(0, 7), secretario: 'El administrador' };
  const car = v.caracteristicas || {};
  const CAR = [['ascensor', 'Ascensor'], ['porteria', 'Portería / conserje'], ['garaje', 'Garaje'], ['trasteros', 'Trasteros'], ['piscina', 'Piscina'], ['jardin', 'Jardín / zonas comunes'], ['calefaccion', 'Calefacción central'], ['antena', 'Antena colectiva'], ['locales', 'Locales comerciales']];
  const box = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))';
  modal({
    title: c ? 'Editar comunidad' : 'Nueva comunidad', wide: true,
    body: `<div class="fgrid">
      ${field('Nombre', 'nombre', v.nombre, { required: true, span2: true, placeholder: 'C/ Sant Llorenç, 19' })}
      ${field('Dirección', 'direccion', v.direccion)}${field('CP y localidad', 'localidad', v.localidad)}
      ${field('CIF / NIF', 'cif', v.cif)}${field('IBAN de la comunidad', 'iban', v.iban)}${field('Banco', 'banco', v.banco)}${field('Secretario/a', 'secretario', v.secretario)}
      ${select('Cuotas', 'periodicidad', v.periodicidad, [['mensual', 'Mensuales'], ['trimestral', 'Trimestrales']])}
      ${field('Las cuotas vencen el día', 'diaCobro', v.diaCobro, { inputmode: 'numeric' })}
      ${field('Controlar cuotas desde', 'cobrosDesde', v.cobrosDesde, { type: 'month', hint: 'Los meses anteriores no cuentan como pendientes' })}
      ${money('Fondo de reserva (€)', 'fondoReserva', v.fondoReserva)}
      ${select('Idioma de los escritos', 'idioma', v.idioma, [['ca', 'Català'], ['es', 'Castellano']])}
      ${select('Normativa', 'normativa', v.normativa, ['Codi civil de Catalunya', 'Ley de Propiedad Horizontal'])}</div>
    <fieldset class="box" style="${box}"><legend>Presidencia</legend>
      ${vecs.length ? `<label class="field" style="grid-column:1/-1">Vecino que es presidente/a<select name="presidenteVecinoId" id="presVec"><option value="">— Otra persona o sin elegir —</option>${vecs.map(x => `<option value="${x.id}" ${v.presidenteVecinoId === x.id ? 'selected' : ''}>${esc(x.piso)} · ${esc(x.propietario || '')}</option>`).join('')}</select><span class="hint">Al elegirlo se copian aquí su nombre, piso, teléfono y email. No cambian solos: si cambia el presidente, elige otro vecino.</span></label>` : ''}
      ${field('Presidente/a', 'presidente', v.presidente)}${field('Piso', 'presidentePiso', v.presidentePiso, { placeholder: '2º 1ª' })}${field('Teléfono', 'presidenteTel', v.presidenteTel, { type: 'tel' })}${field('Email', 'presidenteEmail', v.presidenteEmail, { type: 'email' })}${field('Mandato hasta', 'presidenteHasta', v.presidenteHasta, { type: 'date' })}</fieldset>
    <fieldset class="box" style="${box}"><legend>Características especiales</legend>
      ${CAR.map(([k, l]) => `<label class="check"><input type="checkbox" name="car_${k}" ${car[k] ? 'checked' : ''}> ${l}</label>`).join('')}
      ${field('Plantas', 'car_plantas', car.plantas, { inputmode: 'numeric' })}${field('Año de construcción', 'car_anio', car.anio, { inputmode: 'numeric' })}
      <label class="field" style="grid-column:1/-1">Otras características<textarea name="car_otras" rows="2" placeholder="Placas solares, accesibilidad, contador de agua general…">${esc(car.otras || '')}</textarea></label></fieldset>
    <div class="fgrid">${textarea('Notas', 'notas', v.notas)}</div>`,
    onSubmit: async (f) => {
      const x = fd(f);
      if (!x.nombre.trim()) { toast('Falta el nombre'); return false; }
      const caracteristicas = { plantas: x.car_plantas, anio: x.car_anio, otras: x.car_otras };
      CAR.forEach(([k]) => { caracteristicas[k] = !!x['car_' + k]; });
      Object.keys(x).filter(k => k.startsWith('car_')).forEach(k => delete x[k]);
      if (x.presidenteVecinoId === undefined) delete x.presidenteVecinoId;
      const obj = { ...v, ...x, caracteristicas, nombre: x.nombre.trim(), fondoReserva: num(x.fondoReserva), diaCobro: Number(x.diaCobro) || 10 };
      delete obj.vicepresidente;
      await db.put('f_comunidades', obj); toast(c ? 'Comunidad guardada' : 'Comunidad creada'); done && done(obj);
    },
  });
  const sel = document.getElementById('presVec');
  if (sel) sel.onchange = () => {
    const x = vecs.find(q => q.id === sel.value); if (!x) return;
    const f = sel.form, put = (n, val) => { const e = f.elements[n]; if (e) e.value = val || ''; };
    put('presidente', x.propietario); put('presidentePiso', x.piso); put('presidenteTel', x.telefono); put('presidenteEmail', x.email);
  };
}

export async function importarDialogo(d, refresh) {
  const [f] = await elegirArchivos({ accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', multiple: false });
  if (!f) return;
  toast('Leyendo el Excel…');
  let r;
  try { const l = await leerListado(f); if (l) return dialogoListado(l, f, d, refresh); } catch (e) { console.error(e); toast('No se pudo leer: ' + e.message); return; }
  try { r = await importarExcel(f); } catch (e) { console.error(e); toast('No se pudo leer: ' + e.message); return; }
  const clave = (t) => normPiso(t || '').replace(/\b(COMUNIDAD|COMUNITAT|DE|DEL|PROPIETARIOS|PROPIETARIS|CARRER|CALLE|C|CL|AVINGUDA|AVENIDA|AV)\b/g, ' ').replace(/[^A-Z0-9]/g, '');
  const kr = clave(r.comunidad.nombre);
  const existe = d.coms.find(c => !c.archivada && kr && (clave(c.nombre) === kr || (clave(c.nombre).length > 5 && (kr.includes(clave(c.nombre)) || clave(c.nombre).includes(kr)))));
  // Con una comunidad que ya existe: se mantienen el nombre del piso, el propietario y el coeficiente que ya tiene, y se avisa de lo que no coincide
  const viejos = existe ? d.vecinos.filter(v => v.comunidadId === existe.id) : [];
  const difs = [], difCoef = [], difProp = [];
  if (existe) for (const v of r.vecinos) {
    const o = viejos.find(x => clavePiso(x.piso) === clavePiso(v.piso)); if (!o) { difs.push(`${v.piso}: no existe en la comunidad, se añade`); continue; }
    const pal = (t) => sinTildes(t).split(/\s+/).filter(w => w.length > 2);
    if (o.propietario && v.propietario && !pal(v.propietario).some(w => pal(o.propietario).includes(w))) difProp.push({ piso: o.piso, app: o.propietario, excel: v.propietario });
    if (o.coef && v.coef && Math.abs(o.coef - v.coef) > 0.001) { difCoef.push(`${o.piso}: ${coefTxt(o.coef)} % en la app · ${coefTxt(v.coef)} % en el Excel`); }
  }
  modal({ title: 'Importar desde Excel', submit: existe ? 'Actualizar e importar' : 'Importar', wide: true,
    body: `<p style="margin:0">He encontrado en <b>${esc(f.name)}</b>:</p>
    ${r.anios.length > 1 ? `<label class="field">Qué contabilidad importo<select name="desde"><option value="">Todos los años (${r.anios.join(', ')})</option>${r.anios.slice(1).map(y => `<option value="${y}">Solo desde ${y} (lo anterior queda cerrado en el Excel; el saldo a 31/12/${y - 1} será el inicial)</option>`).join('')}</select></label>` : ''}
    <dl class="dl"><dt>Comunidad</dt><dd class="b">${esc(r.comunidad.nombre)}</dd>
    <dt>Vecinos</dt><dd>${r.vecinos.length} (${r.vecinos.map(v => esc(v.piso)).join(', ')})</dd>
    <dt>Suma de coeficientes</dt><dd class="num">${r.sumaCoef.toFixed(4).replace('.', ',')} %</dd>
    <dt>Cobros de cuotas</dt><dd>${r.cobros.filter(c => c.concepto === 'cuota').length} (años ${r.anios.join(', ')})</dd>
    <dt>Derramas</dt><dd>${r.derramas.map(x => `${esc(x.concepto)} · ${eur(x.total)}`).join('<br>') || '—'}</dd>
    <dt>Gastos</dt><dd>${r.gastos.length} apuntes</dd>
    <dt>Saldos del banco</dt><dd class="num">${(r.comunidad.saldosBanco || []).map(x => eur(x.importe) + ' a ' + esc(x.fecha.split('-').reverse().join('/'))).join('<br>') || '—'}</dd></dl>
    ${r.avisos.length ? `<div class="strip warn"><div><div class="l">Revisa después de importar</div>${r.avisos.map(a => `<div class="small">• ${esc(a)}</div>`).join('')}</div></div>` : ''}
    ${difs.length ? `<div class="strip warn"><div><div class="l">No coincide con lo que ya hay</div>${difs.map(a => `<div class="small">• ${esc(a)}</div>`).join('')}</div></div>` : ''}
    ${difProp.length ? `<div class="strip warn"><div><div class="l">El propietario no coincide</div>${difProp.map((x, i) => `<label class="field" style="margin-top:6px">${esc(x.piso)}<select name="prop_${i}"><option value="app">${esc(x.app)} (el que ya tiene la app)</option><option value="excel">${esc(x.excel)} (el del Excel; ${esc(x.app)} pasa a propietario anterior)</option></select></label>`).join('')}
      <div class="small" style="margin-top:6px">Si cambia el propietario, revisa después su NIF, teléfono, email y cuenta: son los del anterior.</div></div></div>` : ''}
    ${difCoef.length ? `<div class="strip warn"><div><div class="l">Los coeficientes no coinciden</div>${difCoef.map(a => `<div class="small">• ${esc(a)}</div>`).join('')}
      <label class="field" style="margin-top:8px">Qué coeficientes uso (sirven para repartir gastos y derramas)<select name="coefs"><option value="app">Los que ya tiene la app</option><option value="excel">Los del Excel</option></select></label></div></div>` : ''}
    ${existe ? `<div class="strip bad"><div>Ya existe una comunidad llamada <b>${esc(existe.nombre)}</b>. Se sustituyen sus cuotas, cobros, derramas y gastos por los del Excel. Se conservan los datos de la comunidad y los de contacto de cada propietario (NIF, teléfono, email, cuenta, dirección).</div></div>` : ''}
    <div class="small muted">Todo se puede corregir después a mano.</div>`,
    onSubmit: async (form) => {
      const y0 = fd(form), usarExcel = y0.coefs === 'excel';
      if (y0.desde) r = soloDesde(r, Number(y0.desde));
      const cambioProp = {}; difProp.forEach((x, i) => { if (y0['prop_' + i] === 'excel') cambioProp[clavePiso(x.piso)] = x; });
      // Si ya existía, se conservan los datos de la comunidad y los de contacto de los vecinos que el Excel no trae
      if (existe) await borrarComunidad(existe.id);
      const lleno = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));
      const com = await db.put('f_comunidades', existe ? { ...existe, ...lleno(r.comunidad), ...lleno(Object.fromEntries(['nombre', 'direccion', 'localidad', 'cif', 'iban', 'banco', 'presidente', 'presidentePiso', 'presidenteTel', 'presidenteEmail', 'presidenteHasta', 'secretario', 'caracteristicas', 'notas', 'idioma', 'normativa'].map(k => [k, existe[k]]))), presupuestos: { ...(existe.presupuestos || {}), ...(r.comunidad.presupuestos || {}) }, id: undefined } : r.comunidad);
      const map = {};
      for (const v of r.vecinos) { const old = viejos.find(o => clavePiso(o.piso) === clavePiso(v.piso)); if (old) { for (const k of CONTACTO) if ((v[k] == null || v[k] === '') && old[k] != null && old[k] !== '') v[k] = old[k]; for (const k of ['piso', 'propietario', 'orden', 'formaPago', 'idioma', 'avisosEmail', ...(usarExcel ? [] : ['coef'])]) if (old[k] != null && old[k] !== '') v[k] = old[k];
          const cp = cambioProp[clavePiso(old.piso)]; if (cp) { v.propietario = cp.excel; v.propietariosAnteriores = [...new Set([...(old.propietariosAnteriores || []), cp.app])]; v.historialPropietarios = [...(old.historialPropietarios || []), { propietario: cp.app, dni: old.dni || '', telefono: old.telefono || '', email: old.email || '', iban: old.iban || '', direccionNotif: old.direccionNotif || '', hasta: '', nota: 'Datos del listado de propietarios' }]; v.obs = [old.obs, 'Revisar NIF, teléfono, email y cuenta: venían del propietario anterior (' + cp.app + ').'].filter(Boolean).join(' '); } }
        const key = v._key; delete v._key; v.comunidadId = com.id; const g = await db.put('f_vecinos', v); map[key] = g.id; }
      const dmap = {};
      for (const der of r.derramas) { const key = der._key; delete der._key; der.comunidadId = com.id; const g = await db.put('f_derramas', der); dmap[key] = g.id; }
      for (const c of r.cobros) { const o = { ...c, comunidadId: com.id, vecinoId: map[c._v] }; delete o._v; if (c._d) { o.derramaId = dmap[c._d]; delete o._d; } if (o.vecinoId) await db.put('f_cobros', o); }
      for (const g of r.gastos) { const o = { ...g, comunidadId: com.id }; if (g._d) { o.derramaId = dmap[g._d]; delete o._d; } await db.put('f_gastos', o); }
      toast('Comunidad importada'); location.hash = '#/finca/' + com.id; refresh();
    } });
}

// Listado de propietarios: crea la comunidad o completa una que ya existe (sin borrar nada)
function dialogoListado(r, f, d, refresh) {
  const activas = d.coms.filter(c => !c.archivada);
  const parecida = activas.find(c => normPiso(c.nombre).replace(/\W/g, '').includes(normPiso(r.comunidad.nombre).replace(/^CO?\W*/, '').replace(/\W/g, '')) || normPiso(c.direccion || '') === normPiso(r.comunidad.direccion));
  modal({ title: 'Importar listado de propietarios', submit: 'Importar', wide: true,
    body: `<p style="margin:0">He encontrado en <b>${esc(f.name)}</b> ${r.vecinos.length} propietarios: ${r.vecinos.map(v => esc(v.piso)).join(', ')}. Los coeficientes suman <b class="num">${r.sumaCoef.toFixed(4).replace('.', ',')} %</b>.</p>
      <label class="field">Dónde los pongo<select name="destino" id="destLis">${activas.map(c => `<option value="${c.id}" ${parecida?.id === c.id ? 'selected' : ''}>Completar «${esc(c.nombre)}»</option>`).join('')}<option value="" ${parecida ? '' : 'selected'}>Comunidad nueva</option></select></label>
      <div id="nuevaLis" class="grid2" ${parecida ? 'hidden' : ''}>${field('Nombre de la comunidad', 'nombre', r.comunidad.nombre)}${field('Dirección', 'direccion', r.comunidad.direccion)}${field('Código postal y población', 'localidad', r.comunidad.localidad)}</div>
      <div class="small muted" id="expLis">${parecida ? 'Los pisos que ya existan se actualizan con los datos del listado (propietario, NIF, teléfono, email, cuenta, coeficiente); los que no, se añaden. No se borra nada.' : 'Se crea la comunidad con sus propietarios. Las cuotas, el presupuesto y los saldos los completas después.'}</div>
      ${r.avisos.length ? `<div class="strip warn"><div><div class="l">Revisa después de importar</div>${r.avisos.map(a => `<div class="small">• ${esc(a)}</div>`).join('')}</div></div>` : ''}`,
    onSubmit: async (form) => {
      const y = fd(form);
      let com = y.destino ? d.coms.find(c => c.id === y.destino) : null;
      if (!com) com = await db.put('f_comunidades', { nombre: (y.nombre || r.comunidad.nombre || 'Comunidad').trim(), direccion: (y.direccion || '').trim(), localidad: (y.localidad || '').trim(), idioma: 'ca', normativa: 'Codi civil de Catalunya', periodicidad: 'mensual', diaCobro: 10, saldosBanco: [] });
      const ya = d.vecinos.filter(v => v.comunidadId === com.id);
      let nuevos = 0, actualizados = 0;
      for (const v of r.vecinos) {
        const old = ya.find(o => clavePiso(o.piso) === clavePiso(v.piso));
        if (old) { const o = { ...old }; for (const [k, val] of Object.entries(v)) if (k !== 'orden' && val !== '' && val != null) o[k] = val; await db.put('f_vecinos', o); actualizados++; }
        else { await db.put('f_vecinos', { ...v, orden: ya.length + v.orden, comunidadId: com.id, cuota: 0, saldoAnterior: 0 }); nuevos++; }
      }
      toast(`${nuevos ? nuevos + ' propietarios añadidos' : ''}${nuevos && actualizados ? ' · ' : ''}${actualizados ? actualizados + ' actualizados' : ''}`); location.hash = '#/finca/' + com.id; refresh();
    } });
  const sel = document.getElementById('destLis');
  sel.onchange = () => { document.getElementById('nuevaLis').hidden = !!sel.value; document.getElementById('expLis').textContent = sel.value ? 'Los pisos que ya existan se actualizan con los datos del listado (propietario, NIF, teléfono, email, cuenta, coeficiente); los que no, se añaden. No se borra nada.' : 'Se crea la comunidad con sus propietarios. Las cuotas, el presupuesto y los saldos los completas después.'; };
}
