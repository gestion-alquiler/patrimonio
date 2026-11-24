// Datos de ejemplo para probar la app sin teclear nada
import { db } from './db.js';

export async function cargarEjemplo() {
  const y = new Date().getFullYear(), mHoy = new Date().getMonth() + 1;
  const iso = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const p1 = await db.put('propiedades', { direccion: 'C/ Real 45, 1º (ejemplo)', zona: 'Ensanche', tipo: 'Piso', m2: 92, habitaciones: 3, fechaCompra: '2015-03-12', precioCompra: 150000, gastosCompra: 15000, valorActual: 210000, comunidadAdmin: 'Fincas Ejemplo', seguro: 'Aseguradora Ejemplo', seguroVence: iso(y + 1, 3, 1) });
  const p2 = await db.put('propiedades', { direccion: 'C/ Mayor 12, 2ºB (ejemplo)', zona: 'Centro', tipo: 'Piso', m2: 78, habitaciones: 2, fechaCompra: '2018-06-01', precioCompra: 120000, gastosCompra: 12000 });
  await db.put('propiedades', { direccion: 'C/ Sol 5, local (ejemplo)', zona: 'Centro', tipo: 'Local', m2: 55 });
  const i1 = await db.put('inquilinos', { nombre: 'Marcos Herrera (ejemplo)', telefono: '600000000', email: 'marcos@example.com', idioma: 'es' });
  const i2 = await db.put('inquilinos', { nombre: 'Laura Gómez (ejemplo)', telefono: '600000001', idioma: 'ca' });
  const c1 = await db.put('contratos', { propiedadId: p1.id, inquilinoId: i1.id, inicio: iso(y - 2, 12, 1), fin: iso(y + 2, 11, 30), renta: 720, diaPago: 5, actualizacion: 'IRAV', mesActualizacion: 12, fianza: 1440, fianzaDeposito: 'Organismo autonómico', basuraPaga: 'inquilino', basuraImporte: 35, estado: 'activo', cobrosDesde: `${y}-01` });
  const c2 = await db.put('contratos', { propiedadId: p2.id, inquilinoId: i2.id, inicio: iso(y - 1, 3, 1), fin: iso(y, Math.min(12, mHoy + 3), 28), renta: 650, diaPago: 5, actualizacion: 'IRAV', mesActualizacion: 3, fianza: 650, basuraPaga: 'propietario', estado: 'activo', cobrosDesde: `${y}-01` });
  for (let m = 1; m < mHoy; m++) {
    await db.put('pagos', { contratoId: c1.id, propiedadId: p1.id, anio: y, mes: m, concepto: 'renta', importe: 720, fecha: iso(y, m, 3), forma: 'Transferencia' });
    if (m !== mHoy - 2) await db.put('pagos', { contratoId: c1.id, propiedadId: p1.id, anio: y, mes: m, concepto: 'basura', importe: 35, fecha: iso(y, m, 3), forma: 'Transferencia' });
    if (m < mHoy - 1) await db.put('pagos', { contratoId: c2.id, propiedadId: p2.id, anio: y, mes: m, concepto: 'renta', importe: 650, fecha: iso(y, m, 4), forma: 'Bizum' });
  }
  for (let m = 1; m <= 12; m++) {
    await db.put('gastos', { propiedadId: p1.id, categoria: 'Comunidad', concepto: 'Cuota de comunidad', proveedor: 'Comunidad de propietarios', importe: 40, fecha: iso(y, m, 5), estado: m < mHoy ? 'pagado' : 'pendiente' });
  }
  await db.put('gastos', { propiedadId: p1.id, categoria: 'IBI', concepto: 'IBI ' + y, proveedor: 'Ayuntamiento', importe: 380.4, fecha: iso(y, Math.max(1, mHoy - 1), 15), estado: 'pagado' });
  await db.put('gastos', { propiedadId: p1.id, categoria: 'Mantenimiento', concepto: 'Reparación caldera', proveedor: 'Técnico', importe: 145.2, fecha: iso(y, Math.max(1, mHoy - 1), 18), estado: 'pagado' });
  await db.put('gastos', { propiedadId: p2.id, categoria: 'Seguro', concepto: 'Seguro de hogar', proveedor: 'Aseguradora', importe: 180, fecha: iso(y, 2, 10), estado: 'pagado' });
  await db.put('notas', { propiedadId: p1.id, fecha: iso(y, Math.max(1, mHoy - 1), 18), texto: 'Avisa de que la caldera no enciende. Técnico vino el mismo día.', etiqueta: 'Incidencia' });
}
