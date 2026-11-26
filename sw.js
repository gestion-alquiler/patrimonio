// Permite abrir la app sin conexión. Cambia VERSION al publicar cambios.
const VERSION = 'patrimonio-v3.7.0';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/db.js', 'js/ui.js', 'js/calc.js', 'js/files.js', 'js/backup.js', 'js/copias.js', 'js/prueba.js', 'js/pruebaUI.js',
  'js/views/inicio.js', 'js/views/propiedades.js', 'js/views/ficha.js', 'js/views/ajustes.js',
  'js/fincas/calc.js', 'js/fincas/importar.js', 'js/fincas/views/comunidades.js', 'js/fincas/views/comunidad.js', 'js/fincas/views/vecino.js', 'js/fincas/views/proveedores.js', 'js/fincas/docs.js', 'js/fincas/cartasFin.js', 'js/cartasPat.js', 'js/cartas.js', 'js/editor.js', 'js/plantillas.js', 'js/imprimir.js', 'js/views/plantillas.js', 'js/views/informes.js', 'js/recibos.js', 'js/etiquetas.js', 'js/fincas/actas.js', 'js/fincas/liquidacion.js', 'js/banco.js', 'js/views/conciliacion.js', 'js/fincas/bancoFin.js', 'js/fincas/views/ajustes.js', 'js/drive.js', 'js/driveUI.js', 'vendor/jszip.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    // Google Drive y el acceso a Google van siempre directos, sin caché
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
    // Fuentes de Google: red primero, caché si no hay conexión
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // Archivos de la app: red primero (para recibir actualizaciones), caché sin conexión
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
