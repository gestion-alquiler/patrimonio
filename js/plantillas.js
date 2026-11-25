// Plantillas de texto editables (convocatorias y modelos de carta), en castellano y català.
// Los datos que cambian en cada documento se escriben como {marcas} y se sustituyen al generarlo.

/* ---------- Utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Sustituye {marca} por su valor (los valores se escapan; las marcas *_html se insertan tal cual)
export function rellenar(texto, vars) {
  return String(texto || '').replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? (k.endsWith('_html') ? vars[k] : esc(vars[k])) : m));
}

// Deja solo el formato básico (negrita, cursiva, subrayado, párrafos y listas)
export function limpiarHtml(html) {
  const t = document.createElement('template'); t.innerHTML = html || '';
  const OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI']);
  const walk = (n) => {
    [...n.childNodes].forEach(ch => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      walk(ch);
      if (ch.tagName === 'DIV') { const p = document.createElement('p'); while (ch.firstChild) p.appendChild(ch.firstChild); ch.replaceWith(p); return; }
      if (!OK.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); return; }
      [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
    });
  };
  walk(t.content);
  return t.innerHTML.replace(/<p><\/p>/g, '').trim();
}

export function htmlATexto(html) {
  return String(html || '').replace(/<li>/gi, '\n• ').replace(/<\/(p|li|ul|ol)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- Marcas disponibles ---------- */
export const MARCAS = {
  convocatoria: [['comunidad', 'Nombre de la comunidad'], ['presidente', 'Presidente/a'], ['tipo_junta', 'Ordinaria / Extraordinaria'], ['fecha_junta', 'Fecha de la junta'], ['hora', 'Hora'],
    ['segunda_convocatoria', 'Frase de segunda convocatoria (si hay)'], ['lugar', 'Lugar'], ['propietario', 'Propietario'], ['piso', 'Piso'], ['importe_pendiente', 'Importe pendiente del vecino'],
    ['lista_deudores', 'Lista de propietarios sin voto'], ['anio_junta', 'Año de la junta'], ['administrador', 'Administrador']],
  fin: [['propietario', 'Propietario'], ['piso', 'Piso'], ['ocupante', 'Ocupante'], ['comunidad', 'Comunidad'], ['direccion_comunidad', 'Dirección de la comunidad'], ['importe_pendiente', 'Importe pendiente'],
    ['detalle_pendiente', 'Detalle de lo pendiente'], ['iban_comunidad', 'IBAN de la comunidad'], ['presidente', 'Presidente/a'], ['administrador', 'Administrador'], ['telefono_administrador', 'Teléfono del administrador'], ['fecha_hoy', 'Fecha de hoy']],
  pat: [['inquilino', 'Inquilino'], ['direccion_inmueble', 'Dirección del inmueble'], ['renta_actual', 'Renta actual'], ['importe_pendiente', 'Importe pendiente'], ['detalle_pendiente', 'Detalle de lo pendiente'],
    ['fecha_inicio_contrato', 'Inicio del contrato'], ['fecha_fin_contrato', 'Fin del contrato'], ['fianza', 'Fianza'], ['indice_actualizacion', 'Índice (IPC / IRAV)'], ['mes_actualizacion', 'Mes de actualización'],
    ['propietario_nombre', 'Tu nombre'], ['propietario_telefono', 'Tu teléfono'], ['propietario_email', 'Tu email'], ['iban_propietario', 'Tu IBAN'], ['fecha_hoy', 'Fecha de hoy']],
};

