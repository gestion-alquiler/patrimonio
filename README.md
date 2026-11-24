# Patrimonio · gestión de alquileres (fase 1)

App web para gestionar viviendas y locales en alquiler: propiedades, inquilinos, contratos, cobros, gastos, balance, documentos, notas y copias de seguridad. Funciona en ordenador y móvil, también sin conexión.

## Qué incluye esta versión

- **Inicio:** cobrado y pendiente del mes, margen del año y avisos (impagos, contratos que vencen, actualización de renta, gastos por pagar, copia de seguridad).
- **Propiedades:** alta, edición y borrado; buscador y filtros (alquiladas, libres, con deuda).
- **Ficha de cada propiedad:**
  - Resumen con el margen del año y los datos del inmueble.
  - Balance mes a mes y libro de movimientos.
  - Inquilino y contrato: datos, renta, fianza, basura, actualización de renta, finalizar contrato, documentación del inquilino.
  - Cobros: cuadrícula de 12 meses con importe y fecha; las casillas vacías con borde rojo están vencidas sin cobrar.
  - Gastos: con repetición mensual o trimestral, pendiente o pagado, y factura adjunta.
  - Documentos y fotos: las fotos se reducen a 1600 px al guardarlas.
  - Histórico de inquilinos y notas.
- **Ajustes y copias:** copia completa en .zip (exportar e importar), exportación a CSV para Excel, datos del propietario, datos de ejemplo y borrar todo.

Todo se puede editar y borrar.

## Dónde se guardan los datos

En el navegador de cada dispositivo (IndexedDB). **En GitHub solo está el programa, nunca tus datos.**

Hasta que llegue la sincronización con Google Drive (fase 3), cada dispositivo tiene sus propios datos. Para pasarlos de uno a otro:

1. En el dispositivo de origen: Ajustes y copias → **Exportar copia completa**.
2. En el de destino: **Importar / restaurar copia**.

Haz copias a menudo. La app te avisa cuando toca.

## Publicarla gratis en GitHub Pages (una sola vez)

1. Crea una cuenta en **github.com** (gratuita).
2. Pulsa **New repository**. Ponle de nombre `patrimonio`, déjalo como **Public** y pulsa **Create repository**.
3. En la página del repositorio pulsa **uploading an existing file**.
4. Arrastra **todo el contenido** de esta carpeta: `index.html`, `sw.js`, `manifest.webmanifest`, `README.md` y las carpetas `css`, `js`, `vendor` e `icons`. Arrastra lo que hay dentro, no la carpeta que lo contiene.
5. Pulsa **Commit changes**.
6. Ve a **Settings → Pages**. En **Branch** elige `main` y `/ (root)` y pulsa **Save**.
7. En 1 o 2 minutos la app estará en `https://TU-USUARIO.github.io/patrimonio/`.

**En el móvil:** abre esa dirección y elige **Añadir a pantalla de inicio**. Se instala como una app.

> No funciona abriendo `index.html` con doble clic: el navegador lo bloquea por seguridad. Hay que abrirla desde la dirección de GitHub Pages.

## Actualizar a una versión nueva

Vuelve a subir los archivos nuevos al repositorio (Add file → Upload files) y pulsa **Commit changes**. Tus datos no se tocan, porque están en tu dispositivo y no en GitHub. Antes de actualizar, haz una copia por si acaso.

## Próximas fases

- **Fase 2:** cartas en castellano y català (actualización de renta, fin de contrato, reclamación), informes, recibos de alquiler.
- **Fase 3:** sincronización con Google Drive entre móvil y ordenador.
- **Fase 4:** conciliación bancaria con extractos CSV o Excel.
- **Fase 5:** módulo Admon. Fincas (comunidades, cuotas, derramas, juntas, actas y liquidaciones), con importación del Excel actual.
