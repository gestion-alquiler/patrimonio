// Conciliación bancaria (común): leer extractos (CSV, Excel o Norma 43), guardar movimientos sin duplicados
// y mostrar la lista con las sugerencias que calcula cada parte de la app.
import { db } from './db.js';
import { esc, eur, fecha, toast, modal, confirmar } from './ui.js';
import { elegirArchivos } from './files.js';

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Palabras significativas de un nombre (para buscarlas en el concepto del banco)
export const palabras = (s) => norm(s).split(' ').filter(w => w.length >= 4 && !['CALLE', 'AVDA', 'PASSEIG', 'CARRER', 'COMUNIDAD', 'COMUNITAT', 'PROPIETARIOS'].includes(w));
export const coincide = (concepto, nombre) => { const c = ' ' + norm(concepto) + ' '; return palabras(nombre).filter(w => c.includes(' ' + w + ' ') || c.includes(w)).length; };
export const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

/* ---------- Lectura de ficheros ---------- */
function numero(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[€\s]/g, '').trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /-$/.test(s); s = s.replace(/[()]/g, '').replace(/-$/, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Number(s); return isNaN(n) ? null : (neg ? -Math.abs(n) : n);
}
function fechaIso(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return d.toISOString().slice(0, 10); }
  const s = String(v ?? '').trim(); let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function csvFilas(txt) {
  const lin = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const sep = [';', '\t', ','].map(c => [c, (lin.slice(0, 10).join('\n').match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  return lin.map(l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); });
}
function norma43(txt) {
  const movs = []; let ult = null;
  txt.split(/\r?\n/).forEach(l => {
    const t = l.slice(0, 2);
    if (t === '22') { const f = l.slice(10, 16); const imp = Number(l.slice(28, 42)) / 100 * (l[27] === '1' ? -1 : 1);
      ult = { fecha: `20${f.slice(0, 2)}-${f.slice(2, 4)}-${f.slice(4, 6)}`, importe: imp, concepto: l.slice(52, 80).trim(), saldo: null }; movs.push(ult); }
    else if (t === '23' && ult) ult.concepto = (ult.concepto + ' ' + l.slice(4, 42).trim() + ' ' + l.slice(42, 80).trim()).replace(/\s+/g, ' ').trim();
  });
  return movs;
}
async function filasExcel(file) {
  if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de Excel')); document.head.appendChild(s); });
  const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
  return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}

// Busca la fila de cabecera y las columnas de fecha, concepto, importe (o cargo/abono) y saldo
function detectar(filas) {
  const N = (x) => norm(x);
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const h = filas[i].map(N);
    const idx = (re, no) => h.findIndex(x => re.test(x) && !(no && no.test(x)));
    const fF = idx(/^F(ECHA)?\.? ?(OPER|OPERACION|CONTABLE)|^FECHA$|^DATA( OPERACIO)?$|^DATE|^FECHA /, /VALOR/), fV = idx(/VALOR/);
    const cF = fF >= 0 ? fF : fV;
    const co = idx(/CONCEPTO|DESCRIPCION|DESCRIPCIO|CONCEPTE|DETALLE|MOVIMIENTO|MOVIMENT/);
    const im = idx(/^IMPORTE|^IMPORT|^CANTIDAD|^AMOUNT|^QUANTITAT/, /SALDO/);
    const ca = idx(/CARGO|DEBE|DEBIT|DEUTE/), ab = idx(/ABONO|HABER|CREDIT|ABONAMENT|INGRESO/);
    const sa = idx(/SALDO|BALANCE/);
    if (cF >= 0 && (im >= 0 || ca >= 0 || ab >= 0)) return { cab: i, fecha: cF, concepto: co, importe: im, cargo: ca, abono: ab, saldo: sa };
  }
  return { cab: -1, fecha: 0, concepto: 1, importe: 2, cargo: -1, abono: -1, saldo: -1 };
}
function movsDeFilas(filas, m) {
  const out = [];
  for (let i = m.cab + 1; i < filas.length; i++) {
    const r = filas[i]; const f = fechaIso(r[m.fecha]); if (!f) continue;
    let imp = m.importe >= 0 ? numero(r[m.importe]) : (numero(r[m.abono]) || 0) - Math.abs(numero(r[m.cargo]) || 0);
    if (imp == null || imp === 0) continue;
    out.push({ fecha: f, concepto: m.concepto >= 0 ? String(r[m.concepto] ?? '').trim() : '', importe: Math.round(imp * 100) / 100, saldo: m.saldo >= 0 ? numero(r[m.saldo]) : null });
  }
  return out;
}

