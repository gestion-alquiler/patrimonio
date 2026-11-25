// Ventana de impresión común (convocatorias, cartas, comunicados…). Se puede retocar el texto antes de imprimir.
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
@page { size: A4; margin: 13mm 17mm; }
* { box-sizing: border-box; }
body { font: 10pt/1.4 "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; background: #e9ecf1; }
.hoja { background: #fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm 18mm; page-break-after: always; break-after: page; position: relative; }
.hoja:last-child { page-break-after: auto; break-after: auto; }
.cab { display: flex; justify-content: space-between; gap: 20px; border-bottom: 1.5px solid #2C5585; padding-bottom: 8px; font-size: 9pt; color: #2C5585; }
.cab .com b { font-size: 12pt; color: #14233A; } .cab .dat { text-align: right; color: #555; }
.dest { margin: 6mm 0 2mm auto; width: 85mm; min-height: 17mm; font-size: 10pt; }
.lugar { text-align: right; margin: 3mm 0 2mm; }
h1 { font-size: 13pt; text-transform: uppercase; letter-spacing: .02em; color: #14233A; margin: 3mm 0; }
h2 { font-size: 10.5pt; text-transform: uppercase; margin: 3mm 0 1mm; color: #14233A; }
h3 { font-size: 10.5pt; text-transform: uppercase; margin: 2mm 0; }
.odd { margin: 0 0 4mm; padding-left: 7mm; } .odd li { margin: 1mm 0; }
.peq { font-size: 8.5pt; color: #333; margin: 1.5mm 0; }
.aviso { border: 1px solid #c9a227; background: #fff8e1; padding: 2mm 3mm; font-size: 9pt; margin: 2mm 0; }
.firmas { display: flex; justify-content: space-between; gap: 20mm; margin-top: 5mm; font-size: 9pt; } .firmas > div { flex: 1; } .esp { height: 10mm; }
.deleg { margin-top: 3mm; font-size: 9pt; break-inside: avoid; } .deleg .esp { height: 6mm; } .deleg h3 { margin: 1mm 0; } .deleg p { margin: 1.5mm 0; } .tijera { color: #888; font-size: 8pt; overflow: hidden; white-space: nowrap; margin-bottom: 2mm; }
.barra { position: sticky; top: 0; background: #14233A; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font: 14px system-ui, sans-serif; z-index: 2; }
.carta .cuerpo p { margin: 0 0 3mm; } .carta .cuerpo ul, .carta .cuerpo ol { margin: 0 0 3mm; padding-left: 7mm; } .asunto { margin: 4mm 0; }
.carta .cab { border-color: var(--c); color: var(--c); }
[contenteditable]:focus { outline: 2px dashed #9db4d6; outline-offset: 4px; }
.barra button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 0; background: #fff; color: #14233A; font-weight: 600; cursor: pointer; }
@media print { body { background: #fff; } .hoja { margin: 0; width: auto; min-height: 0; padding: 0; } .barra { display: none; } }
`;

// Abre una ventana con las páginas y el botón de imprimir / guardar como PDF
export function abrirImpresion(titulo, paginas) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${e(titulo)}</title><style>${CSS}</style></head><body>
    <div class="barra"><b>${e(titulo)} · ${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}</b><span style="flex:1;opacity:.8;font-size:12.5px">Puedes hacer clic en cualquier texto para retocarlo solo en este documento.</span><button onclick="window.print()">Imprimir o guardar como PDF</button></div>
    ${paginas.map(p => p.replace('<section class="hoja"', '<section class="hoja" contenteditable="true" spellcheck="true"')).join('')}</body></html>`);
  w.document.close();
  return true;
}


// Una carta: cabecera del remitente, destinatario para sobre con ventana, lugar y fecha, asunto, cuerpo y firma
export function paginaCarta({ cabIzq, cabDer, destinatario, lugarFecha, asunto, cuerpo, firma, color = '#2C5585' }) {
  return `<section class="hoja carta" style="--c:${color}">
    <header class="cab"><div class="com">${cabIzq}</div><div class="dat">${cabDer || ''}</div></header>
    ${destinatario ? `<div class="dest">${destinatario}</div>` : ''}
    <p class="lugar">${e(lugarFecha)}</p>
    ${asunto ? `<p class="asunto"><b>${e(asunto)}</b></p>` : ''}
    <div class="cuerpo">${cuerpo}</div>
    <div class="firmas"><div>${firma || ''}</div><div></div></div>
  </section>`;
}
