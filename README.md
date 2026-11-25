# Patrimonio · Admon. Fincas (versión 2)

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
  - Foto de portada: se pone desde el Resumen («Poner foto») o desde Documentos («Usar de portada»), y sale en la lista de propiedades.
  - Documentos y fotos: las fotos se reducen a 1600 px al guardarlas.
  - Histórico de inquilinos y notas.
- **Ajustes:** exportación a CSV para Excel, datos del propietario, datos de ejemplo y borrar todo.

### Admon. Fincas (nuevo en la versión 2, en azul)

- **Comunidades:** alta, edición, archivar (dar de baja conservando los datos), recuperar y eliminar.
- **Vecinos por piso:** propietario, DNI, contacto, idioma, IBAN, forma de pago, coeficiente, cuota (con historial de cambios), ocupante, saldo anterior y propietarios anteriores.
- **Cuotas:** cuadrícula de 12 meses con importe y fecha de cobro; la casilla queda vacía si no ha pagado. Cobro de un mes a varios vecinos a la vez (remesa) y exportación a CSV.
- **Gastos:** por coeficiente, a partes iguales o de derrama/obra; pendientes o pagados; repetición mensual o trimestral.
- **Balance:** saldo del banco, cobros y pagos por mes y libro de movimientos editable.
- **Derramas:** reparto por coeficiente o a partes iguales, en uno o varios plazos, con control de cobro por vecino, presupuesto de la obra y pagos.
- **Datos de la comunidad:** calcular cuotas desde el presupuesto y subir o bajar todas las cuotas un % desde un mes.
- **Importar desde Excel:** lee la hoja de contabilidad de cuotas (como la de Sant Llorenç, 19), enseña un resumen y avisa de lo que conviene revisar.
- **Ajustes propios:** datos del administrador e idioma por defecto.

### Copias de seguridad (las dos partes juntas)

- **Exportar copia completa:** un solo .zip con Patrimonio y Admon. Fincas, desde los Ajustes de cualquiera de las dos partes.
- **Importar / restaurar copia:** desde cualquiera de las dos partes. Si la copia trae las dos, eliges: todo, solo Patrimonio o solo Admon. Fincas. Lo que no restauras no se toca.
- **Solo en el ordenador:** en el móvil no aparecen las copias.
- **Copia de una sola parte:** opción secundaria. Las copias antiguas también se pueden restaurar.

Todo se puede editar y borrar.

## Datos de prueba (temporal)

En Ajustes de cualquiera de las dos partes, «Cargar datos de prueba» rellena la app con 10 propiedades y 3 comunidades inventadas. «Borrar datos de prueba» quita solo lo inventado. Este bloque se quitará antes de empezar con los datos reales.

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
- **Admon. Fincas, fase 2:** juntas, convocatorias ordinarias y extraordinarias, comunicados, actas, etiquetas y liquidación anual, en castellano y català.