// Diálogo de importación: elige archivo, comprueba columnas y guarda los movimientos nuevos
export async function importarExtracto({ store, base, existentes, alSaldo, done }) {
  const [file] = await elegirArchivos({ accept: '.csv,.txt,.xlsx,.xls,.n43,.aeb,.q43', multiple: false }); if (!file) return;
  let filas = null, movs;
  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) filas = await filasExcel(file);
    else { const txt = await file.text(); if (/^11\d{18}/.test(txt.trim())) movs = norma43(txt); else filas = csvFilas(txt); }
  } catch (e) { toast('No se pudo leer el archivo: ' + e.message); return; }
  const preparar = (m) => movsDeFilas(filas, m);
  let mapa = filas ? detectar(filas) : null;
  if (filas) movs = preparar(mapa);
  const cols = filas ? (filas[mapa.cab] || filas[0] || []).map((h, i) => [i, h ? String(h) : `Columna ${i + 1}`]) : [];
  const sel = (n, v, extra = []) => `<select name="${n}" class="inp">${[...extra, ...cols].map(([i, l]) => `<option value="${i}" ${Number(v) === Number(i) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const vista = (ms) => {
    const nuevos = ms.filter(x => !existentes.has(clave(x)));
    return `<div class="small">${ms.length} movimientos leídos · <b>${nuevos.length} nuevos</b>${ms.length - nuevos.length ? ` · ${ms.length - nuevos.length} ya importados antes (se saltan)` : ''}</div>
      <div class="tw" style="max-height:260px;overflow:auto"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Importe</th></tr></thead><tbody>${ms.slice(0, 40).map(x => `<tr><td class="num nw">${fecha(x.fecha)}</td><td class="small">${esc(x.concepto)}</td><td class="r num nw ${x.importe < 0 ? 'gas' : 'ing'}">${eur(x.importe)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  modal({ title: 'Importar extracto del banco', submit: 'Importar movimientos', wide: true,
    body: `<div class="small muted">${esc(file.name)}${filas ? '' : ' · formato Norma 43'}</div>
      ${filas ? `<div class="fgrid"><label class="field">Fecha${sel('fecha', mapa.fecha)}</label><label class="field">Concepto${sel('concepto', mapa.concepto, [[-1, '—']])}</label>
        <label class="field">Importe (con signo)${sel('importe', mapa.importe, [[-1, '— (uso cargo y abono)']])}</label><label class="field">Saldo${sel('saldo', mapa.saldo, [[-1, '—']])}</label>
        <label class="field">Cargo${sel('cargo', mapa.cargo, [[-1, '—']])}</label><label class="field">Abono${sel('abono', mapa.abono, [[-1, '—']])}</label></div>
        <div class="small muted">He detectado las columnas solo. Si algo no cuadra, cámbialo aquí: la lista de abajo se actualiza.</div>` : ''}
      <div id="vistaMovs">${vista(movs)}</div>`,
    onSubmit: async () => {
      const nuevos = movs.filter(x => !existentes.has(clave(x)));
      if (!nuevos.length) { toast('No hay movimientos nuevos'); return; }
      const imp = Date.now().toString(36);
      for (const x of nuevos) await db.put(store, { ...base, ...x, hash: clave(x), estado: 'pendiente', importacion: imp, archivo: file.name });
      const conSaldo = movs.filter(x => x.saldo != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      if (conSaldo.length && alSaldo) { const ult = filas && filas.length && movs[0] && movs[movs.length - 1] && movs[0].fecha > movs[movs.length - 1].fecha ? movs.find(x => x.saldo != null) : conSaldo[conSaldo.length - 1]; await alSaldo(ult.fecha, ult.saldo); }
      toast(`${nuevos.length} movimientos importados`); done();
    } });
  if (filas) document.querySelectorAll('.dialog select').forEach(s => s.onchange = () => {
    const g = (n) => Number(document.querySelector(`.dialog [name=${n}]`).value);
    mapa = { cab: mapa.cab, fecha: g('fecha'), concepto: g('concepto'), importe: g('importe'), saldo: g('saldo'), cargo: g('cargo'), abono: g('abono') };
    movs = preparar(mapa); document.getElementById('vistaMovs').innerHTML = vista(movs); });
}
export const clave = (x) => `${x.fecha}|${Number(x.importe).toFixed(2)}|${norm(x.concepto).slice(0, 60)}`;

/* ---------- Lista de movimientos ---------- */
// cfg: { titulo, movs, filtro, sugerir(mov) -> [{texto, detalle, aplicar}], manual(mov), deshacer(mov), store, ultimoSaldo, importar(), refresh, alFiltro(f) }
export function bancoHtml(cfg) {
  const movs = cfg.movs.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const n = (e) => movs.filter(m => m.estado === e).length;
  const vis = movs.filter(m => cfg.filtro === 'todos' || m.estado === cfg.filtro);
  return `<div class="head" style="align-items:center"><div><h2>${esc(cfg.titulo)}</h2><div class="small muted">Importa el extracto (Excel, CSV o Norma 43, el formato de los bancos españoles) y empareja cada movimiento con un cobro o un gasto.</div></div>
    <div class="actions">${cfg.prueba ? '<button class="btn" data-b="ejemplo">Descargar extracto de prueba</button>' : ''}<button class="btn primary" data-b="importar">Importar extracto</button></div></div>
  <section class="kpis">
    <div class="card kpi"><div class="l">Por revisar</div><div class="v num ${n('pendiente') ? 'neg' : ''}">${n('pendiente')}</div><div class="s">movimientos sin emparejar</div></div>
    <div class="card kpi"><div class="l">Conciliados</div><div class="v num">${n('conciliado')}</div><div class="s">${n('ignorado')} ignorados</div></div>
    <div class="card kpi"><div class="l">Último saldo del banco</div><div class="v num">${cfg.ultimoSaldo ? eur(cfg.ultimoSaldo.importe) : '—'}</div><div class="s">${cfg.ultimoSaldo ? 'A ' + fecha(cfg.ultimoSaldo.fecha) : 'Sin saldo en el extracto'}</div></div>
  </section>
  <section class="card"><div class="cardhead"><div class="chips">${[['pendiente', 'Por revisar'], ['conciliado', 'Conciliados'], ['ignorado', 'Ignorados'], ['todos', 'Todos']].map(([k, l]) => `<button class="chip ${cfg.filtro === k ? 'on' : ''}" data-bf="${k}" aria-pressed="${cfg.filtro === k}">${l}</button>`).join('')}</div>
    ${n('pendiente') ? '<button class="btn sm" data-b="aceptarTodas">Aceptar todas las sugerencias seguras</button>' : ''}</div>
    <div class="tw"><table style="min-width:980px"><thead><tr><th>Fecha</th><th>Concepto del banco</th><th class="r">Importe</th><th style="width:44%">Emparejado con</th></tr></thead><tbody>
    ${vis.map(m => { let col;
      if (m.estado === 'conciliado') col = `<div style="display:flex;gap:8px;align-items:center"><span class="badge ok">Conciliado</span><span class="small" style="flex:1">${esc(m.vinculo?.texto || '')}</span><button class="btn sm" data-bdes="${m.id}">Deshacer</button></div>`;
      else if (m.estado === 'ignorado') col = `<div style="display:flex;gap:8px;align-items:center"><span class="badge neutral">Ignorado</span><span style="flex:1"></span><button class="btn sm" data-bdes="${m.id}">Deshacer</button></div>`;
      else { const sg = cfg.sugerir(m);
        col = `<div class="stack" style="gap:6px">${sg.slice(0, 2).map((x, i) => `<div style="display:flex;gap:8px;align-items:center"><button class="btn sm ${i === 0 ? 'primary' : ''}" data-bok="${m.id}|${i}">Aceptar</button><span class="small" style="flex:1">${esc(x.texto)}${x.detalle ? `<span class="muted"> · ${esc(x.detalle)}</span>` : ''}</span></div>`).join('') || '<span class="small muted">Sin sugerencia</span>'}
          <div style="display:flex;gap:8px"><button class="btn sm" data-bman="${m.id}">${m.importe > 0 ? 'Asignar cobro…' : 'Asignar gasto…'}</button><button class="btn sm" data-bign="${m.id}">Ignorar</button></div></div>`; }
      return `<tr><td class="num nw">${fecha(m.fecha)}</td><td class="small">${esc(m.concepto)}</td><td class="r num nw b ${m.importe < 0 ? 'gas' : 'ing'}">${eur(m.importe)}</td><td>${col}</td></tr>`; }).join('') || `<tr><td colspan="4" class="muted">${movs.length ? 'No hay movimientos en esta vista.' : 'Aún no has importado ningún extracto.'}</td></tr>`}
    </tbody></table></div><div class="cardfoot">«Ignorar» sirve para movimientos que no son de la app (traspasos, comisiones que no quieres apuntar…). Todo se puede deshacer.</div></section>`;
}

export function enlazarBanco(el, cfg) {
  const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
  const mov = (id) => cfg.movs.find(m => m.id === id);
  on('[data-b=importar]', () => cfg.importar());
  on('[data-b=ejemplo]', () => cfg.ejemplo());
  on('[data-bf]', (b) => cfg.alFiltro(b.dataset.bf));
  const aplicar = async (m, s) => { const v = await s.aplicar(); await db.put(cfg.store, { ...m, estado: 'conciliado', vinculo: { texto: s.texto, ...v } }); };
  on('[data-bok]', async (b) => { const [id, i] = b.dataset.bok.split('|'); const m = mov(id); b.disabled = true; await aplicar(m, cfg.sugerir(m)[Number(i)]); toast('Conciliado'); cfg.refresh(); });
  on('[data-bign]', async (b) => { await db.put(cfg.store, { ...mov(b.dataset.bign), estado: 'ignorado' }); cfg.refresh(); });
  on('[data-bman]', (b) => cfg.manual(mov(b.dataset.bman)));
  on('[data-bdes]', async (b) => { const m = mov(b.dataset.bdes);
    if (m.estado === 'conciliado' && m.vinculo?.creados?.length && !(await confirmar('Deshacer', 'Se borrará lo que se creó al conciliar este movimiento (cobro o gasto).', 'Deshacer'))) return;
    if (m.estado === 'conciliado') await cfg.deshacer(m);
    const { vinculo, ...resto } = m; await db.put(cfg.store, { ...resto, estado: 'pendiente' }); toast('Deshecho'); cfg.refresh(); });
  on('[data-b=aceptarTodas]', async (b) => {
    b.disabled = true; let n = 0;
    for (const m of cfg.movs.filter(x => x.estado === 'pendiente')) { const s = cfg.sugerir(m)[0]; if (s && s.seguro) { await aplicar(m, s); n++; } }
    toast(n ? `${n} movimientos conciliados` : 'No hay sugerencias seguras: revísalos uno a uno'); cfg.refresh();
  });
}

// Deshace lo que hizo una conciliación: borra lo creado y desvincula lo existente
export async function deshacerVinculo(v) {
  for (const c of v?.creados || []) await db.del(c.store, c.id);
  for (const x of v?.vinculados || []) { const o = await db.get(x.store, x.id); if (o) { delete o.banco; if (x.estadoPrevio) o.estado = x.estadoPrevio; await db.putRaw(x.store, o); } }
}
