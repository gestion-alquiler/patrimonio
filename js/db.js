// Base de datos local (IndexedDB). Todo se guarda en el navegador del dispositivo.
const DB_NAME = 'patrimonio';
const DB_VERSION = 1;
export const STORES = ['propiedades', 'inquilinos', 'contratos', 'pagos', 'gastos', 'documentos', 'notas', 'ajustes'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          const os = db.createObjectStore(s, { keyPath: 'id' });
          if (['contratos', 'pagos', 'gastos', 'documentos', 'notas'].includes(s)) os.createIndex('propiedadId', 'propiedadId');
          if (s === 'pagos') os.createIndex('contratoId', 'contratoId');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
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

export const db = {
  all: (store) => tx(store, 'readonly', os => wrap(os.getAll())),
  get: (store, id) => tx(store, 'readonly', os => wrap(os.get(id))),
  by: (store, index, value) => tx(store, 'readonly', os => wrap(os.index(index).getAll(value))),
  put: (store, obj) => {
    if (!obj.id) obj.id = uid();
    obj.modificado = new Date().toISOString();
    return tx(store, 'readwrite', os => wrap(os.put(obj))).then(() => obj);
  },
  del: (store, id) => tx(store, 'readwrite', os => wrap(os.delete(id))),
  clear: (store) => tx(store, 'readwrite', os => wrap(os.clear())),
  putRaw: (store, obj) => tx(store, 'readwrite', os => wrap(os.put(obj))),
};

export async function getAjustes() {
  return (await db.get('ajustes', 'app')) || { id: 'app', recordatorioDias: 15, ultimaCopia: null, idioma: 'es', propietario: {} };
}
export async function setAjustes(a) { a.id = 'app'; return db.put('ajustes', a); }

// Borra una propiedad con todo lo que cuelga de ella
export async function borrarPropiedad(id) {
  for (const s of ['contratos', 'pagos', 'gastos', 'documentos', 'notas']) {
    const items = await db.by(s, 'propiedadId', id);
    for (const it of items) await db.del(s, it.id);
  }
  await db.del('propiedades', id);
}
