// Sincronización con Google Drive (la misma información en el ordenador y en el móvil).
// En Drive se guarda una carpeta «Patrimonio · Admon. Fincas» con:
//   - datos.json: todos los registros (sin los archivos) y la lista de borrados
//   - un archivo por cada documento o foto (se suben una sola vez)
// Con el permiso drive.file la aplicación solo ve los archivos que ha creado ella.
import { db, STORES, STORES_FIN, leerBorrados, guardarBorrados, alCambiar } from './db.js';

export const CLIENT_ID = '993518809684-d36euj4t8bp0fit0s3f5kru52pbbg0e7.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
const TODAS = STORES.concat(STORES_FIN);
const K = { con: 'sync.conectado', tok: 'sync.token', rev: 'sync.rev', fid: 'sync.fileId', dir: 'sync.carpeta', ult: 'sync.ultima', sucio: 'sync.sucio' };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

// ---------- Estado visible ----------
// estado: 'off' (no conectado) | 'login' (hay que pulsar para entrar) | 'sync' (sincronizando) | 'ok' | 'pend' (cambios por subir) | 'error'
const st = { estado: 'off', msg: '', escuchas: [] };
export const conectado = () => ls.get(K.con) === '1';
export const ultimaSync = () => ls.get(K.ult);
export const estado = () => ({ estado: st.estado, msg: st.msg, ultima: ultimaSync() });
export const alEstado = (fn) => st.escuchas.push(fn);
function poner(e, msg = '') { st.estado = e; st.msg = msg; st.escuchas.forEach(f => { try { f(estado()); } catch {} }); }
const sucio = () => ls.get(K.sucio) === '1';
function recalcular() { if (!conectado()) return poner('off'); if (!tokenValido()) return poner('login'); poner(sucio() ? 'pend' : 'ok'); }

// ---------- Acceso a Google ----------
let gis = null, cliente = null;
function cargarGis() {
  if (window.__driveMock) return Promise.resolve();
  if (gis) return gis;
  gis = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gis = null; rej(new Error('No se ha podido contactar con Google. ¿Hay conexión?')); }; document.head.appendChild(s); });
  return gis;
}
function tokenGuardado() { try { return JSON.parse(ls.get(K.tok) || 'null'); } catch { return null; } }
const tokenValido = () => { const t = tokenGuardado(); return !!(t && t.exp > Date.now() + 60000); };
const token = () => tokenGuardado()?.t;

// Debe llamarse al pulsar un botón (Google abre una ventana)
export async function entrar(primeraVez = false) {
  await cargarGis();
  if (window.__driveMock) { ls.set(K.tok, JSON.stringify({ t: 'mock', exp: Date.now() + 3600e3 })); return; }
  return new Promise((res, rej) => {
    cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE,
      callback: (r) => { if (r.error) return rej(new Error(r.error_description || r.error)); ls.set(K.tok, JSON.stringify({ t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 })); res(); },
      error_callback: (e) => rej(new Error(e?.type === 'popup_closed' ? 'Has cerrado la ventana de Google' : e?.type === 'popup_failed_to_open' ? 'El navegador ha bloqueado la ventana de Google' : 'No se ha podido entrar en Google')),
    });
    cliente.requestAccessToken({ prompt: primeraVez ? 'consent' : '' });
  });
}

