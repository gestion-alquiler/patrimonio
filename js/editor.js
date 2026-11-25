// Editor de texto sencillo (negrita, cursiva, subrayado, listas) con botón para insertar {marcas}.
import { esc } from './ui.js';
import { limpiarHtml } from './plantillas.js';

export function editorHtml(nombre, html, { marcas = [], alto = 160, etiqueta = '' } = {}) {
  return `<div class="editor" data-ed="${esc(nombre)}">
    ${etiqueta ? `<div class="small b" style="margin-bottom:4px">${esc(etiqueta)}</div>` : ''}
    <div class="ed-bar" role="toolbar" aria-label="Formato">
      <button type="button" data-cmd="bold" title="Negrita"><b>N</b></button><button type="button" data-cmd="italic" title="Cursiva"><i>K</i></button><button type="button" data-cmd="underline" title="Subrayado"><u>S</u></button>
      <button type="button" data-cmd="insertUnorderedList" title="Lista">• Lista</button><button type="button" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>
      ${marcas.length ? `<select data-marca aria-label="Insertar dato"><option value="">Insertar dato…</option>${marcas.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select>` : ''}
    </div>
    <div class="ed-area" contenteditable="true" spellcheck="true" style="min-height:${alto}px">${html || ''}</div>
  </div>`;
}

export function enlazarEditores(root) {
  root.querySelectorAll('.editor').forEach(ed => {
    const area = ed.querySelector('.ed-area');
    let rango = null;
    const guardar = () => { const s = window.getSelection(); if (s.rangeCount && area.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange(); };
    ['keyup', 'mouseup', 'input', 'focus'].forEach(ev => area.addEventListener(ev, guardar));
    const restaurar = () => { area.focus(); if (rango) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(rango); } };
    ed.querySelectorAll('[data-cmd]').forEach(b => {
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { restaurar(); document.execCommand(b.dataset.cmd); guardar(); area.dispatchEvent(new Event('input', { bubbles: true })); });
    });
    const sel = ed.querySelector('[data-marca]');
    if (sel) sel.addEventListener('change', () => { if (!sel.value) return; restaurar(); document.execCommand('insertText', false, `{${sel.value}}`); sel.value = ''; guardar(); area.dispatchEvent(new Event('input', { bubbles: true })); });
    // Pegar siempre como texto, para no arrastrar formatos raros de Word o del correo
    area.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
  });
}

export const leerEditor = (root, nombre) => limpiarHtml(root.querySelector(`.editor[data-ed="${nombre}"] .ed-area`)?.innerHTML || '');
export const ponerEditor = (root, nombre, html) => { const a = root.querySelector(`.editor[data-ed="${nombre}"] .ed-area`); if (a) a.innerHTML = html || ''; };
