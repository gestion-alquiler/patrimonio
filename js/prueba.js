// Datos de prueba inventados para Patrimonio y Admon. Fincas.
// Todo lo que se crea aquí lleva prueba:true, así se puede borrar sin tocar los datos reales.
import { db, STORES, STORES_FIN } from './db.js';
import { hoyISO, fecha } from './ui.js';
import { ordenPorDefecto } from './fincas/docs.js';
import { CARTAS_BASE } from './plantillas.js';

// Generador pseudoaleatorio con semilla: siempre salen los mismos datos
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const r = rng(20261125);
const pick = (a) => a[Math.floor(r() * a.length)];
const r2 = (n) => Math.round(n * 100) / 100;
const iso = (y, m, d) => { const dt = new Date(y, m - 1, d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const P = (o) => ({ ...o, prueba: true });
const put = (s, o) => db.put(s, P(o));

/* ---------- Archivos inventados ---------- */

async function fotoFachada(colorPared, colorTejado, pisos = 3, local = false) {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 520;
  const g = cv.getContext('2d');
  const cielo = g.createLinearGradient(0, 0, 0, 520); cielo.addColorStop(0, '#9CC3E0'); cielo.addColorStop(1, '#DCEAF3');
  g.fillStyle = cielo; g.fillRect(0, 0, 800, 520);
  g.fillStyle = '#B9B4A8'; g.fillRect(0, 470, 800, 50);
  const top = 470 - pisos * 105 - 20;
  g.fillStyle = colorPared; g.fillRect(150, top, 500, 470 - top);
  g.fillStyle = colorTejado; g.fillRect(135, top - 22, 530, 26);
  for (let p = 0; p < pisos; p++) for (let i = 0; i < 3; i++) {
    const x = 195 + i * 150, y = top + 25 + p * 105;
    if (local && p === pisos - 1) continue;
    g.fillStyle = '#3E5468'; g.fillRect(x, y, 70, 62); g.fillStyle = '#7A9BB5'; g.fillRect(x + 6, y + 6, 26, 50); g.fillRect(x + 38, y + 6, 26, 50);
    g.fillStyle = '#5A4A3A'; g.fillRect(x - 8, y + 62, 86, 6);
  }
  if (local) { g.fillStyle = '#2F3B45'; g.fillRect(190, 380, 420, 90); g.fillStyle = '#8FA7B8'; g.fillRect(200, 390, 400, 70); }
  else { g.fillStyle = '#4A3526'; g.fillRect(370, 395, 60, 75); }
  const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.8));
  return new File([blob], 'fachada.jpg', { type: 'image/jpeg' });
}

function pdfSimple(titulo, lineas) {
  const esc = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, ' ');
  const txt = ['BT /F1 18 Tf 60 780 Td (' + esc(titulo) + ') Tj ET', ...lineas.map((l, i) => `BT /F1 11 Tf 60 ${740 - i * 18} Td (${esc(l)}) Tj ET`), 'BT /F1 9 Tf 60 60 Td (DOCUMENTO DE PRUEBA - DATOS INVENTADOS) Tj ET'].join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${txt.length} >>\nstream\n${txt}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new File([out], titulo.replace(/\W+/g, '_') + '.pdf', { type: 'application/pdf' });
}

async function doc(file, meta) {
  return put('documentos', { ...meta, archivo: file.name, mime: file.type, size: file.size, fecha: meta.fecha || hoyISO(), blob: file });
}

/* ---------- Patrimonio ---------- */

const NOMBRES = ['Marta Puig Ferrer', 'Jordi Vidal Soler', 'Ana López Martín', 'Pau Roca Serra', 'Laia Font Mas', 'Carlos Ruiz García', 'Núria Casals Pons', 'Sergio Navarro Gil', 'Elena Torres Vila',
  'David Romero Sanz', 'Montse Riera Bosch', 'Javier Molina Ortiz', 'Clara Sala Prat', 'Oriol Camps Vives', 'Lucía Fernández Ramos', 'Arnau Costa Jové'];

