# Patrimonio · Admon. Fincas (versión 3 de escritorio)

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

Novedades de la versión 2.4:

- Patrimonio: la basura es un pago anual (una sola casilla por año). Histórico con «Revisar»: ficha completa de cada inquilino anterior, con documentos y notas que se pueden seguir añadiendo.
- Admon. Fincas: «Pendiente» en lugar de «moroso»; saldo según banco con su fecha; ficha del vecino en página propia con Guardar; cambio de propietario con histórico; agenda común de proveedores; presupuesto anual por partidas; presidencia con contacto y características especiales.

Novedades de la versión 2.5:

- Admon. Fincas: pestaña Juntas. Juntas ordinarias y extraordinarias con orden del día en castellano y català; convocatoria personalizada por vecino en su idioma (PDF, con aviso de importes pendientes, relación de propietarios sin derecho a voto y delegación de voto); anuncio para el tablón; control de envío y email preparado.

Novedades de la versión 2.6:

- Cartas y comunicados en las dos partes: carta libre o a partir de un modelo, a uno o varios destinatarios, cada uno en su idioma; los datos entre llaves ({propietario}, {importe_pendiente}…) se rellenan solos. Quedan guardadas con fecha y envío en la ficha del vecino o del inquilino (también de los anteriores).
- Plantillas (menú lateral): modelos de carta editables, de serie y propios, y todos los textos de las convocatorias en castellano y català, con «Restaurar el texto original».
- En la ventana de impresión se puede retocar cualquier texto antes de imprimir.

Novedades de la versión 3 (escritorio completo):

- Admon. Fincas · Actas: asistencia y representados con quórum por coeficiente, acuerdos por punto con votación (unanimidad, mayoría con recuento por propietario y coeficiente), PDF en català o castellano y notificación de acuerdos a los ausentes preparada como carta.
- Etiquetas para sobres (Apli/Avery de 14, 16, 21 y 24 por hoja), empezando en cualquier etiqueta de una hoja usada: vecinos, ocupantes o inquilinos.
- Admon. Fincas · Liquidación anual: un único PDF igual para todos (saldo a 31/12 del año anterior + ingresos − gastos = saldo final, fondo de reserva aparte, si la comunidad está en positivo o negativo, gastos a partes iguales y por coeficiente, obras y derramas con su saldo, quién debe y cuánto, reparto por propietario), en català o castellano, y exportación.
- Patrimonio · Informes: resultado y rentabilidad por inmueble, gastos por categoría, días alquilado y datos para la renta (PDF y CSV para el gestor).
- Patrimonio · Recibos de alquiler numerados, dos por hoja, desde cada cobro, por propiedad o de todas a la vez.
- Conciliación bancaria en las dos partes: importa el extracto (Excel, CSV o Norma 43), sugiere con qué cobro o gasto va cada movimiento (rentas, cuotas, remesas de recibos, derramas, gastos ya apuntados o nuevos con su proveedor), acepta las seguras de golpe y anota el saldo del banco. Todo se puede deshacer.

Todo se puede editar y borrar.

## Datos de prueba (temporal)

En Ajustes de cualquiera de las dos partes, «Cargar datos de prueba» rellena la app con 10 propiedades y 3 comunidades inventadas. «Borrar datos de prueba» quita solo lo inventado. Este bloque se quitará antes de empezar con los datos reales.

## Dónde se guardan los datos

En el navegador de cada dispositivo (IndexedDB). **En GitHub solo está el programa, nunca tus datos.**

**Google Drive (ordenador y móvil con los mismos datos).** En Ajustes y copias → **Conectar con Google Drive**. La app crea en tu Drive la carpeta «Patrimonio · Admon. Fincas» con un archivo `datos.json` y un archivo por cada documento o foto. Cada cambio se sube solo a los pocos segundos y, al abrir la app o volver a ella, se traen los cambios del otro dispositivo. Si se ha cambiado lo mismo en los dos sitios, gana el cambio más reciente. Google pide entrar de nuevo cada hora: entonces aparece «Pulsa para sincronizar». La app solo puede ver los archivos que crea ella (permiso `drive.file`). En un dispositivo nuevo, conecta Drive **antes** de meter datos.

Proyecto de Google Cloud «Patrimonio»: ID de cliente en `js/drive.js`, origen autorizado `https://gestion-alquiler.github.io`.

Sin Drive, los datos se pasan con una copia: **Exportar copia completa** en un dispositivo e **Importar / restaurar copia** en el otro.

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

- Revisión completa con datos de prueba (escritorio y móvil) y ajustes de la versión móvil.
- Quitar los datos de prueba y empezar con los datos reales.
