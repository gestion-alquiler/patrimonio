// Agenda de proveedores, común para todas las comunidades
import { db } from '../../db.js';
import { esc, eur, modal, confirmar, field, select, textarea, fd, toast } from '../../ui.js';

export const SERVICIOS = ['Limpieza', 'Electricidad / luz', 'Agua', 'Ascensor', 'Seguro', 'Fontanería', 'Cerrajería', 'Electricista', 'Pintura', 'Obras / construcción', 'Jardinería', 'Desinfección / plagas', 'Extintores / PCI', 'Arquitecto / técnico', 'Administración', 'Otros'];
let filtro = '';

export async function render(_, d) {
  const y = new Date().getFullYear();
  const q = filtro.trim().toLowerCase();
  const lista = d.proveedores.filter(p => !q || [p.nombre, p.servicio, p.nif, p.telefono, p.email].some(x => (x || '').toLowerCase().includes(q)));
  const uso = (p) => { const gs = d.gastos.filter(g => g.proveedorId === p.id); const coms = [...new Set(gs.map(g => g.comunidadId))].map(id => d.coms.find(c => c.id === id)?.nombre).filter(Boolean);
    return { coms, anio: gs.filter(g => (g.fecha || '').startsWith(String(y))).reduce((a, g) => a + Number(g.importe || 0), 0) }; };
  return `<div class="page">
  <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">Admon. Fincas</div><h1>Proveedores</h1><div class="sub">Una sola agenda para todas las comunidades. Al apuntar un gasto los eliges de la lista.</div></div>
    <div class="actions"><button class="btn primary" data-a="nuevo">+ Nuevo proveedor</button></div></div>
  <section class="card"><div class="cardhead"><label class="sr" for="buscaProv">Buscar</label><input id="buscaProv" class="inp" style="max-width:320px" placeholder="Buscar por nombre, servicio, teléfono…" value="${esc(filtro)}"><span class="small muted">${d.proveedores.length} proveedores</span></div>
    <div class="tw"><table style="min-width:820px"><thead><tr><th>Proveedor</th><th>Servicio</th><th>Contacto</th><th>Comunidades</th><th class="r">Gastado ${y}</th><th></th></tr></thead><tbody>
    ${lista.map(p => { const u = uso(p); return `<tr><td class="b">${esc(p.nombre)}${p.nif ? `<div class="small muted" style="font-weight:400">${esc(p.nif)}</div>` : ''}</td><td><span class="badge neutral">${esc(p.servicio || '—')}</span></td>
      <td class="small">${p.telefono ? `<a href="tel:${esc(p.telefono)}">${esc(p.telefono)}</a>` : ''}${p.email ? `<div><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}${p.contacto ? `<div class="muted">${esc(p.contacto)}</div>` : ''}${!p.telefono && !p.email && !p.contacto ? '—' : ''}</td>
      <td class="small">${u.coms.map(esc).join(', ') || '<span class="muted">—</span>'}</td><td class="r num">${u.anio ? eur(u.anio) : '—'}</td><td><button class="btn sm" data-edit="${p.id}">Editar</button></td></tr>`; }).join('') || `<tr><td colspan="6" class="muted">${d.proveedores.length ? 'Ninguno coincide con la búsqueda' : 'Aún no hay proveedores. Añádelos aquí o directamente al apuntar un gasto.'}</td></tr>`}
    </tbody></table></div></section></div>`;
}

export function bind(el, _, d, refresh) {
  el.querySelector('[data-a=nuevo]').onclick = () => formProveedor(null, d, refresh);
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => formProveedor(d.proveedores.find(p => p.id === b.dataset.edit), d, refresh));
  const bu = el.querySelector('#buscaProv');
  bu.oninput = () => { filtro = bu.value; clearTimeout(bu._t); bu._t = setTimeout(async () => { await refresh(); const n = document.getElementById('buscaProv'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
}

export function formProveedor(p, d, done, pre = {}) {
  const v = p || { servicio: 'Otros', ...pre };
  modal({ title: p ? 'Editar proveedor' : 'Nuevo proveedor', wide: true, extra: p ? '<button type="button" class="btn danger" data-del>Borrar</button>' : '',
    body: `<div class="fgrid">${field('Nombre o razón social', 'nombre', v.nombre, { required: true })}${select('Servicio', 'servicio', v.servicio, SERVICIOS)}
      ${field('NIF / CIF', 'nif', v.nif)}${field('Persona de contacto', 'contacto', v.contacto)}${field('Teléfono', 'telefono', v.telefono, { type: 'tel' })}${field('Email', 'email', v.email, { type: 'email' })}
      ${field('IBAN (para pagarle)', 'iban', v.iban, { span2: true })}${textarea('Notas', 'notas', v.notas)}</div>`,
    onSubmit: async (f) => { const x = fd(f); if (!x.nombre.trim()) { toast('Falta el nombre'); return false; }
      const obj = await db.put('f_proveedores', { ...v, ...x, nombre: x.nombre.trim() }); toast('Proveedor guardado'); done && done(obj); } });
  const del = document.querySelector('[data-del]');
  if (del) del.onclick = async () => { const n = d.gastos.filter(g => g.proveedorId === p.id).length;
    if (await confirmar('Borrar proveedor', n ? `Tiene ${n} gastos apuntados. Los gastos se conservan con su nombre escrito.` : '¿Seguro que quieres borrar este proveedor?')) { await db.del('f_proveedores', p.id); toast('Proveedor borrado'); done && done(null); } };
}
