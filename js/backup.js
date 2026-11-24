// Copias de seguridad completas (.zip) y exportación a CSV
import { db, STORES, getAjustes, setAjustes } from './db.js';
import { descargar, hoyISO, MESES } from './ui.js';

const FORMATO = 'patrimonio-copia';

export async function exportarZip() {
  if (!window.JSZip) throw new Error('No se ha cargado la librería de compresión');
  const zip = new window.JSZip();
  const datos = {};
  for (const s of STORES) {
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
  zip.file('datos.json', JSON.stringify({ formato: FORMATO, version: 1, exportado: new Date().toISOString(), datos }, null, 1));
  zip.file('LEEME.txt', 'Copia de seguridad de la app Patrimonio.\nPara restaurarla: Ajustes y copias > Importar / restaurar copia.\nNo modifiques el contenido de este archivo.');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  descargar(blob, `copia_patrimonio_${hoyISO()}.zip`);
  const aj = await getAjustes(); aj.ultimaCopia = new Date().toISOString(); await setAjustes(aj);
  return blob.size;
}

export async function leerZip(file) {
  const zip = await window.JSZip.loadAsync(file);
  const f = zip.file('datos.json');
  if (!f) throw new Error('El archivo no es una copia de Patrimonio');
  const json = JSON.parse(await f.async('string'));
  if (json.formato !== FORMATO) throw new Error('El archivo no es una copia de Patrimonio');
  return { zip, json };
}

export async function restaurar({ zip, json }) {
  const aj = await getAjustes();
  for (const s of STORES) await db.clear(s);
  for (const s of STORES) {
    for (const it of (json.datos[s] || [])) {
      if (s === 'documentos' && it.ruta) {
        const zf = zip.file(it.ruta);
        if (zf) { const ab = await zf.async('blob'); it.blob = new File([ab], it.archivo || it.nombre || 'archivo', { type: it.mime || 'application/octet-stream' }); }
        delete it.ruta;
      }
      await db.putRaw(s, it);
    }
  }
  const nuevo = await getAjustes(); nuevo.ultimaCopia = aj.ultimaCopia || nuevo.ultimaCopia; await setAjustes(nuevo);
}

const csvCell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dec = (n) => String(Number(n || 0).toFixed(2)).replace('.', ',');
function csv(rows) { return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'); }

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