async function pedir(url, opt = {}) {
  const f = window.__driveMock || fetch;
  const r = await f(url, { ...opt, headers: { Authorization: 'Bearer ' + token(), ...(opt.headers || {}) } });
  if (r.status === 401) { ls.set(K.tok, null); const e = new Error('La sesión de Google ha caducado'); e.login = true; throw e; }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error?.message || ''; } catch {} throw new Error(`Google Drive respondió ${r.status}${m ? ': ' + m : ''}`); }
  return r;
}
const q = (s) => encodeURIComponent(s);
async function buscar(cond, campos = 'id,name,version,appProperties') {
  const out = []; let page = '';
  do {
    const r = await (await pedir(`${API}/files?q=${q(cond + " and trashed=false")}&spaces=drive&pageSize=1000&fields=nextPageToken,files(${campos})${page ? '&pageToken=' + page : ''}`)).json();
    out.push(...(r.files || [])); page = r.nextPageToken || '';
  } while (page);
  return out;
}
function multipart(meta, blob, tipo) {
  const b = 'frontera' + Math.random().toString(36).slice(2);
  return { body: new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${tipo}\r\n\r\n`, blob, `\r\n--${b}--`]), headers: { 'Content-Type': `multipart/related; boundary=${b}` } };
}
async function crear(meta, blob, tipo) { const m = multipart(meta, blob, tipo); return (await pedir(`${UP}/files?uploadType=multipart&fields=id,version`, { method: 'POST', ...m })).json(); }
async function actualizar(id, blob, tipo) { return (await pedir(`${UP}/files/${id}?uploadType=media&fields=id,version`, { method: 'PATCH', body: blob, headers: { 'Content-Type': tipo } })).json(); }

async function carpeta() {
  let id = ls.get(K.dir);
  if (id) { try { const f = await (await pedir(`${API}/files/${id}?fields=id,trashed`)).json(); if (!f.trashed) return id; } catch (e) { if (e.login) throw e; } }
  const ex = await buscar("appProperties has { key='tipo' and value='carpeta' }", 'id');
  if (ex[0]) id = ex[0].id;
  else id = (await (await pedir(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Patrimonio · Admon. Fincas', mimeType: 'application/vnd.google-apps.folder', appProperties: { app: 'patrimonio', tipo: 'carpeta' } }) })).json()).id;
  ls.set(K.dir, id); return id;
}
async function archivoDatos() {
  const id = ls.get(K.fid);
  if (id) { try { const f = await (await pedir(`${API}/files/${id}?fields=id,version,trashed`)).json(); if (!f.trashed) return f; } catch (e) { if (e.login) throw e; } }
  const ex = await buscar("appProperties has { key='tipo' and value='datos' }", 'id,version');
  if (ex[0]) { ls.set(K.fid, ex[0].id); return ex[0]; }
  ls.set(K.fid, null); return null;
}

// ---------- Unir datos ----------
const sinBlob = (o) => { if (!o || !('blob' in o)) return o; const { blob, ...r } = o; return r; };
const igual = (a, b) => JSON.stringify(sinBlob(a)) === JSON.stringify(sinBlob(b));
const mod = (o) => o?.modificado || '';

// Une lo de este dispositivo con lo de Drive, registro a registro: gana el cambio más reciente; un borrado gana si es posterior al último cambio.
export function unir(local, remoto) {
  const borr = new Map();
  for (const b of [...(local.borrados || []), ...(remoto.borrados || [])]) { const k = b.s + '|' + b.id, p = borr.get(k); if (!p || b.f > p.f) borr.set(k, b); }
  const limite = new Date(Date.now() - 400 * 864e5).toISOString();
  const datos = {};
  for (const s of TODAS) {
    const m = new Map();
    for (const o of remoto.datos?.[s] || []) m.set(o.id, o);
    for (const o of local.datos?.[s] || []) { const r = m.get(o.id); if (!r || mod(o) >= mod(r)) m.set(o.id, o); }
    datos[s] = [...m.values()].filter(o => { const b = borr.get(s + '|' + o.id); return !b || mod(o) > b.f; });
  }
  return { datos, borrados: [...borr.values()].filter(b => b.f > limite) };
}

async function leerLocal() {
  const datos = {};
  for (const s of TODAS) datos[s] = await db.all(s);
  return { datos, borrados: leerBorrados() };
}
function paraSubir(u) {
  const datos = {};
  for (const s of TODAS) datos[s] = u.datos[s].map(sinBlob);
  return JSON.stringify({ formato: 'gestion-sync', version: 1, guardado: new Date().toISOString(), datos, borrados: u.borrados });
}
// Escribe en este dispositivo solo lo que ha cambiado. Devuelve cuántos registros han cambiado.
async function aplicar(localD, u) {
  let n = 0;
  for (const s of TODAS) {
    const loc = new Map((localD.datos[s] || []).map(o => [o.id, o])), nue = new Map(u.datos[s].map(o => [o.id, o]));
    for (const [id, o] of nue) { const l = loc.get(id); if (!l || !igual(l, o)) { const blob = l?.blob && !o.blob && s === 'documentos' ? l.blob : o.blob; await db._poner(s, blob ? { ...o, blob } : o); n++; } }
    for (const id of loc.keys()) if (!nue.has(id)) { await db._quitar(s, id); n++; }
  }
  guardarBorrados(u.borrados);
  return n;
}

// Documentos y fotos: cada uno es un archivo en Drive
async function documentos(dir, docs) {
  const enDrive = await buscar("appProperties has { key='tipo' and value='doc' }", 'id,appProperties');
  const porDoc = new Map(enDrive.map(f => [f.appProperties?.docId, f.id]));
  let bajados = 0;
  for (const d of docs) {
    if (d.blob && !porDoc.has(d.id)) {
      await crear({ name: `${d.id}_${(d.archivo || d.nombre || 'archivo').replace(/[\\/]/g, '-')}`, parents: [dir], appProperties: { app: 'patrimonio', tipo: 'doc', docId: d.id } }, d.blob, d.mime || 'application/octet-stream');
    } else if (!d.blob && porDoc.has(d.id)) {
      const b = await (await pedir(`${API}/files/${porDoc.get(d.id)}?alt=media`)).blob();
      const o = await db.get('documentos', d.id); if (o) { o.blob = new File([b], d.archivo || d.nombre || 'archivo', { type: d.mime || b.type }); await db._poner('documentos', o); bajados++; }
    }
  }
  const vivos = new Set(docs.map(d => d.id));
  for (const [docId, fid] of porDoc) if (!vivos.has(docId)) { try { await pedir(`${API}/files/${fid}`, { method: 'DELETE' }); } catch (e) { if (e.login) throw e; } }
  return bajados;
}

// ---------- Sincronizar ----------
let enCurso = null, alAplicar = null;
export const alRecibir = (fn) => { alAplicar = fn; };

// opciones.decidir(): se llama la primera vez en un dispositivo con datos cuando Drive también tiene datos. Devuelve 'unir' | 'drive' | null (cancelar)
export function sincronizar(opciones = {}) {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    if (!conectado()) return;
    if (!tokenValido()) { poner('login'); return; }
    poner('sync');
    try {
      let cambios = 0;
      for (let intento = 0; intento < 3; intento++) {
        const dir = await carpeta();
        const f = await archivoDatos();
        const rev = ls.get(K.rev), eraSucio = sucio();
        ls.set(K.sucio, null);
        let local = await leerLocal(), u, remotoTxt = null;
        if (f && String(f.version) !== rev) {
          remotoTxt = await (await pedir(`${API}/files/${f.id}?alt=media`)).text();
          const remoto = JSON.parse(remotoTxt);
          if (!rev && TODAS.some(s => local.datos[s].length && s !== 'ajustes') && opciones.decidir) {
            const r = await opciones.decidir();
            if (!r) { if (eraSucio) ls.set(K.sucio, '1'); poner('error', 'Sincronización cancelada'); return; }
            if (r === 'drive') { for (const s of TODAS) await db._vaciar(s); guardarBorrados([]); local = { datos: Object.fromEntries(TODAS.map(s => [s, []])), borrados: [] }; }
          }
          u = unir(local, remoto);
          cambios += await aplicar(local, u);
        } else if (f && !eraSucio) { await documentos(dir, await db.all('documentos')); break; }
        else u = unir(local, { datos: {}, borrados: [] });
        const txt = paraSubir(u);
        const remotoIgual = remotoTxt && (() => { const a = JSON.parse(remotoTxt), b = JSON.parse(txt); return JSON.stringify(a.datos) === JSON.stringify(b.datos) && JSON.stringify(a.borrados) === JSON.stringify(b.borrados); })();
        let nueva = f?.version;
        if (!remotoIgual) {
          // Justo antes de subir, comprueba que nadie haya subido nada mientras tanto
          if (f) { const ahora = await (await pedir(`${API}/files/${f.id}?fields=version`)).json(); if (String(ahora.version) !== String(f.version)) { if (eraSucio) ls.set(K.sucio, '1'); continue; } }
          const blob = new Blob([txt], { type: 'application/json' });
          const r = f ? await actualizar(f.id, blob, 'application/json') : await crear({ name: 'datos.json', parents: [dir], appProperties: { app: 'patrimonio', tipo: 'datos' } }, blob, 'application/json');
          ls.set(K.fid, r.id); nueva = r.version;
        }
        ls.set(K.rev, String(nueva));
        cambios += await documentos(dir, await db.all('documentos'));
        break;
      }
      ls.set(K.ult, new Date().toISOString());
      recalcular();
      if (cambios && alAplicar) alAplicar(cambios);
      return cambios;
    } catch (e) {
      ls.set(K.sucio, '1');
      if (e.login) poner('login'); else poner('error', e.message);
      throw e;
    }
  })().finally(() => { enCurso = null; if (sucio() && conectado() && tokenValido()) { clearTimeout(tempo); tempo = setTimeout(() => sincronizar().catch(() => {}), 4000); } });
  return enCurso;
}

export async function conectar(decidir) {
  await entrar(true);
  ls.set(K.con, '1'); ls.set(K.rev, null); ls.set(K.sucio, '1');
  return sincronizar({ decidir });
}
export async function sincronizarAhora(decidir) {
  if (!tokenValido()) await entrar(false);
  return sincronizar({ decidir });
}
export function desconectar() {
  const t = token();
  if (t && window.google?.accounts?.oauth2) try { window.google.accounts.oauth2.revoke(t, () => {}); } catch {}
  for (const k of Object.values(K)) if (k !== K.sucio) ls.set(k, null);
  poner('off');
}

// Sincroniza sola: al abrir, al volver a la aplicación y unos segundos después de cada cambio
let tempo = null;
export function iniciar() {
  recalcular();
  alCambiar(() => {
    if (!conectado()) return;
    if (st.estado !== 'sync') recalcular();
    clearTimeout(tempo); tempo = setTimeout(() => { if (tokenValido()) sincronizar().catch(() => {}); }, 6000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !conectado()) return;
    const u = ultimaSync();
    if (tokenValido() && (!u || Date.now() - new Date(u) > 60000)) sincronizar().catch(() => {}); else recalcular();
  });
  setInterval(() => { if (conectado() && st.estado !== 'sync') recalcular(); }, 60000);
  if (conectado() && tokenValido()) sincronizar().catch(() => {});
}
