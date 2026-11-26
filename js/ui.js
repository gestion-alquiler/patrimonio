// Utilidades de interfaz: escapado, formato, modales, avisos
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const miles = (t) => t.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export function eur(n, dec = 2) {
  const v = Number(n) || 0;
  const neg = v < 0;
  const [i, d] = Math.abs(v).toFixed(dec).split('.');
  return (neg ? '−' : '') + miles(i) + (dec ? ',' + d : '') + '\u00A0€';
}
export const num = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').trim().replace(/\s|€/g, '');
  if (!t) return 0;
  // admite 1.234,56 y 1234.56
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return isNaN(n) ? 0 : n;
};
export const fmtNum = (n) => (n === '' || n == null) ? '' : String(Number(n).toFixed(2)).replace('.', ',');

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export function fecha(iso) { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
export function fechaCorta(iso) { if (!iso) return ''; const [, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}`; }
export function diasEntre(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
export function tamano(bytes) { if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB'; return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

// Avisos breves
let tt;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2600);
}

// Modal genérico. body: HTML. onSubmit(form) devuelve true para cerrar.
export function modal({ title, body, submit = 'Guardar', wide = false, onSubmit, extra = '', danger }) {
  const root = document.getElementById('modal-root');
  const prev = document.activeElement;
  root.innerHTML = `<div class="overlay"><form class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-t" novalidate>
    <div class="dh"><h2 id="dlg-t">${esc(title)}</h2><button type="button" class="x" data-close aria-label="Cerrar">×</button></div>
    ${body}
    <div class="df">${extra}<div class="actions"><button type="button" class="btn" data-close>Cancelar</button>${submit ? `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(submit)}</button>` : ''}</div></div>
  </form></div>`;
  const form = root.querySelector('form');
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  root.querySelector('.overlay').addEventListener('mousedown', (e) => { if (e.target.classList.contains('overlay')) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try { const ok = await onSubmit(form); if (ok !== false) close(); }
    catch (err) { console.error(err); toast('No se pudo guardar: ' + err.message); }
    finally { if (btn) btn.disabled = false; }
  });
  const first = form.querySelector('input:not([type=hidden]), select, textarea');
  (first || form.querySelector('.x')).focus();
  return { form, close };
}

export function confirmar(title, texto, boton = 'Borrar') {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal({ title, body: `<p style="margin:0">${texto}</p>`, submit: boton, danger: true, onSubmit: () => { ok = true; resolve(true); } });
    m.form.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { if (!ok) resolve(false); }));
  });
}

export const fd = (form) => Object.fromEntries(new FormData(form).entries());

export function field(label, name, value = '', opts = {}) {
  const { type = 'text', hint = '', span2 = false, required = false, placeholder = '', inputmode } = opts;
  return `<label class="field ${span2 ? 'span2' : ''}">${esc(label)}${required ? ' *' : ''}
    <input type="${type}" name="${name}" value="${esc(value)}" ${required ? 'required' : ''} ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
}
export function select(label, name, value, options, opts = {}) {
  return `<label class="field ${opts.span2 ? 'span2' : ''}">${esc(label)}<select name="${name}">${options.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('')}</select>${opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ''}</label>`;
}
export function textarea(label, name, value = '', opts = {}) {
  return `<label class="field ${opts.span2 !== false ? 'span2' : ''}">${esc(label)}<textarea name="${name}" rows="${opts.rows || 3}">${esc(value)}</textarea></label>`;
}
export const money = (label, name, value, opts = {}) => field(label, name, value === '' || value == null ? '' : fmtNum(value), { ...opts, inputmode: 'decimal' });

export function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const ICON = {
  user: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  up: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  pdf: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/></svg>',
};
