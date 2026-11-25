// Ajustes → Plantillas: textos de las convocatorias (Admon. Fincas) y modelos de carta (las dos partes).
import { getAjustes, setAjustes, getAjustesFincas, setAjustesFincas } from '../db.js';
import { esc, modal, confirmar, toast, field, fd } from '../ui.js';
import { CONV, CARTAS_BASE, MARCAS, modelosCarta, htmlATexto } from '../plantillas.js';
import { editorHtml, enlazarEditores, leerEditor } from '../editor.js';

const getAj = (mod) => (mod === 'pat' ? getAjustes() : getAjustesFincas());
const setAj = (mod, aj) => (mod === 'pat' ? setAjustes(aj) : setAjustesFincas(aj));
const corto = (h, n = 140) => { const t = htmlATexto(h); return t.length > n ? t.slice(0, n) + '…' : t; };

export function vista(mod) {
  return {
    async render(_, d) {
      const aj = d.aj, conv = aj.plantillas?.conv || {};
      const modelos = modelosCarta(mod, aj);
      const nBorr = (aj.cartasBorradas || []).length;
      return `<div class="page">
      <div class="head"><div><div class="small b" style="color:var(--accent);letter-spacing:.06em;text-transform:uppercase">${mod === 'pat' ? 'Patrimonio' : 'Admon. Fincas'}</div><h1>Plantillas de textos</h1>
        <div class="sub">Cambia los textos de tus documentos. Los datos entre llaves, como {${mod === 'pat' ? 'inquilino' : 'propietario'}}, se rellenan solos en cada carta.</div></div></div>
      <section class="card"><div class="cardhead"><div><h2>Modelos de carta</h2><div class="small muted">Aparecen en «Partir de un modelo» al escribir una carta.</div></div><div class="actions">${nBorr ? '<button class="btn sm" data-p="recuperar">Recuperar modelos de serie</button>' : ''}<button class="btn primary sm" data-p="nuevo">+ Nuevo modelo</button></div></div>
        <div class="tw"><table><thead><tr><th>Modelo</th><th>Texto</th><th></th></tr></thead><tbody>
        ${modelos.map(m => { const base = CARTAS_BASE[mod].find(b => b.id === m.id); const mod2 = base && (aj.cartasPlantillas || []).some(o => o.id === m.id);
          return `<tr><td class="b">${esc(m.nombre)}<div>${base ? `<span class="badge ${mod2 ? 'warn' : 'neutral'}">${mod2 ? 'De serie · modificado' : 'De serie'}</span>` : '<span class="badge info">Propio</span>'}</div></td><td class="small muted">${esc(corto(m.cuerpo?.es || m.cuerpo?.ca))}</td>
          <td class="nw"><button class="btn sm" data-pe="${esc(m.id)}">Editar</button> <button class="btn sm" data-pd="${esc(m.id)}">Duplicar</button> <button class="btn sm danger" data-pb="${esc(m.id)}">Quitar</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="muted">No hay modelos.</td></tr>'}
        </tbody></table></div></section>
      ${mod === 'fin' ? `<section class="card"><div class="cardhead"><div><h2>Textos de las convocatorias</h2><div class="small muted">Cada párrafo de la convocatoria de junta, en castellano y català. El orden del día se escribe en cada junta.</div></div></div>
        <div class="tw"><table><thead><tr><th>Párrafo</th><th>Texto actual (castellano)</th><th></th></tr></thead><tbody>
        ${CONV.map(x => { const cambiado = conv[x.k] && (conv[x.k].es || conv[x.k].ca); return `<tr><td class="b">${esc(x.nombre)}${cambiado ? '<div><span class="badge warn">Modificado</span></div>' : ''}</td><td class="small muted">${esc(corto((conv[x.k]?.es) || x.es, 160))}</td><td><button class="btn sm" data-ce="${x.k}">Editar</button></td></tr>`; }).join('')}
        </tbody></table></div></section>` : ''}
      </div>`;
    },
    bind(el, _, d, refresh) {
      const on = (s, fn) => el.querySelectorAll(s).forEach(b => b.addEventListener('click', () => fn(b)));
      const modelos = modelosCarta(mod, d.aj);
      const dlg = () => document.querySelector('#modal-root .dialog');
      const editarModelo = (m, copia = false) => {
        const base = !copia && m && CARTAS_BASE[mod].find(b => b.id === m.id);
        const v = m || { nombre: '', asunto: { es: '', ca: '' }, cuerpo: { es: '', ca: '' } };
        modal({ title: copia ? 'Copia del modelo' : m ? 'Editar modelo' : 'Nuevo modelo', submit: 'Guardar modelo', wide: true, extra: base ? '<button type="button" class="btn" data-restaurar>Restaurar el texto original</button>' : '',
          body: `${field('Nombre del modelo', 'nombre', copia ? v.nombre + ' (copia)' : v.nombre, { required: true })}
            <div class="fgrid">${field('Asunto (castellano)', 'asunto_es', v.asunto?.es)}${field('Asunto (català)', 'asunto_ca', v.asunto?.ca)}</div>
            ${editorHtml('es', v.cuerpo?.es, { marcas: MARCAS[mod], alto: 180, etiqueta: 'Castellano' })}${editorHtml('ca', v.cuerpo?.ca, { marcas: MARCAS[mod], alto: 180, etiqueta: 'Català' })}`,
          onSubmit: async (f) => {
            const x = fd(f); if (!x.nombre.trim()) { toast('Falta el nombre'); return false; }
            const obj = { id: copia || !m ? 'u-' + Date.now().toString(36) : m.id, nombre: x.nombre.trim(), asunto: { es: x.asunto_es, ca: x.asunto_ca }, cuerpo: { es: leerEditor(dlg(), 'es'), ca: leerEditor(dlg(), 'ca') } };
            const aj = await getAj(mod); aj.cartasPlantillas = [...(aj.cartasPlantillas || []).filter(o => o.id !== obj.id), obj]; await setAj(mod, aj); toast('Modelo guardado'); refresh();
          } });
        enlazarEditores(dlg());
        const r = dlg().querySelector('[data-restaurar]');
        if (r) r.onclick = async () => { if (!(await confirmar('Restaurar el texto original', 'Se perderán los cambios que hiciste en este modelo.', 'Restaurar'))) return;
          const aj = await getAj(mod); aj.cartasPlantillas = (aj.cartasPlantillas || []).filter(o => o.id !== m.id); await setAj(mod, aj); toast('Modelo restaurado'); refresh(); };
      };
      on('[data-p=nuevo]', () => editarModelo(null));
      on('[data-pe]', (b) => editarModelo(modelos.find(m => m.id === b.dataset.pe)));
      on('[data-pd]', (b) => editarModelo(modelos.find(m => m.id === b.dataset.pd), true));
      on('[data-pb]', async (b) => { const m = modelos.find(x => x.id === b.dataset.pb); const base = CARTAS_BASE[mod].some(x => x.id === m.id);
        if (!(await confirmar('Quitar modelo', base ? `Se quitará «${esc(m.nombre)}» de la lista. Podrás recuperarlo con «Recuperar modelos de serie».` : `Se borrará el modelo «${esc(m.nombre)}». Las cartas ya escritas no cambian.`, 'Quitar'))) return;
        const aj = await getAj(mod); aj.cartasPlantillas = (aj.cartasPlantillas || []).filter(o => o.id !== m.id); if (base) aj.cartasBorradas = [...new Set([...(aj.cartasBorradas || []), m.id])]; await setAj(mod, aj); toast('Modelo quitado'); refresh(); });
      on('[data-p=recuperar]', async () => { const aj = await getAj(mod); aj.cartasBorradas = []; await setAj(mod, aj); toast('Modelos de serie recuperados'); refresh(); });
      on('[data-ce]', (b) => {
        const x = CONV.find(q => q.k === b.dataset.ce), own = d.aj.plantillas?.conv?.[x.k] || {};
        modal({ title: x.nombre, submit: 'Guardar texto', wide: true, extra: '<button type="button" class="btn" data-restaurar>Restaurar el texto original</button>',
          body: `${editorHtml('es', own.es || x.es, { marcas: MARCAS.convocatoria, alto: 110, etiqueta: 'Castellano' })}${editorHtml('ca', own.ca || x.ca, { marcas: MARCAS.convocatoria, alto: 110, etiqueta: 'Català' })}
            <div class="small muted">Puedes usar negrita y los datos de la lista «Insertar dato». Si dejas un idioma vacío, se usa el texto original.</div>`,
          onSubmit: async () => { const es = leerEditor(dlg(), 'es'), ca = leerEditor(dlg(), 'ca');
            const aj = await getAjustesFincas(); aj.plantillas = aj.plantillas || {}; aj.plantillas.conv = { ...(aj.plantillas.conv || {}), [x.k]: { es: es === x.es ? '' : es, ca: ca === x.ca ? '' : ca } };
            await setAjustesFincas(aj); toast('Texto guardado'); refresh(); } });
        enlazarEditores(dlg());
        dlg().querySelector('[data-restaurar]').onclick = async () => { const aj = await getAjustesFincas(); if (aj.plantillas?.conv) delete aj.plantillas.conv[x.k]; await setAjustesFincas(aj); document.getElementById('modal-root').innerHTML = ''; toast('Texto original restaurado'); refresh(); };
      });
    },
  };
}