export async function cargarPruebaPatrimonio() {
  const hoy = hoyISO(), Y = Number(hoy.slice(0, 4)), M = Number(hoy.slice(5, 7)), D = Number(hoy.slice(8, 10));
  const props = [
    ['C/ Major 24, 1º 1ª', 'Sabadell', 'Piso', 85, 3, 2012, 138000, '#E8D9C0', '#8A4B3A'],
    ['C/ Major 24, 2º 2ª', 'Sabadell', 'Piso', 85, 3, 2014, 129000, '#E8D9C0', '#8A4B3A'],
    ['Av. Catalunya 112, 3º 1ª', 'Terrassa', 'Piso', 72, 2, 2016, 112000, '#D9C4B0', '#6B4A3A'],
    ['C/ Sant Pere 8, bajos', 'Sabadell', 'Local', 110, 0, 2010, 165000, '#CFC8BC', '#55606A'],
    ['Rambla 45, 4º 2ª', 'Terrassa', 'Piso', 95, 3, 2019, 176000, '#EADFCB', '#7A3E2E'],
    ['C/ Indústria 17, 1º', 'Sant Quirze', 'Piso', 64, 2, 2018, 98000, '#F0E4D0', '#9A5A40'],
    ['Pg. de la Plaça 3, ático', 'Sabadell', 'Ático', 70, 2, 2021, 189000, '#E2D6C6', '#5E3B2E'],
    ['C/ Gràcia 56, 2º 1ª', 'Barberà', 'Piso', 80, 3, 2008, 121000, '#DCCDB8', '#844A38'],
    ['C/ Montserrat 9, plaza 14', 'Sabadell', 'Garaje', 12, 0, 2015, 14000, null, null],
    ['C/ del Sol 31, local 2', 'Terrassa', 'Local', 60, 0, 2017, 72000, '#CBC5BA', '#4E5A64'],
  ];
  const ids = [];
  for (const [i, [dir, zona, tipo, m2, hab, ay, precio, cp, ct]] of props.entries()) {
    const p = await put('propiedades', { direccion: dir, zona, tipo, m2, habitaciones: hab || '', fechaCompra: iso(ay, 1 + (i * 5) % 12, 10 + i), precioCompra: precio, gastosCompra: Math.round(precio * 0.1),
      valorActual: Math.round(precio * (1.2 + r() * 0.4) / 1000) * 1000, refCatastral: `${7000000 + i * 1371}DF${2000 + i * 7}N000${i}XY`, comunidadAdmin: tipo === 'Garaje' ? 'Comunidad Garaje Montserrat' : pick(['Fincas Vallès', 'Administracions Puig', 'Gestió Finques Riera']),
      seguro: tipo === 'Garaje' ? '' : pick(['Mapfre Hogar', 'Allianz Hogar', 'Línea Directa', 'Zurich Hogar']) + ' · póliza ' + (40000000 + i * 913), seguroVence: iso(Y + (i % 3 === 0 ? 0 : 1), 1 + (i * 3) % 12, 1), certEnergetico: tipo === 'Garaje' ? '' : pick(['D', 'E', 'E', 'F', 'C']) });
    ids.push(p);
    if (cp) await doc(await fotoFachada(cp, ct, tipo === 'Local' ? 2 : 3 + (i % 2), tipo === 'Local'), { propiedadId: p.id, tipo: 'foto', nombre: 'Fachada' });
    if (i < 4) await doc(pdfSimple('Escritura de compraventa', [dir + ', ' + zona, 'Precio: ' + precio + ' euros', 'Notaria inventada'], ), { propiedadId: p.id, tipo: 'escritura', nombre: 'Escritura ' + dir });
  }
  // Contratos: [propiedad, renta, inicio, basura, mesesQueDebe, pasado]
  const plan = [
    { p: 0, renta: 780, ini: [Y - 3, 9, 1], basura: 'inquilino', bimp: 125, debe: [], antes: { renta: 720, ini: [Y - 6, 9, 1], fin: [Y - 3, 8, 31], motivo: 'Fin de contrato' } },
    { p: 1, renta: 750, ini: [Y - 1, 2, 1], basura: 'propietario', debe: [M - 1, M] },
    { p: 2, renta: 690, ini: [Y - 2, 6, 1], basura: 'inquilino', bimp: 110, debe: [] },
    { p: 3, renta: 1150, ini: [Y - 4, 1, 1], basura: 'inquilino', bimp: 210, debe: [M] },
    { p: 4, renta: 980, ini: [Y, 3, 1], basura: 'propietario', debe: [], antes: { renta: 900, ini: [Y - 3, 3, 1], fin: [Y, 1, 31], motivo: 'Traslado por trabajo' } },
    { p: 5, renta: 640, ini: [Y - 1, 10, 1], basura: 'inquilino', bimp: 95, debe: [M - 3, M - 2, M - 1, M] },
    { p: 6, renta: 1050, ini: [Y - 2, 4, 15], basura: 'propietario', debe: [] },
    { p: 8, renta: 85, ini: [Y - 5, 1, 1], basura: 'no', debe: [] },
    { p: 9, renta: 620, ini: [Y - 1, 1, 1], basura: 'inquilino', bimp: 140, debe: [], fin: [Y, 4, 30], motivo: 'Cierre del negocio' },
  ];
  let n = 0;
  const desde = `${Y - 1}-01`;
  for (const k of plan) {
    const p = ids[k.p];
    const crea = async (renta, ini, finReal, estado, deuda, motivo) => {
      const nombre = NOMBRES[n++ % NOMBRES.length];
      const inq = await put('inquilinos', { nombre, dni: `${40000000 + n * 7311}${'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23]}`, telefono: '6' + String(10000000 + n * 1234567).slice(0, 8), email: nombre.split(' ')[0].toLowerCase() + '@example.com', idioma: n % 3 ? 'ca' : 'es', iban: `ES76 2100 0000 ${String(1000 + n).padStart(4, '0')} 0000 ${String(n * 37).padStart(4, '0')}` });
      const inicio = iso(...ini), finContrato = iso(ini[0] + (k.p === 3 ? 10 : estado === 'activo' && ini[0] + 5 <= Y ? Y - ini[0] + 3 : 5), ini[1], ini[2]);
      const hist = [];
      // Subidas anuales del IPC/IRAV
      let rr = renta; const anios = Math.max(0, (finReal ? Number(finReal.slice(0, 4)) : Y) - ini[0]);
      if (estado === 'activo') { rr = renta; for (let a = anios; a >= 1; a--) { if (ym(ini[0] + a, ini[1]) <= ym(Y, M)) hist.unshift({ desde: ym(ini[0] + a, ini[1]), importe: rr }); rr = r2(rr / 1.028); } hist.unshift({ desde: ym(...ini), importe: rr }); }
      if (hist.length) renta = hist[hist.length - 1].importe;
      const c = await put('contratos', { propiedadId: p.id, inquilinoId: inq.id, inicio, fin: finContrato, renta, diaPago: 5, actualizacion: ini[0] * 100 + ini[1] < 202305 ? 'IPC' : 'IRAV', mesActualizacion: ini[1],
        fianza: p.tipo === 'Local' ? renta * 2 : renta, fianzaDeposito: 'INCASÒL', basuraPaga: k.basura, basuraImporte: k.bimp || 0, estado, cobrosDesde: estado === 'finalizado' || desde <= ym(...ini) ? ym(...ini) : desde,
        historialRenta: hist.length > 1 ? hist : undefined, avalista: n % 4 === 0 ? 'Avalista de prueba' : '',
        ...(estado === 'finalizado' ? { fechaSalida: finReal, motivoSalida: motivo, fianzaDevuelta: renta - (n % 2 ? 0 : 150), descuentos: n % 2 ? '' : 'Pintura habitación' } : {}) });
      await doc(pdfSimple('Contrato de arrendamiento', [p.direccion, 'Arrendatario: ' + nombre, 'Renta: ' + renta + ' euros/mes', 'Inicio: ' + inicio]), { propiedadId: p.id, contratoId: c.id, tipo: 'contrato', nombre: 'Contrato ' + nombre, fecha: inicio });
      await doc(pdfSimple('DNI ' + nombre, ['Copia de documento de identidad', 'Inventado para pruebas']), { propiedadId: p.id, contratoId: c.id, tipo: 'dni', nombre: 'DNI ' + nombre, fecha: inicio });
      if (n % 2) await doc(pdfSimple('Certificado de titularidad', ['Cuenta bancaria de ' + nombre]), { propiedadId: p.id, contratoId: c.id, tipo: 'cuenta', nombre: 'Certificado de cuenta', fecha: inicio });
      if (n % 3) await doc(pdfSimple('Nominas', ['Tres ultimas nominas de ' + nombre]), { propiedadId: p.id, contratoId: c.id, tipo: 'nominas', nombre: 'Nóminas', fecha: inicio });
      await doc(pdfSimple('Deposito de fianza INCASOL', ['Fianza: ' + (p.tipo === 'Local' ? renta * 2 : renta) + ' euros']), { propiedadId: p.id, contratoId: c.id, tipo: 'fianza', nombre: 'Resguardo depósito fianza', fecha: inicio });
      // Cobros
      const [cy, cm] = (estado === 'finalizado' || desde <= ym(...ini) ? ym(...ini) : desde).split('-').map(Number);
      let y = cy, m = cm;
      const finY = finReal ? Number(finReal.slice(0, 4)) : Y, finM = finReal ? Number(finReal.slice(5, 7)) : M;
      while (y < finY || (y === finY && m <= finM)) {
        const k2 = ym(y, m);
        const actual = y === Y && m === M;
        const noPaga = estado === 'activo' && y === Y && deuda.includes(m);
        if (!noPaga && !(actual && D < 6)) {
          const imp = (hist.filter(h => h.desde <= k2).pop() || { importe: renta }).importe;
          const dia = Math.min(28, 1 + Math.floor(r() * 6));
          await put('pagos', { contratoId: c.id, propiedadId: p.id, anio: y, mes: m, concepto: 'renta', importe: imp, fecha: iso(y, m, dia), forma: n % 3 === 0 ? 'Bizum' : 'Transferencia' });
        }
        m++; if (m > 12) { m = 1; y++; }
      }
      // Basura: un pago al año (normalmente en primavera); el moroso de la C/ Indústria no pagó la del año pasado
      if (k.basura === 'inquilino' && k.bimp) {
        for (let yb = cy; yb <= finY; yb++) {
          if (k.p === 5 && estado === 'activo') continue;
          const mb = yb === cy ? Math.max(cm, 4) : 4;
          if (yb === Y && mb > M) continue;
          if (finReal && `${yb}-${String(mb).padStart(2, '0')}` > finReal.slice(0, 7)) continue;
          await put('pagos', { contratoId: c.id, propiedadId: p.id, anio: yb, mes: 0, concepto: 'basura', importe: k.bimp, fecha: iso(yb, mb, 18), forma: 'Transferencia' });
        }
      }
      return c;
    };
    if (k.antes) await crea(k.antes.renta, k.antes.ini, iso(...k.antes.fin), 'finalizado', [], k.antes.motivo);
    const cAct = await crea(k.renta, k.ini, k.fin ? iso(...k.fin) : null, k.fin ? 'finalizado' : 'activo', k.debe.filter(x => x >= 1), k.motivo);
    if (k.p === 5) { const m = CARTAS_BASE.pat.find(x => x.id === 'p-reclamacion'); const f = iso(Y, M, Math.max(1, D - 6));
      await put('cartas', { propiedadId: p.id, fecha: f, idiomaModo: 'cada', destinatarios: [cAct.id], asunto: m.asunto, cuerpo: m.cuerpo, envios: { [cAct.id]: { fecha: f, via: 'Email' } } }); }
  }
  // Gastos de los dos últimos años
  for (const [i, p] of ids.entries()) {
    const garaje = p.tipo === 'Garaje';
    const cuotaCom = garaje ? 18 : p.tipo === 'Local' ? 35 : 45 + (i % 4) * 10;
    for (const y of [Y - 1, Y]) {
      for (let t = 1; t <= 12; t += 3) { const f = iso(y, t, 5); await put('gastos', { propiedadId: p.id, categoria: 'Comunidad', concepto: `Cuota comunidad ${t === 1 ? '1T' : t === 4 ? '2T' : t === 7 ? '3T' : '4T'} ${y}`, proveedor: p.comunidadAdmin, importe: cuotaCom * 3, fecha: f, estado: f <= hoy ? 'pagado' : 'pendiente' }); }
      const fIbi = iso(y, 7, 1); await put('gastos', { propiedadId: p.id, categoria: 'IBI', concepto: 'IBI ' + y, proveedor: 'Ajuntament de ' + p.zona, importe: r2((garaje ? 60 : 250 + p.m2 * 2.6) * (y === Y ? 1.02 : 1)), fecha: fIbi, estado: fIbi <= hoy ? 'pagado' : 'pendiente' });
      if (!garaje) { const fs = iso(y, 1 + (i * 3) % 12, 1); await put('gastos', { propiedadId: p.id, categoria: 'Seguro', concepto: 'Seguro hogar ' + y, proveedor: (p.seguro || '').split(' · ')[0], importe: r2(150 + p.m2 * 1.1), fecha: fs, estado: fs <= hoy ? 'pagado' : 'pendiente' }); }
      const fb = iso(y, 3, 20); if (!garaje) await put('gastos', { propiedadId: p.id, categoria: 'Basuras', concepto: 'Tasa de residuos ' + y, proveedor: 'Ajuntament de ' + p.zona, importe: p.tipo === 'Local' ? 210 : 115, fecha: fb, estado: fb <= hoy ? 'pagado' : 'pendiente' });
    }
  }
  const mant = [[0, 'Mantenimiento', 'Reparación caldera', 'Calefaccions Vallès', 186.34], [1, 'Mantenimiento', 'Cambio grifo cocina', 'Fontaneria Roca', 95.5], [2, 'Mantenimiento', 'Persiana dormitorio', 'Persianes Sabadell', 142],
    [4, 'Extraordinario / obras', 'Pintura completa antes de alquilar', 'Pintures Font', 1450], [5, 'Mantenimiento', 'Desatasco bajante', 'Desembussos 24h', 121], [6, 'Extraordinario / obras', 'Derrama fachada comunidad', 'Administracions Puig', 980],
    [7, 'Mantenimiento', 'Revisión gas', 'Gas Natural Servicios', 78.65], [3, 'Gestoría / honorarios', 'Honorarios gestoría renta', 'Gestoria Vidal', 121], [9, 'Mantenimiento', 'Cerrajero cambio bombín', 'Serralleria Ràpida', 89]];
  for (const [i, cat, con, prov, imp] of mant) {
    const mm = Math.max(1, M - 1 - (i % 6)); const f = iso(Y, mm, 8 + i);
    const factura = await doc(pdfSimple('Factura ' + prov, [con, 'Importe: ' + imp + ' euros']), { propiedadId: ids[i].id, tipo: 'factura', nombre: con + ' · factura', fecha: f });
    await put('gastos', { propiedadId: ids[i].id, categoria: cat, concepto: con, proveedor: prov, importe: imp, fecha: f, estado: 'pagado', docId: factura.id });
  }
  await put('gastos', { propiedadId: ids[1].id, categoria: 'Mantenimiento', concepto: 'Revisión ITE (presupuesto aceptado)', proveedor: 'Arquitectes Associats', importe: 260, fecha: iso(Y, M, Math.min(28, D + 6)), estado: 'pendiente' });
  const notas = [[1, 'Llama para decir que este mes y el anterior pagará tarde por un problema con la nómina.', 'Cobro'], [5, 'Le he enviado tres recordatorios por WhatsApp. No contesta. Valorar burofax.', 'Cobro'],
    [0, 'La caldera hace ruido. Técnico avisado.', 'Incidencia'], [4, 'Nueva inquilina entra el 1 de marzo. Entregadas 2 copias de llaves.', 'Contrato'], [6, 'Pide permiso para poner toldo en la terraza. Dicho que sí.', ''], [3, 'Pregunta si puede ampliar horario: no afecta al contrato.', '']];
  for (const [i, t, e] of notas) await put('notas', { propiedadId: ids[i].id, fecha: iso(Y, Math.max(1, M - (i % 4)), 3 + i), texto: t, etiqueta: e });
}

