// Etiquetas para sobres en hojas A4 (formatos habituales de Apli / Avery).
import { esc, modal, fd, toast } from './ui.js';

export const FORMATOS = {
  '3x8': { nombre: '24 por hoja · 70 × 37 mm (Apli 1273, Avery 3474)', cols: 3, filas: 8, w: 70, h: 37, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  '3x7': { nombre: '21 por hoja · 63,5 × 38,1 mm (Avery L7160, Apli 1263)', cols: 3, filas: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.2, gapX: 2.5, gapY: 0 },
  '2x7': { nombre: '14 por hoja · 99,1 × 38,1 mm (Avery L7163, Apli 1265)', cols: 2, filas: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0 },
  '2x8': { nombre: '16 por hoja · 105 × 37 mm (Apli 1274)', cols: 2, filas: 8, w: 105, h: 37, top: 0.5, left: 0, gapX: 0, gapY: 0 },
};

function abrir(titulo, etiquetas, f, saltar) {
  const porHoja = f.cols * f.filas;
  const todas = [...Array(saltar).fill(null), ...etiquetas];
  const hojas = [];
  for (let i = 0; i < todas.length; i += porHoja) hojas.push(todas.slice(i, i + porHoja));
  const celda = (e) => `<div class="et">${e ? e.lineas.map((l, i) => `<div${i === 0 ? ' class="n"' : ''}>${esc(l)}</div>`).join('') : ''}</div>`;
  const css = `@page { size: A4; margin: 0; } * { box-sizing: border-box; } body { margin: 0; background: #e9ecf1; font: 10pt/1.3 Arial, Helvetica, sans-serif; color: #111; }
    .hoja { width: 210mm; height: 297mm; background: #fff; margin: 12px auto; padding: ${f.top}mm 0 0 ${f.left}mm; display: grid; grid-template-columns: repeat(${f.cols}, ${f.w}mm); grid-auto-rows: ${f.h}mm; column-gap: ${f.gapX}mm; row-gap: ${f.gapY}mm; page-break-after: always; break-after: page; overflow: hidden; }
    .hoja:last-child { page-break-after: auto; break-after: auto; }
    .et { padding: 4mm 5mm; display: flex; flex-direction: column; justify-content: center; overflow: hidden; outline: 1px dashed #d5dae2; } .et .n { font-weight: 700; }
    .et div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .barra { position: sticky; top: 0; background: #14233A; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font: 14px system-ui, sans-serif; z-index: 2; }
    .barra button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 0; background: #fff; color: #14233A; font-weight: 600; cursor: pointer; }
    @media print { body { background: #fff; } .hoja { margin: 0; } .et { outline: 0; } .barra { display: none; } }`;
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${css}</style></head><body>
    <div class="barra"><b>${esc(titulo)} · ${etiquetas.length} etiquetas en ${hojas.length} ${hojas.length === 1 ? 'hoja' : 'hojas'}</b><span style="flex:1;opacity:.8;font-size:12.5px">Al imprimir, elige tamaño A4, escala 100 % (sin «Ajustar a la página») y sin márgenes.</span><button onclick="window.print()">Imprimir</button></div>
    ${hojas.map(h => `<section class="hoja">${h.map(celda).join('')}</section>`).join('')}</body></html>`);
  w.document.close();
  return true;
}

// grupos: [[etiqueta del grupo, [{ lineas: [...] }]]]
export function dialogoEtiquetas(titulo, grupos, { ultimoFormato = '3x8', alGuardarFormato } = {}) {
  modal({ title: 'Etiquetas para sobres', submit: 'Ver etiquetas',
    body: `<div class="fgrid">
      <label class="field span2">Hoja de etiquetas<select name="formato">${Object.entries(FORMATOS).map(([k, f]) => `<option value="${k}" ${k === ultimoFormato ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select></label>
      <label class="field span2">Para quién<select name="grupo">${grupos.map(([l, items], i) => `<option value="${i}">${esc(l)} (${items.length})</option>`).join('')}</select></label>
      <label class="field">Empezar en la etiqueta nº<input name="inicio" type="number" min="1" value="1" inputmode="numeric"><span class="hint">Para aprovechar una hoja ya empezada</span></label></div>`,
    onSubmit: async (f) => {
      const x = fd(f); const items = grupos[Number(x.grupo)][1];
      if (!items.length) { toast('No hay nadie en ese grupo'); return false; }
      const fm = FORMATOS[x.formato]; const saltar = Math.max(0, Math.min(fm.cols * fm.filas - 1, (Number(x.inicio) || 1) - 1));
      if (!abrir(titulo, items, fm, saltar)) { toast('Permite las ventanas emergentes para esta página'); return false; }
      alGuardarFormato && alGuardarFormato(x.formato);
    } });
}