/* ---------- Textos de la convocatoria ---------- */
export const CONV = [
  { k: 'saludo', nombre: 'Saludo', es: 'Estimado/a propietario/a:', ca: 'Benvolgut/da propietari/ària:' },
  { k: 'cuerpo', nombre: 'Texto principal (carta a cada vecino)',
    es: 'Por indicación de la Presidencia de la comunidad ({presidente}), se le convoca a la <b>Junta General {tipo_junta}</b> de propietarios, que se celebrará el <b>{fecha_junta}</b>, a las <b>{hora} horas</b>{segunda_convocatoria}, en <b>{lugar}</b>, para tratar el siguiente',
    ca: 'Per indicació de la Presidència de la comunitat ({presidente}), us convoquem a la <b>Junta General {tipo_junta}</b> de propietaris, que tindrà lloc el <b>{fecha_junta}</b>, a les <b>{hora} hores</b>{segunda_convocatoria}, a <b>{lugar}</b>, per tractar el següent' },
  { k: 'cuerpo_tablon', nombre: 'Texto principal (anuncio del tablón)',
    es: 'Por indicación de la Presidencia de la comunidad ({presidente}), se convoca a todos los propietarios a la <b>Junta General {tipo_junta}</b>, que se celebrará el <b>{fecha_junta}</b>, a las <b>{hora} horas</b>{segunda_convocatoria}, en <b>{lugar}</b>, para tratar el siguiente',
    ca: 'Per indicació de la Presidència de la comunitat ({presidente}), es convoca tots els propietaris a la <b>Junta General {tipo_junta}</b>, que tindrà lloc el <b>{fecha_junta}</b>, a les <b>{hora} hores</b>{segunda_convocatoria}, a <b>{lugar}</b>, per tractar el següent' },
  { k: 'su_deuda', nombre: 'Aviso al vecino con importes pendientes',
    es: 'Según nuestros registros, a fecha de hoy tiene pendiente de pago <b>{importe_pendiente}</b>. Si lo regulariza antes de la junta, podrá ejercer su derecho de voto.',
    ca: "Segons els nostres registres, a data d'avui teniu pendent de pagament <b>{importe_pendiente}</b>. Si ho regularitzeu abans de la junta, podreu exercir el vostre dret de vot." },
  { k: 'ausentes_cat', nombre: 'Votos de los ausentes (Codi civil de Catalunya)',
    es: 'Los acuerdos adoptados se notificarán a los propietarios ausentes, que dispondrán del plazo de un mes para manifestar su oposición. Si no lo hacen, su voto se computará como favorable (Codi civil de Catalunya).',
    ca: "Els acords adoptats es notificaran als propietaris absents, que disposaran del termini d'un mes per manifestar-hi la seva oposició. Si no ho fan, el seu vot es computarà com a favorable (Codi civil de Catalunya)." },
  { k: 'ausentes_lph', nombre: 'Votos de los ausentes (LPH)',
    es: 'Los acuerdos adoptados se notificarán a los propietarios ausentes. Si en el plazo de 30 días naturales no manifiestan su discrepancia, su voto se computará como favorable (art. 17.8 LPH).',
    ca: 'Els acords adoptats es notificaran als propietaris absents. Si en el termini de 30 dies naturals no manifesten la seva discrepància, el seu vot es computarà com a favorable (art. 17.8 LPH).' },
  { k: 'docs', nombre: 'Documentación disponible',
    es: 'La documentación relativa a los puntos del orden del día está a su disposición en la administración desde la fecha de esta convocatoria.',
    ca: "La documentació relativa als punts de l'ordre del dia és a la vostra disposició a l'administració des de la data d'aquesta convocatòria." },
  { k: 'deudores', nombre: 'Relación de propietarios sin derecho a voto',
    es: 'Relación de propietarios que no están al corriente de pago en la fecha de esta convocatoria. Tienen voz, pero no derecho de voto: {lista_deudores}.',
    ca: "Relació de propietaris que no estan al corrent de pagament en la data d'aquesta convocatòria. Tenen veu, però no dret de vot: {lista_deudores}." },
  { k: 'sin_deudores', nombre: 'Cuando todos están al corriente', es: 'En la fecha de esta convocatoria todos los propietarios están al corriente de pago.', ca: "En la data d'aquesta convocatòria tots els propietaris estan al corrent de pagament." },
  { k: 'representacion', nombre: 'Delegación (frase)', es: 'Si no puede asistir, puede delegar su representación en otra persona mediante el documento adjunto.', ca: 'Si no hi podeu assistir, podeu delegar la vostra representació en una altra persona mitjançant el document adjunt.' },
  { k: 'firma_sec', nombre: 'Firma del secretario', es: 'El Secretario-Administrador', ca: 'El Secretari-Administrador' },
  { k: 'firma_pres', nombre: 'Visto bueno de la presidencia', es: 'Vº Bº El/La Presidente/a', ca: 'Vist i plau El/La President/a' },
  { k: 'deleg_titulo', nombre: 'Título de la delegación de voto', es: 'Delegación de voto', ca: 'Delegació de vot' },
  { k: 'delegacion', nombre: 'Texto de la delegación de voto',
    es: 'D./D.ª <b>{propietario}</b>, propietario/a del piso/local <b>{piso}</b> de la Comunidad de Propietarios {comunidad}, delega su representación y voto en D./D.ª ________________________________ con DNI ______________ para la Junta General {tipo_junta} del {fecha_junta}.',
    ca: 'En/Na <b>{propietario}</b>, propietari/ària del pis/local <b>{piso}</b> de la Comunitat de Propietaris {comunidad}, delega la seva representació i vot en/na ________________________________ amb DNI ______________ per a la Junta General {tipo_junta} del {fecha_junta}.' },
];

