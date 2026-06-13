// Migra datos del Excel (data.xlsx) a Supabase PostgreSQL
// Ejecutar UNA sola vez: node migrate.js
require('dotenv').config();
const XLSX   = require('xlsx');
const path   = require('path');
const fs     = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const DB_FILE  = path.join(__dirname, 'data.xlsx');

function fromSheet(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }).map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)]))
  );
}

async function insert(table, rows) {
  if (!rows.length) { console.log(`  ${table}: sin datos, saltando`); return; }
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} filas insertadas`);
}

async function migrate() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('No se encontró data.xlsx — nada que migrar');
    return;
  }

  console.log('Leyendo data.xlsx...');
  const wb = XLSX.readFile(DB_FILE);

  // Usuarios
  const usuarios = fromSheet(wb.Sheets['Usuarios']).map(u => ({
    id: u.id, name: u.name, email: u.email, password: u.password,
    role: u.role, phone: u.phone || '', property: u.property || '-', condo: u.condo || 'General',
  }));
  await insert('usuarios', usuarios);

  // Condominios
  const condominios = fromSheet(wb.Sheets['Condominios']).map(c => ({
    id: c.id, name: c.name, type: c.type || 'Condominio',
    address: c.address || '', units: c.units || '0', plan: c.plan || 'Básico',
  }));
  await insert('condominios', condominios);

  // Propiedades
  const propiedades = fromSheet(wb.Sheets['Propiedades']).map(p => ({
    id: p.id, condo: p.condo, code: p.code, street: p.street,
    block: p.block || '', owner: p.owner, tenant: p.tenant || '-',
    debt: Number(p.debt) || 0,
  }));
  await insert('propiedades', propiedades);

  // Pagos
  const pagos = fromSheet(wb.Sheets['Pagos']).map(p => ({
    id: p.id, propiedad: p.propiedad || '', propietario: p.propietario || '',
    resident: p.resident || '', unit: p.unit || '', tipo: p.tipo || 'Expensa',
    monto: Number(p.monto) || 0, fecha: p.fecha || '', estado: p.estado || 'pendiente',
    referencia: p.referencia || '', comprobante: p.comprobante || '',
    due_date: p.dueDate || '', created_by_role: p.createdByRole || '',
  }));
  await insert('pagos', pagos);

  // Anuncios
  const anuncios = fromSheet(wb.Sheets['Anuncios']).map(a => ({
    id: a.id, title: a.title, message: a.message || a.content || '',
    condo: a.condo || 'General', target: a.target || 'todos',
    created_by_role: a.createdByRole || '', date_label: a.dateLabel || a.date || '',
    author: a.author || '', category: a.category || 'General', priority: a.priority || 'Media',
  }));
  await insert('anuncios', anuncios);

  // Asambleas
  const asambleas = fromSheet(wb.Sheets['Asambleas']).map(a => {
    let userVotes = {};
    try { userVotes = JSON.parse(a.userVotesJSON || '{}'); } catch {}
    return {
      id: a.id, title: a.title, description: a.description || '',
      condo: a.condo || 'General', start_date: a.startDate || '',
      due_date: a.dueDate || '', document_name: a.documentName || '',
      document_path: a.documentPath || '', created_at: a.createdAt || '',
      votes_yes:        Number(a.votesYes)        || 0,
      votes_no:         Number(a.votesNo)         || 0,
      votes_abstencion: Number(a.votesAbstencion) || 0,
      user_votes: userVotes,
    };
  });
  await insert('asambleas', asambleas);

  // Visitas
  const visitas = fromSheet(wb.Sheets['Visitas']).map(v => ({
    id: v.id, code: v.code, mode: v.mode || 'peatonal',
    full_name: v.fullName || '', id_number: v.idNumber || '',
    property: v.property || '', motive: v.motive || '', plate: v.plate || '-',
    id_document_name: v.idDocumentName || '', plate_photo_name: v.platePhotoName || '',
    created_by: v.createdBy || '', created_at: v.createdAt || '', status: v.status || 'Activo',
  }));
  await insert('visitas', visitas);

  // Historial
  const historial = fromSheet(wb.Sheets['Historial']).map(h => ({
    id: h.id, visitante: h.visitante || '', cedula: h.cedula || '',
    propiedad: h.propiedad || '', tipo: h.tipo || 'Entrada', placa: h.placa || '-',
    fecha: h.fecha || '', entrada: h.entrada || '', salida: h.salida || '-',
    motivo: h.motivo || '', guard: h.guard || '',
  }));
  await insert('historial_visitas', historial);

  // Panic Alerts
  const panico = fromSheet(wb.Sheets['Panico']).map(p => ({
    id: p.id, resident: p.resident || '', phone: p.phone || '',
    address: p.address || '', unit: p.unit || '',
    status: p.status || 'Pendiente', created_at: p.createdAt || '',
  }));
  await insert('panic_alerts', panico);

  console.log('\n✅ Migración completada exitosamente');
}

migrate().catch(e => { console.error('❌ Error en migración:', e.message); process.exit(1); });