/* ---------- Admon. Fincas ---------- */

const PROPIETARIOS = ['Josep Martí Riba', 'Rosa Ferrer Coll', 'Antonio García López', 'Mercè Vila Bosch', 'Francesc Soler Puig', 'Isabel Moreno Díaz', 'Joan Prat Roca', 'Carmen Jiménez Ruiz', 'Xavier Pons Mas',
  'Teresa Serra Font', 'Manuel Romero Gil', 'Pilar Casas Vidal', 'Ramon Torres Sala', 'Dolores Navarro Ortega', 'Albert Riera Camps', 'Silvia Martín Sanz', 'Jaume Costa Pujol', 'Gemma Bosch Ferrer', 'Ángel Ruiz Moya', 'Neus Pujol Vila'];

export async function cargarPruebaFincas() {
  const hoy = hoyISO(), Y = Number(hoy.slice(0, 4)), M = Number(hoy.slice(5, 7)), D = Number(hoy.slice(8, 10));
  const coms = [
    { nombre: 'C/ Montserrat, 42', direccion: 'C/ Montserrat, 42', localidad: '08201 Sabadell', cif: 'H65000042', iban: 'ES12 2100 0042 1100 0000 4242', presidente: 'Rosa Ferrer Coll', periodicidad: 'mensual', presupuesto: 6200,
      pisos: ['Baixos 1', 'Baixos 2', '1º 1ª', '1º 2ª', '2º 1ª', '2º 2ª', '3º 1ª', '3º 2ª'], coefs: [9.5, 8.5, 13, 12, 13, 12, 16.5, 15.5], morosos: { 4: 3, 7: 1 }, derrama: true, saldo: 4120.35, fondo: 960, ascensor: true },
    { nombre: 'Av. Rambla, 118', direccion: 'Av. Rambla, 118', localidad: '08221 Terrassa', cif: 'H65000118', iban: 'ES34 0081 0118 0000 0118 1180', presidente: 'Albert Riera Camps', periodicidad: 'mensual', presupuesto: 8400,
      pisos: ['Local 1', 'Local 2', '1º 1ª', '1º 2ª', '1º 3ª', '2º 1ª', '2º 2ª', '2º 3ª', '3º 1ª', '3º 2ª', '3º 3ª', 'Àtic'], coefs: [11, 9, 7.5, 7, 7.5, 7.5, 7, 7.5, 7.5, 7, 7.5, 13], morosos: { 1: 6 }, derrama: false, saldo: 7890.6, fondo: 1800, ascensor: true },
    { nombre: 'Pg. del Parc, 7', direccion: 'Pg. del Parc, 7', localidad: '08192 Sant Quirze del Vallès', cif: 'H65000007', iban: 'ES56 0182 0007 0000 0007 0707', presidente: 'Jaume Costa Pujol', periodicidad: 'trimestral', presupuesto: 3600,
      pisos: ['Baixos', '1º', '2º', '3º', '4º', '5º'], coefs: [18, 16.5, 16.5, 16.5, 16.5, 16], morosos: {}, derrama: false, saldo: 1630.1, fondo: 420, ascensor: false },
  ];
  let np = 0;
  // Agenda de proveedores (común)
  const PROV = {};
  const datosProv = { 'Endesa': ['Electricidad / luz', '800 760 909'], 'Aigües de Sabadell': ['Agua', '937 289 300'], 'Neteges Vallès SL': ['Limpieza', '937 112 233'], 'Ascensores Orona': ['Ascensor', '900 100 456'],
    'Mapfre Comunidades': ['Seguro', '918 365 365'], 'Administración de fincas': ['Administración', ''], 'Desembussos 24h': ['Fontanería', '600 112 233'], 'Electricitat Pons': ['Electricista', '937 445 566'],
    'Serralleria Ràpida': ['Cerrajería', '650 778 899'], 'Extintors Vallès': ['Extintores / PCI', '937 223 344'], 'Bastides Vallès': ['Obras / construcción', '937 990 011'], 'Construccions Martí': ['Obras / construcción', '937 880 022'], 'Arquitectes Associats': ['Arquitecto / técnico', '932 001 122'] };
  const provId = async (nombre) => { if (!PROV[nombre]) { const [servicio, telefono] = datosProv[nombre] || ['Otros', ''];
    PROV[nombre] = (await put('f_proveedores', { nombre, servicio, telefono, email: telefono ? nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@example.com' : '', nif: telefono ? 'B' + (60000000 + Object.keys(PROV).length * 7771) : '' })).id; } return PROV[nombre]; };
  const presidencia = [['1º 1ª', '611 223 344', 'rosa.ferrer@example.com'], ['Àtic', '622 334 455', 'albert.riera@example.com'], ['3º', '633 445 566', 'jaume.costa@example.com']];
  const caract = [{ ascensor: true, trasteros: true, plantas: '4', anio: '1978', otras: 'Contador de agua general. Acceso adaptado en el portal.' }, { ascensor: true, garaje: true, locales: true, antena: true, plantas: '5', anio: '1992', otras: 'Garaje con puerta automática (mantenimiento anual).' }, { jardin: true, calefaccion: false, plantas: '6', anio: '1969', otras: 'Patio interior comunitario.' }];
  for (const [ic, cd] of coms.entries()) {
    const div = cd.periodicidad === 'trimestral' ? 4 : 12;
    const com = await put('f_comunidades', { nombre: cd.nombre, direccion: cd.direccion, localidad: cd.localidad, cif: cd.cif, iban: cd.iban, banco: '', presidente: cd.presidente, presidentePiso: presidencia[ic][0], presidenteTel: presidencia[ic][1], presidenteEmail: presidencia[ic][2], presidenteHasta: iso(Y + 1, 3, 31), secretario: 'El administrador', caracteristicas: caract[ic],
      presupuesto: cd.presupuesto, periodicidad: cd.periodicidad, diaCobro: 10, fondoReserva: cd.fondo, saldosBanco: [{ fecha: `${Y - 2}-12-31`, importe: r2(cd.saldo * 0.85), origen: 'Manual', nota: 'Extracto de fin de año' }, { fecha: `${Y - 1}-12-31`, importe: cd.saldo, origen: 'Manual', nota: 'Extracto de fin de año' }, { fecha: iso(Y, M, Math.max(1, D - 4)), importe: r2(cd.saldo + 600 + r() * 900), origen: 'Manual' }], cobrosDesde: `${Y - 1}-01`, idioma: np % 2 ? 'es' : 'ca', normativa: 'Codi civil de Catalunya', notas: 'Comunidad de prueba con datos inventados.' });
    const partidasDe = (k) => { const n = cd.pisos.length; const l = [['Electricidad', 'coef', 12 * (cd.ascensor ? 105 : 45)], ['Limpieza', 'iguales', 12 * (n > 10 ? 260 : 150)], ...(cd.ascensor ? [['Ascensor', 'coef', 4 * 345.8]] : []), ['Agua', 'coef', 4 * 35], ['Seguro', 'coef', n * 95], ['Honorarios de administración', 'iguales', 4 * n * 18], ['Mantenimiento y reparaciones', 'coef', 500]];
      const suma = l.reduce((a, x) => a + x[2], 0); if (cd.presupuesto > suma) l.push(['Fondo de reserva', 'coef', cd.presupuesto - suma]);
      return l.map(([partida, grupo, imp]) => ({ partida, grupo, importe: r2(imp * k) })); };
    await db.put('f_comunidades', { ...com, presupuestos: { [Y - 1]: partidasDe(0.95), [Y]: partidasDe(1) } });
    const vs = [];
    for (const [i, piso] of cd.pisos.entries()) {
      const nombre = PROPIETARIOS[np++ % PROPIETARIOS.length];
      const base = r2(cd.presupuesto * 0.95 * cd.coefs[i] / 100 / div), nueva = r2(cd.presupuesto * cd.coefs[i] / 100 / div);
      const v = await put('f_vecinos', { comunidadId: com.id, piso, orden: i, propietario: nombre, dni: `${30000000 + np * 5113}${'TRWAGMYFPDXBNJZSQVHLCKE'[np % 23]}`, telefono: '6' + String(20000000 + np * 2345671).slice(0, 8),
        email: nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + np + '@example.com', idioma: np % 3 ? 'ca' : 'es', avisosEmail: np % 4 !== 0, formaPago: i % 3 === 2 ? 'Transferencia' : 'Domiciliado',
        iban: `ES91 2100 ${String(1000 + np).padStart(4, '0')} 0000 0000 ${String(np * 53).padStart(4, '0')}`, titular: nombre, coef: cd.coefs[i], cuota: nueva, cuotaHistorial: [{ desde: `${Y - 1}-01`, importe: base }, { desde: `${Y}-01`, importe: nueva }],
        ocupante: i % 4 === 1 ? 'Inquilino de prueba' : '', saldoAnterior: 0, obs: i === 0 && piso.startsWith('Local') ? 'Local comercial: no usa ascensor.' : '' });
      if (ic === 0 && i === 5) { // Cambio de propietario este año
        Object.assign(v, { propietarioDesde: iso(Y, 3, 15), historialPropietarios: [{ propietario: 'Pere Grau Solà', dni: '38123456K', telefono: '644 556 677', email: 'pere.grau@example.com', iban: 'ES91 2100 9999 0000 0000 1234', desde: iso(Y - 9, 6, 1), hasta: iso(Y, 3, 15), pendiente: 0, detallePendiente: '', nota: 'Venta ante la notaria de Sabadell. Certificado de deudas emitido el ' + fecha(iso(Y, 3, 1)) + ' (sin deudas).' }], propietariosAnteriores: ['Pere Grau Solà'] });
        await db.put('f_vecinos', v);
      }
      vs.push(v);
    }
    // Cuotas cobradas
    for (const [i, v] of vs.entries()) {
      const debe = cd.morosos[i] || 0;
      for (const y of [Y - 1, Y]) for (let m = 1; m <= 12; m++) {
        if (div === 4 && ![1, 4, 7, 10].includes(m)) continue;
        if (y === Y && (m > M || (m === M && D < 12))) continue;
        const nMes = (Y - y) * 12 + (M - m);
        if (debe && nMes < debe * (div === 4 ? 3 : 1)) continue;
        const imp = v.cuotaHistorial.filter(h => h.desde <= ym(y, m)).pop().importe;
        const dia = v.formaPago === 'Domiciliado' ? 5 : 3 + Math.floor(r() * 20);
        await put('f_cobros', { comunidadId: com.id, vecinoId: v.id, concepto: 'cuota', anio: y, mes: m, importe: imp, fecha: iso(y, m, dia), forma: v.formaPago === 'Domiciliado' ? 'Recibo domiciliado' : 'Transferencia' });
      }
    }
    // Gastos ordinarios
    const prov = { llum: 'Endesa', aigua: 'Aigües de Sabadell', neteja: 'Neteges Vallès SL', asc: 'Ascensores Orona', seg: 'Mapfre Comunidades', admin: 'Administración de fincas' };
    for (const y of [Y - 1, Y]) for (let m = 1; m <= 12; m++) {
      if (y === Y && m > M) break;
      const g = async (dd, concepto, proveedor, importe, grupo = 'coef', partida = '') => { const f = iso(y, m, dd); if (f > hoy) return null; return put('f_gastos', { comunidadId: com.id, fecha: f, concepto, proveedor, proveedorId: await provId(proveedor), partida, importe: r2(importe), grupo, estado: 'pagado' }); };
      const MES = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'][m - 1];
      await g(4, `Llum escala ${MES}`, prov.llum, (cd.ascensor ? 85 : 32) + r() * 25, 'coef', 'Electricidad');
      await g(10, `Neteja escala ${MES}`, prov.neteja, cd.pisos.length > 10 ? 260 : 150, 'iguales', 'Limpieza');
      if (cd.ascensor && m % 3 === 1) await g(12, `Manteniment ascensor ${Math.ceil(m / 3)}T`, prov.asc, 345.8, 'coef', 'Ascensor');
      if (m % 3 === 2) await g(15, `Aigua comunitària ${Math.ceil(m / 3)}T`, prov.aigua, 28 + r() * 12, 'coef', 'Agua');
      if (m % 3 === 0) await g(28, `Honoraris administració ${Math.ceil(m / 3)}T`, prov.admin, cd.pisos.length * 18, 'iguales', 'Honorarios de administración');
      if (m === 6) await g(3, `Assegurança multirisc ${y}`, prov.seg, cd.pisos.length * 95, 'coef', 'Seguro');
    }
    const extra = [[Y - 1, 4, 'Desembussament baixant', 'Desembussos 24h', 165], [Y - 1, 11, 'Canvi bombetes i fluorescents', 'Electricitat Pons', 92.4], [Y, Math.max(1, M - 3), 'Reparació porta d\'entrada', 'Serralleria Ràpida', 238.5]];
    for (const [y, m, c, p, imp] of extra) await put('f_gastos', { comunidadId: com.id, fecha: iso(y, m, 14), concepto: c, proveedor: p, proveedorId: await provId(p), partida: 'Mantenimiento y reparaciones', importe: imp, grupo: 'coef', estado: 'pagado' });
    await put('f_gastos', { comunidadId: com.id, fecha: iso(Y, M, Math.min(28, D + 5)), concepto: 'Revisió extintors', proveedor: 'Extintors Vallès', proveedorId: await provId('Extintors Vallès'), partida: 'Mantenimiento y reparaciones', importe: 96.8, grupo: 'coef', estado: 'pendiente' });
    // Cartas: una reclamación en Montserrat y un aviso general en la Rambla
    if (ic === 0) { const m = CARTAS_BASE.fin.find(x => x.id === 'f-reclamacion'); const f = iso(Y, M, Math.max(1, D - 10));
      await put('f_cartas', { comunidadId: com.id, fecha: f, idiomaModo: 'cada', destinatarios: [vs[4].id], asunto: m.asunto, cuerpo: m.cuerpo, envios: { [vs[4].id]: { fecha: f, via: 'Entregada' } } }); }
    if (ic === 1) { const m = CARTAS_BASE.fin.find(x => x.id === 'f-aviso');
      await put('f_cartas', { comunidadId: com.id, fecha: iso(Y, M, Math.max(1, D - 3)), idiomaModo: 'cada', destinatarios: vs.map(v => v.id),
        asunto: { es: 'Revisión anual del ascensor', ca: "Revisió anual de l'ascensor" },
        cuerpo: { es: '<p>Estimados vecinos:</p><p>Les informamos de que el próximo jueves, de 9 a 13 horas, se realizará la <b>revisión anual del ascensor</b>. Durante ese tiempo el ascensor no estará disponible.</p><p>Disculpen las molestias.</p><p>Atentamente,</p>',
          ca: "<p>Benvolguts veïns:</p><p>Us informem que el proper dijous, de 9 a 13 hores, es farà la <b>revisió anual de l'ascensor</b>. Durant aquest temps l'ascensor no estarà disponible.</p><p>Disculpeu les molèsties.</p><p>Atentament,</p>" }, envios: {} }); }
    // Juntas: la ordinaria del año que viene ya convocada y, en Montserrat, la extraordinaria de la fachada ya celebrada
    const fj = new Date(Y, M - 1, D + 16); const fjIso = iso(fj.getFullYear(), fj.getMonth() + 1, fj.getDate());
    await put('f_juntas', { comunidadId: com.id, tipo: 'ordinaria', fecha: fjIso, hora: '19:00', hora2: '', lugar: ic === 1 ? 'el local social de la comunidad (planta baja)' : 'el vestíbulo de la finca', fechaEmision: hoy, puntos: ordenPorDefecto('ordinaria', Y + 1), nota: { es: '', ca: '' } });
    if (cd.derrama) await put('f_juntas', { comunidadId: com.id, tipo: 'extraordinaria', fecha: iso(Y, Math.max(1, M - 6), 20), hora: '19:30', hora2: '', lugar: 'el vestíbulo de la finca', fechaEmision: iso(Y, Math.max(1, M - 6), 5),
      puntos: [{ es: 'Aprobación, si procede, del presupuesto de rehabilitación de la fachada y de la derrama correspondiente.', ca: "Aprovació, si escau, del pressupost de rehabilitació de la façana i de la derrama corresponent." }, { es: 'Forma de pago de la derrama.', ca: 'Forma de pagament de la derrama.' }], envios: Object.fromEntries(vs.map(v => [v.id, { fecha: iso(Y, Math.max(1, M - 6), 6), via: 'Entregada' }])),
      acta: { idioma: 'ca', horaInicio: '19:30', horaFin: '21:05', preside: cd.presidente, secretario: 'El administrador', sinVoto: [],
        asistencia: Object.fromEntries(vs.map((v, i) => [v.id, { estado: i === 3 ? 'representado' : i === 6 || i === 7 ? 'ausente' : 'presente', representante: i === 3 ? 'Rosa Ferrer Coll' : '' }])),
        acuerdos: [{ texto: "<p>S'han presentat tres pressupostos. La junta escull el de <b>Construccions Martí</b> per un import total de 18.000 € (bastida, reparació, pintura i direcció d'obra), que es repartirà per coeficient.</p>", resultado: 'mayoria', votos: Object.fromEntries(vs.map((v, i) => [v.id, i === 4 ? 'c' : i === 5 ? 'a' : 'f'])) },
          { texto: '<p>La derrama es pagarà en <b>tres terminis</b> bimestrals, el primer al mes següent de la junta.</p>', resultado: 'unanimidad', votos: null }], ruegos: '<p>El veí del 2n 2a demana que es revisi la il·luminació de l\'escala. Es tindrà en compte.</p>' } });
    // Derrama de obras en tres plazos
    if (cd.derrama) {
      const m0 = Math.max(1, M - 5);
      const der = await put('f_derramas', { comunidadId: com.id, concepto: 'Rehabilitació de façana', total: 18000, reparto: 'coef', cada: 2, fechaJunta: iso(Y, Math.max(1, m0 - 1), 20),
        plazos: [0, 1, 2].map(k => { const dt = new Date(Y, m0 - 1 + k * 2, 1); return { mes: ym(dt.getFullYear(), dt.getMonth() + 1) }; }),
        presupuesto: [{ partida: 'Bastida', importe: 4200 }, { partida: 'Reparació de façana', importe: 8900 }, { partida: 'Pintura', importe: 3600 }, { partida: 'Direcció d\'obra (arquitecte)', importe: 1300 }] });
      for (const [k, pl] of der.plazos.entries()) {
        if (pl.mes > ym(Y, M)) continue;
        for (const [i, v] of vs.entries()) {
          if ((i === 4 && k >= 1) || (i === 2 && k === 2)) continue;
          const [py, pm] = pl.mes.split('-').map(Number);
          await put('f_cobros', { comunidadId: com.id, vecinoId: v.id, concepto: 'derrama', derramaId: der.id, plazo: k, importe: r2(18000 * v.coef / 100 / 3), fecha: iso(py, pm, 8 + i), anio: py, mes: pm, forma: 'Transferencia' });
        }
      }
      const pagos = [[0, 'Bastida · primer pagament', 'Bastides Vallès', 2100], [1, 'Bastida · segon pagament', 'Bastides Vallès', 2100], [1, 'Reparació de façana · certificació 1', 'Construccions Martí', 4450], [2, 'Direcció d\'obra', 'Arquitectes Associats', 650]];
      for (const [k, c, p, imp] of pagos) { const [py, pm] = der.plazos[k].mes.split('-').map(Number); const f = iso(py, pm, 22); if (f <= hoy) await put('f_gastos', { comunidadId: com.id, fecha: f, concepto: c, proveedor: p, proveedorId: await provId(p), importe: imp, grupo: 'derrama', derramaId: der.id, estado: 'pagado' }); }
    }
  }
}

/* ---------- Cargar y borrar ---------- */

export async function cargarPrueba() {
  await cargarPruebaPatrimonio();
  await cargarPruebaFincas();
}

export async function hayPrueba() {
  const [a, b] = await Promise.all([db.all('propiedades'), db.all('f_comunidades')]);
  return a.some(x => x.prueba) || b.some(x => x.prueba);
}

export const modoPrueba = () => /[?&]prueba\b/.test(location.search);

export async function borrarPrueba() {
  let n = 0;
  // Movimientos del extracto de prueba y lo que se creó al conciliarlos
  const movPrueba = new Set();
  for (const st of ['banco', 'f_banco']) for (const m of await db.all(st)) if (m.archivo === 'extracto_prueba.csv') { movPrueba.add(m.id); await db.del(st, m.id); n++; }
  if (movPrueba.size) for (const st of ['pagos', 'gastos', 'f_cobros', 'f_gastos']) for (const o of await db.all(st)) if (o.banco && movPrueba.has(o.banco) && !o.prueba) { await db.del(st, o.id); n++; }
  for (const s of STORES.concat(STORES_FIN)) {
    if (s === 'ajustes') continue;
    for (const it of await db.all(s)) if (it.prueba) { await db.del(s, it.id); n++; }
  }
  return n;
}

/* ---------- Extracto bancario de prueba (CSV como el de un banco) ---------- */
// Se genera a partir de los datos de prueba actuales, para probar la conciliación de principio a fin.
export async function extractoPrueba(mod, comunidadId) {
  const { estadoMes } = await import('./calc.js');
  const F = await import('./fincas/calc.js');
  const hoy = hoyISO(); const movs = [];
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  if (mod === 'pat') {
    const [contratos, inqs, pagos, gastos] = await Promise.all([db.all('contratos'), db.all('inquilinos'), db.all('pagos'), db.all('gastos')]);
    let n = 2;
    for (const k of contratos.filter(x => x.estado !== 'finalizado' && x.prueba)) {
      const i = inqs.find(x => x.id === k.inquilinoId) || {};
      for (let y = Number(hoy.slice(0, 4)) - 1; y <= Number(hoy.slice(0, 4)); y++) for (let m = 1; m <= 12; m++) {
        const e = estadoMes(k, pagos, y, m, 'renta');
        if (e.estado === 'debe' && !movs.some(x => x.k === k.id)) movs.push({ k: k.id, fecha: dia(n++), concepto: `TRANSFERENCIA DE ${String(i.nombre || '').toUpperCase()} CONCEPTO ALQUILER`, importe: e.esp - e.pag });
      }
    }
    gastos.filter(g => g.prueba && g.estado === 'pagado' && g.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 3).forEach(g => movs.push({ fecha: g.fecha, concepto: `RECIBO ${String(g.proveedor || g.concepto).toUpperCase()}`, importe: -g.importe }));
    movs.push({ fecha: dia(1), concepto: 'COMISION MANTENIMIENTO CUENTA', importe: -6 });
  } else {
    const [com, vecinos, cobros, gastos, derramas, provs] = await Promise.all([db.get('f_comunidades', comunidadId), db.all('f_vecinos'), db.all('f_cobros'), db.all('f_gastos'), db.all('f_derramas'), db.all('f_proveedores')]);
    const vs = vecinos.filter(v => v.comunidadId === comunidadId); const d = { vecinos, cobros };
    let n = 2;
    for (const v of vs) {
      for (let y = Number(hoy.slice(0, 4)) - 1; y <= Number(hoy.slice(0, 4)); y++) for (let m = 1; m <= 12; m++) {
        const e = F.estadoCuota(com, v, cobros, y, m);
        if (e.estado === 'debe' && !movs.some(x => x.v === v.id)) movs.push({ v: v.id, fecha: dia(n++), concepto: `TRANSF ${String(v.propietario).toUpperCase()} QUOTA COMUNITAT`, importe: e.esp - e.pag });
      }
      derramas.filter(x => x.comunidadId === comunidadId).forEach(der => (der.plazos || []).forEach((pl, i) => { if (pl.mes > hoy.slice(0, 7)) return; const falta = F.parteDerrama(der, v, vs) / der.plazos.length - F.cobradoDerrama(cobros, v.id, der.id, i).imp;
        if (falta > 0.01 && !movs.some(x => x.dv === v.id)) movs.push({ dv: v.id, fecha: dia(n++), concepto: `TRANSF ${String(v.propietario).toUpperCase()} DERRAMA FACANA`, importe: Math.round(falta * 100) / 100 }); }));
    }
    gastos.filter(g => g.comunidadId === comunidadId && g.estado === 'pagado' && g.fecha <= hoy && g.grupo !== 'derrama').sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 3).forEach(g => movs.push({ fecha: g.fecha, concepto: `RECIBO ${String(g.proveedor || g.concepto).toUpperCase()}`, importe: -g.importe }));
    const end = provs.find(p => p.nombre === 'Endesa'); if (end) movs.push({ fecha: dia(1), concepto: 'ADEUDO ENDESA ENERGIA SAU FACTURA LUZ', importe: -97.35 });
    movs.push({ fecha: dia(1), concepto: 'COMISION MANTENIMIENTO', importe: -4.5 });
  }
  movs.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  let saldo = 8000; const fmt = (n) => n.toFixed(2).replace('.', ',');
  const lineas = ['Fecha operación;Fecha valor;Concepto;Importe;Saldo'];
  movs.forEach(m => { saldo += m.importe; const f = m.fecha.split('-').reverse().join('/'); lineas.push(`${f};${f};${m.concepto};${fmt(m.importe)};${fmt(saldo)}`); });
  return '﻿' + lineas.join('\r\n');
}
