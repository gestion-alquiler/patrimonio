// Base de datos local (IndexedDB). Todo se guarda en el navegador del dispositivo.
const DB_NAME = 'patrimonio';
const DB_VERSION = 6;
export const STORES = ['propiedades', 'inquilinos', 'contratos', 'pagos', 'gastos', 'documentos', 'notas', 'cartas', 'banco', 'ajustes'];
// Admon. Fincas
export const STORES_FIN = ['f_comunidades', 'f_vecinos', 'f_cobros', 'f_gastos', 'f_derramas', 'f_proveedores', 'f_juntas', 'f_cartas', 'f_banco'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES.concat(STORES_FIN)) {
        if (!db.objectStoreNames.contains(s)) {
          const os = db.createObjectStore(s, { keyPath: 'id' });
          if (['contratos', 'pagos', 'gastos', 'documentos', 'notas', 'cartas'].includes(s)) os.createIndex('propiedadId', 'propiedadId');
          if (s === 'pagos') os.createIndex('contratoId', 'contratoId');
          if (['f_vecinos', 'f_cobros', 'f_gastos', 'f_derramas', 'f_juntas', 'f_cartas', 'f_banco'].includes(s)) os.createIndex('comunidadId', 'comunidadId');
        }
      }
    };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); location.reload(); }; resolve(db); };
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let out;
    Promise.resolve(fn(os)).then(r => { out = r; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Registro de cambios para la sincronización con Google Drive: qué se ha tocado y qué se ha borrado
const LS_SUCIO = 'sync.sucio', LS_BORR = 'sync.borrados';
const oyentes = [];
export const alCambiar = (fn) => oyentes.push(fn);
function cambio() { try { localStorage.setItem(LS_SUCIO, '1'); } catch {} oyentes.forEach(f => { try { f(); } catch {} }); }
export function leerBorrados() { try { return JSON.parse(localStorage.getItem(LS_BORR) || '[]'); } catch { return []; } }
export function guardarBorrados(l) { try { localStorage.setItem(LS_BORR, JSON.stringify(l)); } catch {} }
function anotarBorrado(store, ids) {
  if (!ids.length) return; const f = new Date().toISOString(), set = new Set(ids.map(String));
  guardarBorrados(leerBorrados().filter(b => !(b.s === store && set.has(String(b.id)))).concat(ids.map(id => ({ s: store, id, f }))));
}
function quitarBorrado(store, id) { const l = leerBorrados(); const n = l.filter(b => !(b.s === store && b.id === id)); if (n.length !== l.length) guardarBorrados(n); }

export const db = {
  all: (store) => tx(store, 'readonly', os => wrap(os.getAll())),
  get: (store, id) => tx(store, 'readonly', os => wrap(os.get(id))),
  by: (store, index, value) => tx(store, 'readonly', os => wrap(os.index(index).getAll(value))),
  put: (store, obj) => {
    if (!obj.id) obj.id = uid();
    obj.modificado = new Date().toISOString();
    return tx(store, 'readwrite', os => wrap(os.put(obj))).then(() => { quitarBorrado(store, obj.id); cambio(); return obj; });
  },
  del: (store, id) => tx(store, 'readwrite', os => wrap(os.delete(id))).then(r => { anotarBorrado(store, [id]); cambio(); return r; }),
  clear: async (store) => { const ids = await tx(store, 'readonly', os => wrap(os.getAllKeys())); const r = await tx(store, 'readwrite', os => wrap(os.clear())); anotarBorrado(store, ids); cambio(); return r; },
  putRaw: (store, obj) => tx(store, 'readwrite', os => wrap(os.put(obj))).then(r => { quitarBorrado(store, obj.id); cambio(); return r; }),
  // Solo para la sincronización: escribe sin marcar cambios
  _poner: (store, obj) => tx(store, 'readwrite', os => wrap(os.put(obj))),
  _quitar: (store, id) => tx(store, 'readwrite', os => wrap(os.delete(id))),
  _vaciar: (store) => tx(store, 'readwrite', os => wrap(os.clear())),
};

export async function getAjustes() {
  return (await db.get('ajustes', 'app')) || { id: 'app', recordatorioDias: 15, ultimaCopia: null, idioma: 'es', propietario: {} };
}
export async function setAjustes(a) { a.id = 'app'; return db.put('ajustes', a); }

// Borra una propiedad con todo lo que cuelga de ella
export async function borrarPropiedad(id) {
  for (const s of ['contratos', 'pagos', 'gastos', 'documentos', 'notas', 'cartas']) {
    const items = await db.by(s, 'propiedadId', id);
    for (const it of items) await db.del(s, it.id);
  }
  await db.del('propiedades', id);
}

export async function getAjustesFincas() {
  return (await db.get('ajustes', 'fincas')) || { id: 'fincas', recordatorioDias: 15, ultimaCopia: null, idioma: 'ca', admin: {} };
}
export async function setAjustesFincas(a) { a.id = 'fincas'; return db.put('ajustes', a); }

export async function borrarComunidad(id) {
  for (const s of ['f_vecinos', 'f_cobros', 'f_gastos', 'f_derramas', 'f_juntas', 'f_cartas', 'f_banco']) {
    const items = await db.by(s, 'comunidadId', id);
    for (const it of items) await db.del(s, it.id);
  }
  await db.del('f_comunidades', id);
}
