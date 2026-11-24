// Archivos: reduce fotos a 1600 px y guarda documentos en la base de datos local
import { db } from './db.js';
import { hoyISO } from './ui.js';

const MAX = 1600;

export async function reducirImagen(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 600 * 1024) return file;
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}

export async function guardarArchivo(file, meta) {
  const f = await reducirImagen(file);
  const doc = {
    propiedadId: meta.propiedadId, contratoId: meta.contratoId || null, tipo: meta.tipo || (f.type.startsWith('image/') ? 'foto' : 'otro'),
    nombre: meta.nombre || f.name, archivo: f.name, mime: f.type || 'application/octet-stream', size: f.size, fecha: hoyISO(), blob: f,
  };
  return db.put('documentos', doc);
}

export function elegirArchivos({ accept = 'image/*,application/pdf', multiple = true, capture = false } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
    if (capture) inp.setAttribute('capture', 'environment');
    inp.onchange = () => resolve([...inp.files]);
    inp.click();
  });
}

export function abrirDoc(doc) {
  const url = URL.createObjectURL(doc.blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
