// Copias de seguridad completas (.zip) y exportación a CSV.
// Patrimonio y Admon. Fincas tienen copias independientes: la de uno no toca al otro.
import { db, STORES, STORES_FIN } from './db.js';
import { descargar, hoyISO, MESES } from './ui.js';

const MOD = {
  pat: { formato: 'patrimonio-copia', stores: STORES.filter(s => s !== 'ajustes'), ajustesId: 'app', archivo: 'copia_patrimonio', nombre: 'Patrimonio' },
  fin: { formato: 'fincas-copia', stores: STORES_FIN, ajustesId: 'fincas', archivo: 'copia_fincas', nombre: 'Admon. Fincas' },
};
const COMPLETA = 'gestion-copia';
export const NOMBRE = { pat: 'Patrimonio', fin: 'Admon. Fincas' };

// partes: ['pat','fin'] = copia completa (recomendada); ['pat'] o ['fin'] = solo una parte
export async function exportarZip(partes = ['pat', 'fin']) {
  if (!window.JSZip) throw new Error('No se ha cargado la librería de compresión');
  if (typeof partes === 'string') partes = [partes];
  const zip = new window.JSZip();
  const datos = { ajustes: [] };
  for (const k of partes) {
    for (const s of MOD[k].stores) {
      const items = await db.all(s);
      if (s === 'documentos') {
        datos[s] = [];
        for (const d of items) {
          const { blob, ...meta } = d;
          if (blob) { meta.ruta = `documentos/${d.id}`; zip.file(meta.ruta, blob); }
          datos[s].push(meta);
        }
      } else datos[s] = items;
    }
    datos.ajustes.push((await db.get('ajustes', MOD[k].ajustesId)) || { id: MOD[k].ajustesId });
  }
  const completa = partes.length > 1;
  const nombre = completa ? 'Patrimonio y Admon. Fincas' : MOD[partes[0]].nombre;
  zip.file('datos.json', JSON.stringify({ formato: completa ? COMPLETA : MOD[partes[0]].formato, version: 2, partes, exportado: new Date().toISOString(), datos }, null, 1));
  zip.file('LEEME.txt', `Copia de seguridad de ${nombre}.\nPara restaurarla: Ajustes y copias > Importar / restaurar copia (desde Patrimonio o desde Admon. Fincas).\nNo modifiques el contenido de este archivo.`);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  descargar(blob, `${completa ? 'copia_completa' : MOD[partes[0]].archivo}_${hoyISO()}.zip`);
  const ahora = new Date().toISOString();
  for (const k of partes) { const aj = (await db.get('ajustes', MOD[k].ajustesId)) || { id: MOD[k].ajustesId }; aj.ultimaCopia = ahora; await db.put('ajustes', aj); }
  return blob.size;
}

// Lee cualquier copia (completa o de una sola parte) y dice qué partes contiene
export async function leerZip(file) {
  let zip;
  try { zip = await window.JSZip.loadAsync(file); } catch { throw new Error('El archivo no es una copia de seguridad (.zip)'); }
  const f = zip.file('datos.json');
  if (!f) throw new Error('El archivo no es una copia de seguridad de esta aplicación');
  const json = JSON.parse(await f.async('string'));
  let partes;
  if (json.formato === COMPLETA) partes = json.partes || ['pat', 'fin'];
  else { const k = Object.keys(MOD).find(x => MOD[x].formato === json.formato); if (!k) throw new Error('El archivo no es una copia de seguridad de esta aplicación'); partes = [k]; }
  const n = json.datos;
  const resumen = {
    pat: `${(n.propiedades || []).length} ${(n.propiedades || []).length === 1 ? 'propiedad' : 'propiedades'}, ${(n.pagos || []).length} cobros, ${(n.gastos || []).length} gastos y ${(n.documentos || []).length} documentos`,
    fin: `${(n.f_comunidades || []).length} ${(n.f_comunidades || []).length === 1 ? 'comunidad' : 'comunidades'}, ${(n.f_vecinos || []).length} vecinos y ${(n.f_cobros || []).length} cobros`,
  };
  return { zip, json, partes, resumen };
}

// Sustituye en este dispositivo solo las partes indicadas
export async function restaurar({ zip, json }, partes) {
  if (typeof partes === 'string') partes = [partes];
  for (const k of partes) {
    const M = MOD[k];
    const previo = (await db.get('ajustes', M.ajustesId)) || {};
    for (const s of M.stores) await db.clear(s);
    for (const s of M.stores) {
      for (const it of (json.datos[s] || [])) {
        if (s === 'documentos' && it.ruta) {
          const zf = zip.file(it.ruta);
          if (zf) { const ab = await zf.async('blob'); it.blob = new File([ab], it.archivo || it.nombre || 'archivo', { type: it.mime || 'application/octet-stream' }); }
          delete it.ruta;
        }
        await db.putRaw(s, it);
      }
    }
    const aj = (json.datos.ajustes || []).find(a => a.id === M.ajustesId);
    if (aj) { aj.ultimaCopia = previo.ultimaCopia || aj.ultimaCopia; await db.putRaw('ajustes', aj); }
  }
}

const csvCell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dec = (n) => String(Number(n || 0).toFixed(2)).replace('.', ',');
export function csv(rows) { return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'); }
export { dec };

export async function exportarCSV(tipo) {
  const [props, inqs, contratos, pagos, gastos] = await Promise.all(['propiedades', 'inquilinos', 'contratos', 'pagos', 'gastos'].map(s => db.all(s)));
  const dir = (id) => props.find(p => p.id === id)?.direccion || '';
  let rows;
  if (tipo === 'pagos') {
    rows = [['Fecha cobro', 'Propiedad', 'Inquilino', 'Año', 'Mes', 'Concepto', 'Importe', 'Forma de pago', 'Nota']];
    pagos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach(p => { const c = contratos.find(k => k.id === p.contratoId); const i = inqs.find(x => x.id === c?.inquilinoId);
      rows.push([p.fecha, dir(p.propiedadId), i?.nombre || '', p.anio, MESES[p.mes - 1], p.concepto, dec(p.importe), p.forma, p.nota]); });
  } else if (tipo === 'gastos') {
    rows = [['Fecha', 'Propiedad', 'Categoría', 'Concepto', 'Proveedor', 'Importe', 'Estado', 'Repercutible']];
    gastos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach(g => rows.push([g.fecha, dir(g.propiedadId), g.categoria, g.concepto, g.proveedor, dec(g.importe), g.estado, g.repercutible ? 'Sí' : 'No']));
  } else {
    rows = [['Dirección', 'Zona', 'Tipo', 'm²', 'Ref. catastral', 'Fecha compra', 'Precio compra', 'Inquilino actual', 'Renta', 'Fin contrato']];
    props.forEach(p => { const c = contratos.find(k => k.propiedadId === p.id && k.estado !== 'finalizado'); const i = inqs.find(x => x.id === c?.inquilinoId);
      rows.push([p.direccion, p.zona, p.tipo, p.m2, p.refCatastral, p.fechaCompra, dec(p.precioCompra), i?.nombre || '', c ? dec(c.renta) : '', c?.fin || '']); });
  }
  descargar(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), `${tipo}_${hoyISO()}.csv`);
}
