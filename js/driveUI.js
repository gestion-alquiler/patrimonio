// Pantallas y avisos de la sincronización con Google Drive
import { esc, fecha, toast, modal, fd, hoyISO } from './ui.js';
import * as drive from './drive.js';

const cuando = (iso) => { if (!iso) return 'nunca'; const d = new Date(iso); const h = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); return iso.slice(0, 10) === hoyISO() ? 'hoy a las ' + h : fecha(iso) + ' a las ' + h; };
const TXT = {
  off: ['Sin conectar', ''], login: ['Pulsa para sincronizar', 'warn'], sync: ['Sincronizando…', ''], ok: ['Sincronizado', 'ok'], pend: ['Cambios por subir', 'warn'], error: ['No se ha podido sincronizar', 'warn'],
};

// Primera vez en un dispositivo que ya tiene datos, con Drive también lleno
export function decidir() {
  return new Promise((resolve) => {
    let hecho = false;
    const op = (v, t, d, c) => `<label class="alert" style="cursor:pointer"><input type="radio" name="que" value="${v}" ${c ? 'checked' : ''} style="margin-top:4px"><span><b>${t}</b><br><span class="small muted">${d}</span></span></label>`;
    const m = modal({ title: 'Drive ya tiene datos', submit: 'Continuar',
      body: `<p style="margin:0">Tanto este dispositivo como Google Drive tienen datos. ¿Qué quieres hacer?</p>
        ${op('drive', 'Usar los datos de Drive', 'Se sustituye lo que hay en este dispositivo por lo que hay en Drive. Es lo normal en un móvil o un ordenador nuevo.', true)}
        ${op('unir', 'Unir las dos cosas', 'Se suma lo de este dispositivo a lo de Drive. Si has creado lo mismo en los dos sitios, saldrá repetido.')}`,
      onSubmit: (form) => { hecho = true; resolve(fd(form).que); } });
    m.form.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { if (!hecho) resolve(null); }));
  });
}

async function accion(fn, btn) {
  const t = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = 'Conectando…'; }
  try { const n = await fn(); toast(n ? `Sincronizado: ${n} ${n === 1 ? 'cambio recibido' : 'cambios recibidos'}` : 'Sincronizado con Google Drive'); return true; }
  catch (e) { toast(e.message || 'No se ha podido sincronizar'); return false; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = t; } }
}
export const sincronizarAhora = (btn) => accion(() => drive.sincronizarAhora(decidir), btn);

// Tarjeta en Ajustes (ordenador y móvil)
export function htmlDrive() {
  const e = drive.estado(), [txt, cls] = TXT[e.estado];
  if (!drive.conectado()) return `<section class="card pad stack grow1"><h2>Google Drive</h2>
    <div>Guarda los datos en tu Google Drive para tener <b>lo mismo en el ordenador y en el móvil</b>. Cada cambio se sube solo al cabo de unos segundos.</div>
    <div class="small muted">La aplicación solo puede ver la carpeta «Patrimonio · Admon. Fincas» que crea en tu Drive, nunca el resto de tus archivos.</div>
    <div class="actions"><button class="btn primary" data-drive="conectar">Conectar con Google Drive</button></div></section>`;
  return `<section class="card pad stack grow1"><h2>Google Drive</h2>
    <div class="strip ${cls}"><div><div class="l">${esc(txt)}</div><b>Última sincronización: ${esc(cuando(e.ultima))}</b>${e.estado === 'error' && e.msg ? `<div class="small">${esc(e.msg)}</div>` : ''}</div></div>
    <div class="small muted">Los cambios se suben solos. Por seguridad, Google pide entrar de nuevo cada hora: si ves «Pulsa para sincronizar», pulsa el botón.</div>
    <div class="actions"><button class="btn primary" data-drive="sync">Sincronizar ahora</button><button class="btn" data-drive="desconectar">Desconectar</button></div></section>`;
}
export function bindDrive(el, refresh) {
  el.querySelectorAll('[data-drive]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.drive;
    if (k === 'conectar') { if (await accion(() => drive.conectar(decidir), b)) refresh(); else refresh(); }
    if (k === 'sync') { await sincronizarAhora(b); refresh(); }
    if (k === 'desconectar') {
      const m = modal({ title: 'Desconectar de Google Drive', submit: 'Desconectar', danger: true, body: '<p style="margin:0">Este dispositivo dejará de sincronizarse. Los datos siguen aquí y también en tu Drive.</p>', onSubmit: () => { drive.desconectar(); toast('Desconectado de Google Drive'); refresh(); } });
    }
  }));
}

// Recuadro de la barra lateral (ordenador) y aviso flotante (móvil)
export function htmlSidebar() {
  const e = drive.estado(), [txt, cls] = TXT[e.estado];
  return `<b><span class="dot ${cls === 'warn' ? 'warn' : ''}"></span>Google Drive · ${esc(txt)}</b>
    <span>Última: ${esc(cuando(e.ultima))}</span>
    <button type="button" class="linkbtn" data-sync>${e.estado === 'login' ? 'Entrar y sincronizar' : 'Sincronizar ahora'}</button>`;
}
export function pintarEstado() {
  const box = document.querySelector('#sidebar .sync');
  if (box && drive.conectado()) { box.innerHTML = htmlSidebar(); box.querySelector('[data-sync]').onclick = (ev) => sincronizarAhora(ev.currentTarget); }
  let pill = document.getElementById('syncpill');
  const e = drive.estado(), ver = drive.conectado() && ['login', 'pend', 'error', 'sync'].includes(e.estado);
  if (!pill) { pill = document.createElement('button'); pill.id = 'syncpill'; pill.type = 'button'; pill.onclick = () => sincronizarAhora(); document.body.appendChild(pill); }
  pill.hidden = !ver; pill.className = 'syncpill ' + e.estado;
  pill.textContent = e.estado === 'sync' ? 'Sincronizando con Drive…' : e.estado === 'login' ? 'Drive: pulsa para sincronizar' : e.estado === 'pend' ? 'Drive: cambios por subir' : 'Drive: error, pulsa para reintentar';
}