export function textoConv(aj, k, l) {
  const own = aj?.plantillas?.conv?.[k]?.[l];
  if (own != null && own !== '') return own;
  const def = CONV.find(x => x.k === k);
  return def ? def[l] : '';
}

/* ---------- Modelos de carta ---------- */
const P = (...ps) => ps.map(p => `<p>${p}</p>`).join('');
export const CARTAS_BASE = {
  fin: [
    { id: 'f-reclamacion', nombre: 'Reclamación de cuotas pendientes',
      asunto: { es: 'Reclamación de cuotas pendientes · {piso}', ca: 'Reclamació de quotes pendents · {piso}' },
      cuerpo: {
        es: P('Estimado/a {propietario}:', 'Le comunicamos que, según la contabilidad de la Comunidad de Propietarios {comunidad}, a fecha de hoy el piso <b>{piso}</b> tiene pendiente de pago <b>{importe_pendiente}</b>, correspondiente a: {detalle_pendiente}.',
          'Le rogamos que regularice esta situación en el plazo de <b>15 días</b> mediante transferencia a la cuenta de la comunidad <b>{iban_comunidad}</b>, indicando el piso en el concepto.',
          'Si ya ha realizado el pago, le rogamos que no tenga en cuenta este escrito. Le recordamos que la falta de pago puede dar lugar a la reclamación judicial de la deuda, con los gastos que ello comporta.', 'Atentamente,'),
        ca: P('Benvolgut/da {propietario}:', "Us comuniquem que, segons la comptabilitat de la Comunitat de Propietaris {comunidad}, a data d'avui el pis <b>{piso}</b> té pendent de pagament <b>{importe_pendiente}</b>, corresponent a: {detalle_pendiente}.",
          'Us preguem que regularitzeu aquesta situació en el termini de <b>15 dies</b> mitjançant transferència al compte de la comunitat <b>{iban_comunidad}</b>, indicant el pis en el concepte.',
          "Si ja heu fet el pagament, us preguem que no tingueu en compte aquest escrit. Us recordem que la manca de pagament pot donar lloc a la reclamació judicial del deute, amb les despeses que això comporta.", 'Atentament,') } },
    { id: 'f-ruidos', nombre: 'Molestias por ruidos',
      asunto: { es: 'Molestias por ruidos · {piso}', ca: 'Molèsties per sorolls · {piso}' },
      cuerpo: {
        es: P('Estimado/a {propietario}:', 'Nos dirigimos a usted porque la administración ha recibido quejas de otros vecinos por ruidos procedentes del piso <b>{piso}</b>, especialmente en horario de descanso.',
          'Le rogamos que tome las medidas necesarias para respetar el descanso de los vecinos y las normas de convivencia de la comunidad. Si el piso está alquilado, le agradeceremos que traslade este aviso a sus ocupantes.',
          'Confiamos en su colaboración para mantener una buena convivencia en la finca.', 'Atentamente,'),
        ca: P('Benvolgut/da {propietario}:', "Ens adrecem a vós perquè l'administració ha rebut queixes d'altres veïns per sorolls procedents del pis <b>{piso}</b>, especialment en horari de descans.",
          "Us preguem que prengueu les mesures necessàries per respectar el descans dels veïns i les normes de convivència de la comunitat. Si el pis està llogat, us agrairem que traslladeu aquest avís als ocupants.",
          'Confiem en la vostra col·laboració per mantenir una bona convivència a la finca.', 'Atentament,') } },
    { id: 'f-animales', nombre: 'Animales en zonas comunes',
      asunto: { es: 'Animales de compañía en zonas comunes', ca: 'Animals de companyia a les zones comunes' },
      cuerpo: {
        es: P('Estimado/a {propietario}:', 'Se han detectado restos y suciedad de animales de compañía en las zonas comunes de la finca (portal, escalera, ascensor o patio).',
          'Le recordamos que los propietarios de animales deben recoger sus excrementos y mantener limpias las zonas comunes, y que los animales deben circular por ellas debidamente controlados.',
          'Le agradecemos de antemano su colaboración.', 'Atentamente,'),
        ca: P('Benvolgut/da {propietario}:', "S'han detectat restes i brutícia d'animals de companyia a les zones comunes de la finca (vestíbul, escala, ascensor o pati).",
          "Us recordem que els propietaris d'animals n'han de recollir els excrements i mantenir netes les zones comunes, i que els animals hi han de circular degudament controlats.",
          "Us agraïm per endavant la vostra col·laboració.", 'Atentament,') } },
    { id: 'f-aviso', nombre: 'Aviso general a los vecinos',
      asunto: { es: 'Aviso a los vecinos de {comunidad}', ca: 'Avís als veïns de {comunidad}' },
      cuerpo: {
        es: P('Estimados vecinos:', 'Les informamos de que el próximo día ____ de ______ , de ____ a ____ horas, se realizarán ________________________ en la finca.',
          'Durante ese tiempo ________________________. Disculpen las molestias.', 'Para cualquier consulta pueden contactar con la administración en el teléfono {telefono_administrador}.', 'Atentamente,'),
        ca: P('Benvolguts veïns:', "Us informem que el proper dia ____ de ______ , de ____ a ____ hores, es faran ________________________ a la finca.",
          "Durant aquest temps ________________________. Disculpeu les molèsties.", "Per a qualsevol consulta podeu contactar amb l'administració al telèfon {telefono_administrador}.", 'Atentament,') } },
    { id: 'f-convivencia', nombre: 'Normas de convivencia',
      asunto: { es: 'Recordatorio de normas de convivencia', ca: 'Recordatori de normes de convivència' },
      cuerpo: {
        es: P('Estimados vecinos:', 'Por indicación de la Presidencia, les recordamos algunas normas básicas de convivencia de la comunidad:',
          '<ul><li>Respetar el horario de descanso.</li><li>No dejar objetos ni bolsas de basura en las zonas comunes.</li><li>Cerrar siempre la puerta de la calle.</li><li>Recoger los excrementos de los animales de compañía.</li></ul>',
          'Gracias por su colaboración.', 'Atentamente,'),
        ca: P('Benvolguts veïns:', 'Per indicació de la Presidència, us recordem algunes normes bàsiques de convivència de la comunitat:',
          "<ul><li>Respectar l'horari de descans.</li><li>No deixar objectes ni bosses d'escombraries a les zones comunes.</li><li>Tancar sempre la porta del carrer.</li><li>Recollir els excrements dels animals de companyia.</li></ul>",
          'Gràcies per la vostra col·laboració.', 'Atentament,') } },
  ],
  pat: [
    { id: 'p-reclamacion', nombre: 'Reclamación de rentas pendientes',
      asunto: { es: 'Reclamación de cantidades pendientes · {direccion_inmueble}', ca: 'Reclamació de quantitats pendents · {direccion_inmueble}' },
      cuerpo: {
        es: P('Estimado/a {inquilino}:', 'Le comunico que, en relación con el contrato de arrendamiento de la vivienda situada en <b>{direccion_inmueble}</b>, a fecha de hoy está pendiente de pago la cantidad de <b>{importe_pendiente}</b>, correspondiente a: {detalle_pendiente}.',
          'Le ruego que abone esta cantidad en el plazo de <b>10 días</b> mediante transferencia a la cuenta <b>{iban_propietario}</b>.',
          'Si ya ha realizado el pago, le ruego que no tenga en cuenta este escrito. En caso contrario, me veré obligado/a a ejercer las acciones legales que me correspondan.', 'Atentamente,'),
        ca: P('Benvolgut/da {inquilino}:', "Us comunico que, en relació amb el contracte d'arrendament de l'habitatge situat a <b>{direccion_inmueble}</b>, a data d'avui està pendent de pagament la quantitat de <b>{importe_pendiente}</b>, corresponent a: {detalle_pendiente}.",
          'Us prego que aboneu aquesta quantitat en el termini de <b>10 dies</b> mitjançant transferència al compte <b>{iban_propietario}</b>.',
          "Si ja heu fet el pagament, us prego que no tingueu en compte aquest escrit. En cas contrari, em veuré obligat/da a exercir les accions legals que em corresponguin.", 'Atentament,') } },
    { id: 'p-visita', nombre: 'Aviso de visita o reparación',
      asunto: { es: 'Aviso de visita a la vivienda · {direccion_inmueble}', ca: "Avís de visita a l'habitatge · {direccion_inmueble}" },
      cuerpo: {
        es: P('Estimado/a {inquilino}:', 'Le informo de que el próximo día ____ de ______ , hacia las ____ horas, está prevista una visita a la vivienda de <b>{direccion_inmueble}</b> para ________________________.',
          'Si ese día no le va bien, le ruego que me lo comunique en el teléfono {propietario_telefono} para acordar otra fecha.', 'Gracias por su colaboración.', 'Atentamente,'),
        ca: P('Benvolgut/da {inquilino}:', "Us informo que el proper dia ____ de ______ , cap a les ____ hores, està prevista una visita a l'habitatge de <b>{direccion_inmueble}</b> per ________________________.",
          "Si aquell dia no us va bé, us prego que m'ho comuniqueu al telèfon {propietario_telefono} per acordar una altra data.", 'Gràcies per la vostra col·laboració.', 'Atentament,') } },
    { id: 'p-actualizacion', nombre: 'Actualización anual de la renta',
      asunto: { es: 'Actualización de la renta · {direccion_inmueble}', ca: 'Actualització de la renda · {direccion_inmueble}' },
      cuerpo: {
        es: P('Estimado/a {inquilino}:', 'De acuerdo con lo pactado en el contrato de arrendamiento de la vivienda de <b>{direccion_inmueble}</b>, le comunico que la renta se actualizará en <b>{mes_actualizacion}</b> según el índice <b>{indice_actualizacion}</b>.',
          'La renta actual es de <b>{renta_actual}</b> al mes. Aplicando la variación del índice (____ %), la nueva renta será de <b>________ €</b> al mes a partir de esa fecha.',
          'Le adjunto el certificado o la referencia oficial del índice aplicado.', 'Atentamente,'),
        ca: P('Benvolgut/da {inquilino}:', "D'acord amb el que es va pactar en el contracte d'arrendament de l'habitatge de <b>{direccion_inmueble}</b>, us comunico que la renda s'actualitzarà el mes de <b>{mes_actualizacion}</b> segons l'índex <b>{indice_actualizacion}</b>.",
          "La renda actual és de <b>{renta_actual}</b> al mes. Aplicant la variació de l'índex (____ %), la nova renda serà de <b>________ €</b> al mes a partir d'aquesta data.",
          "Us adjunto el certificat o la referència oficial de l'índex aplicat.", 'Atentament,') } },
    { id: 'p-fin', nombre: 'Comunicación de fin de contrato',
      asunto: { es: 'Finalización del contrato · {direccion_inmueble}', ca: 'Finalització del contracte · {direccion_inmueble}' },
      cuerpo: {
        es: P('Estimado/a {inquilino}:', 'Por medio de la presente le comunico mi voluntad de no renovar el contrato de arrendamiento de la vivienda de <b>{direccion_inmueble}</b>, que finaliza el <b>{fecha_fin_contrato}</b>.',
          'En esa fecha deberá dejar la vivienda libre y en buen estado y entregar las llaves. Revisaremos juntos el estado del piso para la devolución de la fianza ({fianza}).',
          'Quedo a su disposición para acordar el día de la entrega de llaves.', 'Atentamente,'),
        ca: P('Benvolgut/da {inquilino}:', "Per mitjà d'aquesta carta us comunico la meva voluntat de no renovar el contracte d'arrendament de l'habitatge de <b>{direccion_inmueble}</b>, que finalitza el <b>{fecha_fin_contrato}</b>.",
          "En aquesta data haureu de deixar l'habitatge lliure i en bon estat i lliurar les claus. Revisarem junts l'estat del pis per a la devolució de la fiança ({fianza}).",
          'Resto a la vostra disposició per acordar el dia del lliurament de claus.', 'Atentament,') } },
    { id: 'p-molestias', nombre: 'Quejas de vecinos o de la comunidad',
      asunto: { es: 'Comunicación sobre convivencia · {direccion_inmueble}', ca: 'Comunicació sobre convivència · {direccion_inmueble}' },
      cuerpo: {
        es: P('Estimado/a {inquilino}:', 'He recibido quejas de la comunidad de propietarios en relación con ________________________ en la vivienda de <b>{direccion_inmueble}</b>.',
          'Le ruego que respete las normas de convivencia de la comunidad y que tome las medidas necesarias para que no se repita.', 'Gracias por su comprensión.', 'Atentamente,'),
        ca: P('Benvolgut/da {inquilino}:', "He rebut queixes de la comunitat de propietaris en relació amb ________________________ a l'habitatge de <b>{direccion_inmueble}</b>.",
          "Us prego que respecteu les normes de convivència de la comunitat i que prengueu les mesures necessàries perquè no es repeteixi.", 'Gràcies per la vostra comprensió.', 'Atentament,') } },
  ],
};

// Modelos de carta del módulo: los de serie (con los cambios guardados) y los creados por el usuario
export function modelosCarta(mod, aj) {
  const own = aj?.cartasPlantillas || [];
  const borr = new Set(aj?.cartasBorradas || []);
  const base = CARTAS_BASE[mod].filter(b => !borr.has(b.id)).map(b => ({ ...b, ...(own.find(o => o.id === b.id) || {}), base: true }));
  return [...base, ...own.filter(o => !CARTAS_BASE[mod].some(b => b.id === o.id))];
}
