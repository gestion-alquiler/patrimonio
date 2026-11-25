import { db } from '../db.js';
import { esc, eur, num, modal, field, select, textarea, money, fd, toast } from '../ui.js';
import { contratoActivo, deudaContrato, balanceAnual, fotoPortada } from '../calc.js';
import { cargarPrueba } from '../prueba.js';

let filtro = 'todas', busca = '';
const urls = [];

export async function render(_, d) {
  urls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const y = new Date().getFullYear();
  const items = d.props.map(p => {
    const c = contratoActivo(d.contratos, p.id);
    const deuda = c ? deudaContrato(c, d.pagos).total : 0;
    const bal = balanceAnual(y, d.pagos, d.gastos, p.id);
    const foto = fotoPortada(p, d.documentos);
    let fotoUrl = '';
    if (foto) { fotoUrl = URL.createObjectURL(foto.blob); urls.push(fotoUrl); }
    const estado = !c ? ['Libre', 'neutral'] : deuda > 0.005 ? ['Debe ' + eur(deuda), 'bad'] : ['Al día', 'ok'];
    const k = !c ? 'libre' : deuda > 0.005 ? 'deuda' : 'alq';
    return { p, c, deuda, bal, fotoUrl, estado, k, inq: c ? d.inq(c.inquilinoId) : null };
  });
  const n = { todas: items.length, alq: items.filter(i => i.c).length, libre: items.filter(i => !i.c).length, deuda: items.filter(i => i.k === 'deuda').length };
  const q = busca.toLowerCase();
  const vis = items.filter(i => (filtro === 'todas' || (filtro === 'alq' ? !!i.c : i.k === filtro)) &&
    (!q || [i.p.direccion, i.p.zona, i.p.tipo, i.inq?.nombre].join(' ').toLowerCase().includes(q)));
  const chips = [['todas', 'Todas'], ['alq', 'Alquiladas'], ['libre', 'Libres'], ['deuda', 'Con deuda']]
    .map(([id, l]) => `<button type="button" class="chip ${filtro === id ? 'on' : ''}" data-f="${id}" aria-pressed="${filtro === id}">${l} <span style="opacity:.75">${n[id]}</span></button>`).join('');
  return `<div class="page">
  <div class="head"><div><h1>Propiedades</h1><div class="sub">${n.todas} en total · ${n.alq} alquiladas · ${n.libre} libres</div></div>
    <div class="actions"><button class="btn primary" data-a="nueva">+ Nueva propiedad</button></div></div>
  ${d.props.length ? `<div class="head" style="align-items:center"><div class="chips" role="group" aria-label="Filtrar">${chips}</div>
    <label class="sr" for="busca">Buscar</label><input id="busca" class="search" type="search" placeholder="Dirección, zona o inquilino…" value="${esc(busca)}"></div>
  <div class="grid-props">${vis.map(i => `<a class="card prop" href="#/propiedad/${i.p.id}">
    <div class="ph ${i.fotoUrl ? '' : 'sinfoto'}" style="${i.fotoUrl ? `background-image:url('${i.fotoUrl}')` : ''}"><span class="badge ${i.estado[1]}">${esc(i.estado[0])}</span><span class="badge neutral">${esc(i.p.tipo || 'Inmueble')}</span></div>
    <div class="bd"><div><div class="t">${esc(i.p.direccion)}</div><div class="small muted">${esc([i.p.zona, i.p.m2 ? i.p.m2 + ' m²' : ''].filter(Boolean).join(' · ')) || '&nbsp;'}</div></div>
    <div class="small" style="display:flex;gap:8px;align-items:center">${'<svg aria-hidden="true" viewBox="0 0 24 24" style="color:#5B625E"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'}${esc(i.inq ? i.inq.nombre : 'Sin inquilino')}</div>
    <div class="ft"><div><div class="small muted">Renta</div><b class="num">${i.c ? eur(i.c.renta) : '—'}</b></div>
    <div><div class="small muted">Margen ${new Date().getFullYear()}</div><b class="num ${i.bal.margen < 0 ? 'neg' : ''}">${eur(i.bal.margen, 0)}</b></div></div></div></a>`).join('') || '<div class="muted">Ninguna propiedad coincide con el filtro.</div>'}</div>`
  : `<div class="card empty"><h2>Aún no hay propiedades</h2><p style="margin:0">Empieza dando de alta tu primera vivienda o local.</p>
     <div class="actions"><button class="btn primary" data-a="nueva">+ Nueva propiedad</button><button class="btn" data-a="prueba">Cargar datos de prueba</button></div></div>`}
  </div>`;
}

export function bind(el, _, d, refresh) {
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; refresh(); });
  const s = el.querySelector('#busca');
  if (s) { s.oninput = () => { busca = s.value; clearTimeout(s._t); s._t = setTimeout(async () => { await refresh(); const n = document.getElementById('busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); }; }
  el.querySelectorAll('[data-a=nueva]').forEach(b => b.onclick = () => formPropiedad(null, (p) => { location.hash = '#/propiedad/' + p.id; }));
  const ej = el.querySelector('[data-a=prueba]');
  if (ej) ej.onclick = async () => { ej.disabled = true; ej.textContent = 'Cargando…'; await cargarPrueba(); toast('Datos de prueba cargados. Se borran desde Ajustes.'); refresh(); };
}

export function formPropiedad(p, done) {
  const v = p || {};
  modal({
    title: p ? 'Editar propiedad' : 'Nueva propiedad', wide: true,
    body: `<div class="fgrid">
      ${field('Dirección', 'direccion', v.direccion, { required: true, span2: true, placeholder: 'C/ Mayor 12, 2ºB' })}
      ${field('Zona / localidad', 'zona', v.zona)}
      ${select('Tipo', 'tipo', v.tipo || 'Piso', ['Piso', 'Ático', 'Casa', 'Local', 'Garaje', 'Trastero', 'Oficina', 'Otro'])}
      ${field('Superficie (m²)', 'm2', v.m2, { inputmode: 'numeric' })}
      ${field('Habitaciones', 'habitaciones', v.habitaciones, { inputmode: 'numeric' })}
      ${field('Referencia catastral', 'refCatastral', v.refCatastral, { span2: true })}
      ${field('Fecha de compra', 'fechaCompra', v.fechaCompra, { type: 'date' })}
      ${money('Precio de compra (€)', 'precioCompra', v.precioCompra)}
      ${money('Gastos de compra (€)', 'gastosCompra', v.gastosCompra, { hint: 'Notaría, impuestos, reforma inicial…' })}
      ${money('Valor actual estimado (€)', 'valorActual', v.valorActual)}
      ${field('Administrador de la comunidad', 'comunidadAdmin', v.comunidadAdmin)}
      ${field('Seguro (compañía y póliza)', 'seguro', v.seguro)}
      ${field('Vencimiento del seguro', 'seguroVence', v.seguroVence, { type: 'date' })}
      ${field('Certificado energético', 'certEnergetico', v.certEnergetico, { placeholder: 'Letra y año de caducidad' })}
      ${textarea('Observaciones', 'obs', v.obs)}
    </div>`,
    onSubmit: async (form) => {
      const x = fd(form);
      if (!x.direccion.trim()) { toast('La dirección es obligatoria'); return false; }
      const obj = { ...v, ...x, precioCompra: num(x.precioCompra), gastosCompra: num(x.gastosCompra), valorActual: num(x.valorActual) };
      await db.put('propiedades', obj);
      toast(p ? 'Propiedad guardada' : 'Propiedad creada');
      done && done(obj);
    },
  });
}
