import { db, borrarComunidad } from '../../db.js';
import { esc, eur, num, modal, confirmar, field, select, textarea, money, fd, toast } from '../../ui.js';
import { vecinosDe, deudaVecino, saldoActual, cuotaEn } from '../calc.js';
import { importarExcel } from '../importar.js';
import { elegirArchivos } from '../../files.js';

let verArchivadas = false;

export async function render(_, d) {
  const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth() + 1;
  const items = d.coms.filter(c => !!c.archivada === verArchivadas).map(c => {
    const vs = vecinosDe(d, c.id);
    const deudas = vs.map(v => deudaVecino(c, v, d).total);
    const pend = deudas.reduce((a, x) => a + x, 0), morosos = deudas.filter(x => x > 0.1).length;
    return { c, vs, pend, morosos, cuotaMes: vs.reduce((a, v) => a + cuotaEn(v, y, m), 0), saldo: saldoActual(c, d) };
  });
  const nArch = d.coms.filter(c => c.archivada).length;
  const act = d.coms.filter(c => !c.archivada);
  const tot = items.reduce((a, i) => ({ pend: a.pend + i.pend, saldo: a.saldo + i.saldo, n: a.n + i.vs.length }), { pend: 0, saldo: 0, n: 0 });
  return `<div class="page">
  <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">Admon. Fincas</div><h1>${verArchivadas ? 'Comunidades archivadas' : 'Comunidades de propietarios'}</h1></div>
    <div class="actions"><button class="btn" data-a="importar">Importar desde Excel</button><button class="btn primary" data-a="nueva">+ Nueva comunidad</button></div></div>
  ${!verArchivadas && act.length ? `<section class="kpis" aria-label="Indicadores">
    <div class="card kpi"><div class="l">Comunidades</div><div class="v">${act.length}</div><div class="s">${tot.n} pisos y locales</div></div>
    <div class="card kpi"><div class="l">Saldo en bancos</div><div class="v">${eur(tot.saldo, 0)}</div><div class="s">Según los movimientos registrados</div></div>
    <div class="card kpi"><div class="l">Pendiente de cobro</div><div class="v ${tot.pend > 0.1 ? 'neg' : ''}">${eur(tot.pend, 0)}</div><div class="s">${items.reduce((a, i) => a + i.morosos, 0)} propietarios con deuda</div></div>
  </section>` : ''}
  ${items.length ? `<div class="grid-props" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${items.map(i => `<article class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;gap:12px;align-items:flex-start"><div style="width:44px;height:44px;border-radius:10px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex:none"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M16 9h3a1 1 0 0 1 1 1v11"/><path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1M3 21h18"/></svg></div>
      <div style="flex:1;min-width:0"><a href="#/finca/${i.c.id}" style="font:600 18px 'Space Grotesk',sans-serif;color:var(--ink);text-decoration:none">${esc(i.c.nombre)}</a><div class="small muted">${esc([i.c.localidad, i.vs.length + ' pisos y locales', i.c.cif ? 'CIF ' + i.c.cif : ''].filter(Boolean).join(' · '))}</div></div>
      <span class="badge ${i.c.archivada ? 'neutral' : i.morosos ? 'bad' : 'ok'}">${i.c.archivada ? 'Archivada' : i.morosos ? i.morosos + (i.morosos === 1 ? ' moroso' : ' morosos') : 'Al día'}</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 0;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)">
      <div><div class="small muted">Cuotas/mes</div><b class="num">${eur(i.cuotaMes)}</b></div><div><div class="small muted">Saldo</div><b class="num">${eur(i.saldo, 0)}</b></div><div><div class="small muted">Pendiente</div><b class="num ${i.pend > 0.1 ? 'neg' : ''}">${eur(i.pend)}</b></div></div>
    <div class="actions" style="justify-content:flex-end">${i.c.archivada ? `<button class="btn sm" data-recuperar="${i.c.id}">Recuperar</button><button class="btn sm danger" data-eliminar="${i.c.id}">Eliminar</button>` : `<a class="btn sm" href="#/finca/${i.c.id}">Abrir</a><button class="btn sm danger" data-baja="${i.c.id}">Dar de baja</button>`}</div>
  </article>`).join('')}</div>`
  : `<div class="card empty"><h2>${verArchivadas ? 'No hay comunidades archivadas' : 'Aún no hay comunidades'}</h2>${verArchivadas ? '' : `<p style="margin:0;max-width:540px">Crea una comunidad y ve añadiendo sus vecinos, o importa directamente tu Excel de contabilidad de cuotas.</p>
    <div class="actions"><button class="btn primary" data-a="nueva">+ Nueva comunidad</button><button class="btn" data-a="importar">Importar desde Excel</button><button class="btn" data-a="prueba">Cargar datos de prueba</button></div>`}</div>`}
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

export function formComunidad(c, done) {
  const v = c || { periodicidad: 'mensual', idioma: 'ca', normativa: 'Codi civil de Catalunya', diaCobro: 10, saldoInicial: 0, cobrosDesde: new Date().toISOString().slice(0, 7) };
  modal({
    title: c ? 'Editar comunidad' : 'Nueva comunidad', wide: true,
    body: `<div class="fgrid">
      ${field('Nombre', 'nombre', v.nombre, { required: true, span2: true, placeholder: 'Comunidad C/ Sant Llorenç, 19' })}
      ${field('Dirección', 'direccion', v.direccion)}${field('CP y localidad', 'localidad', v.localidad)}
      ${field('CIF / NIF', 'cif', v.cif)}${field('IBAN de la comunidad', 'iban', v.iban)}
      ${field('Presidente/a', 'presidente', v.presidente)}${field('Vicepresidente/a', 'vicepresidente', v.vicepresidente)}${field('Secretario/a', 'secretario', v.secretario, { placeholder: 'El administrador' })}
      ${money('Presupuesto anual (€)', 'presupuesto', v.presupuesto)}
      ${select('Cuotas', 'periodicidad', v.periodicidad, [['mensual', 'Mensuales'], ['trimestral', 'Trimestrales']])}
      ${field('Las cuotas vencen el día', 'diaCobro', v.diaCobro, { inputmode: 'numeric' })}
      ${field('Controlar cuotas desde', 'cobrosDesde', v.cobrosDesde, { type: 'month', hint: 'Los meses anteriores no cuentan como deuda' })}
      ${money('Fondo de reserva (€)', 'fondoReserva', v.fondoReserva)}
      ${money('Saldo del banco (€)', 'saldoInicial', v.saldoInicial, { hint: 'Saldo de la cuenta en la fecha de al lado' })}${field('Fecha del saldo', 'saldoFecha', v.saldoFecha, { type: 'date' })}
      ${select('Idioma de los escritos', 'idioma', v.idioma, [['ca', 'Català'], ['es', 'Castellano']])}
      ${select('Normativa', 'normativa', v.normativa, ['Codi civil de Catalunya', 'Ley de Propiedad Horizontal'])}
      ${textarea('Notas', 'notas', v.notas)}
    </div>`,
    onSubmit: async (f) => {
      const x = fd(f);
      if (!x.nombre.trim()) { toast('Falta el nombre'); return false; }
      const obj = { ...v, ...x, nombre: x.nombre.trim(), presupuesto: num(x.presupuesto), fondoReserva: num(x.fondoReserva), saldoInicial: num(x.saldoInicial), diaCobro: Number(x.diaCobro) || 10 };
      await db.put('f_comunidades', obj); toast(c ? 'Comunidad guardada' : 'Comunidad creada'); done && done(obj);
    },
  });
}

export async function importarDialogo(d, refresh) {
  const [f] = await elegirArchivos({ accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', multiple: false });
  if (!f) return;
  toast('Leyendo el Excel…');
  let r;
  try { r = await importarExcel(f); } catch (e) { console.error(e); toast('No se pudo leer: ' + e.message); return; }
  const existe = d.coms.find(c => c.nombre.trim().toLowerCase() === r.comunidad.nombre.trim().toLowerCase());
  modal({ title: 'Importar desde Excel', submit: existe ? 'Sustituir e importar' : 'Importar', wide: true,
    body: `<p style="margin:0">He encontrado en <b>${esc(f.name)}</b>:</p>
    <dl class="dl"><dt>Comunidad</dt><dd class="b">${esc(r.comunidad.nombre)}</dd>
    <dt>Vecinos</dt><dd>${r.vecinos.length} (${r.vecinos.map(v => esc(v.piso)).join(', ')})</dd>
    <dt>Suma de coeficientes</dt><dd class="num">${r.sumaCoef.toFixed(4).replace('.', ',')} %</dd>
    <dt>Cobros de cuotas</dt><dd>${r.cobros.filter(c => c.concepto === 'cuota').length} (años ${r.anios.join(', ')})</dd>
    <dt>Derramas</dt><dd>${r.derramas.map(x => `${esc(x.concepto)} · ${eur(x.total)}`).join('<br>') || '—'}</dd>
    <dt>Gastos</dt><dd>${r.gastos.length} apuntes</dd>
    <dt>Saldo inicial</dt><dd class="num">${r.comunidad.saldoInicial ? eur(r.comunidad.saldoInicial) + ' (' + esc(r.comunidad.saldoFecha || '') + ')' : '—'}</dd></dl>
    ${r.avisos.length ? `<div class="strip warn"><div><div class="l">Revisa después de importar</div>${r.avisos.map(a => `<div class="small">• ${esc(a)}</div>`).join('')}</div></div>` : ''}
    ${existe ? `<div class="strip bad"><div>Ya existe una comunidad llamada <b>${esc(existe.nombre)}</b>. Se sustituirá por los datos del Excel.</div></div>` : ''}
    <div class="small muted">Todo se puede corregir después a mano.</div>`,
    onSubmit: async () => {
      if (existe) await borrarComunidad(existe.id);
      const com = await db.put('f_comunidades', r.comunidad);
      const map = {};
      for (const v of r.vecinos) { const key = v._key; delete v._key; v.comunidadId = com.id; const g = await db.put('f_vecinos', v); map[key] = g.id; }
      const dmap = {};
      for (const der of r.derramas) { const key = der._key; delete der._key; der.comunidadId = com.id; const g = await db.put('f_derramas', der); dmap[key] = g.id; }
      for (const c of r.cobros) { const o = { ...c, comunidadId: com.id, vecinoId: map[c._v] }; delete o._v; if (c._d) { o.derramaId = dmap[c._d]; delete o._d; } if (o.vecinoId) await db.put('f_cobros', o); }
      for (const g of r.gastos) { const o = { ...g, comunidadId: com.id }; if (g._d) { o.derramaId = dmap[g._d]; delete o._d; } await db.put('f_gastos', o); }
      toast('Comunidad importada'); location.hash = '#/finca/' + com.id; refresh();
    } });
}
