const XLSX  = require('xlsx');
const bcrypt = require('bcryptjs');
const path  = require('path');
const fs    = require('fs');
const SEED  = require('./seed');

const DB_FILE     = path.join(__dirname, '../../data.xlsx');
const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

// ── Sheet helpers ─────────────────────────────────────────────
function toSheet(rows, widths) {
  if (!rows || rows.length === 0) return XLSX.utils.aoa_to_sheet([[]]);
  const ws = XLSX.utils.json_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}

function fromSheet(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }).map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)]))
  );
}

// ── Tokens (temporary data — stored in JSON, not Excel) ───────
function readTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

// ── Read ──────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const db = JSON.parse(JSON.stringify(SEED));
    writeDB(db);
    return db;
  }

  try {
    const wb = XLSX.readFile(DB_FILE);

    const usuarios = fromSheet(wb.Sheets['Usuarios']).map(u => ({
      ...u,
      password: u.password && !u.password.startsWith('$2')
        ? bcrypt.hashSync(u.password, 10)
        : u.password,
    }));

    const asambleas = fromSheet(wb.Sheets['Asambleas']).map(a => ({
      ...a,
      votes: {
        favor:      Number(a.votesYes)        || 0,
        contra:     Number(a.votesNo)         || 0,
        abstencion: Number(a.votesAbstencion) || 0,
      },
      userVotes: (() => { try { return JSON.parse(a.userVotesJSON || '{}'); } catch { return {}; } })(),
      startDate:    a.startDate    || '',
      createdAt:    a.createdAt    || '',
      documentPath: a.documentPath || '',
    }));

    return {
      usuarios,
      condominios:      fromSheet(wb.Sheets['Condominios']),
      propiedades:      fromSheet(wb.Sheets['Propiedades']).map(p => ({ ...p, debt: Number(p.debt) || 0 })),
      pagos:            fromSheet(wb.Sheets['Pagos']).map(p => ({ ...p, monto: Number(p.monto) || 0 })),
      anuncios:         fromSheet(wb.Sheets['Anuncios']),
      asambleas,
      visitas:          fromSheet(wb.Sheets['Visitas']),
      historialVisitas: fromSheet(wb.Sheets['Historial']),
      panicAlerts:      fromSheet(wb.Sheets['Panico']),
      resetTokens:      readTokens(),
    };
  } catch (e) {
    console.error('Error leyendo Excel:', e.message);
    return JSON.parse(JSON.stringify(SEED));
  }
}

// ── Write ─────────────────────────────────────────────────────
function writeDB(data) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, toSheet(
    data.usuarios.map(u => ({ id: u.id, name: u.name, email: u.email, password: u.password, role: u.role, phone: u.phone, property: u.property, condo: u.condo })),
    [38, 22, 32, 68, 15, 16, 32, 20]
  ), 'Usuarios');

  XLSX.utils.book_append_sheet(wb, toSheet(
    data.condominios.map(c => ({ id: c.id, name: c.name, type: c.type, address: c.address || '', units: c.units || '', plan: c.plan || '' })),
    [38, 26, 14, 32, 10, 12]
  ), 'Condominios');

  XLSX.utils.book_append_sheet(wb, toSheet(
    [...(data.propiedades || [])].sort((a, b) => (a.condo || '').localeCompare(b.condo || '')).map(p => ({
      id: p.id, condo: p.condo, code: p.code, street: p.street, block: p.block,
      owner: p.owner, tenant: p.tenant || '-', debt: p.debt || 0,
    })),
    [38, 22, 10, 26, 8, 22, 22, 10]
  ), 'Propiedades');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.pagos || []).map(p => ({
      id: p.id, propiedad: p.propiedad, propietario: p.propietario,
      tipo: p.tipo, monto: p.monto, fecha: p.fecha, estado: p.estado,
      referencia: p.referencia || '', comprobante: p.comprobante || '',
      resident: p.resident || '', unit: p.unit || '', dueDate: p.dueDate || '',
    })),
    [38, 32, 22, 12, 10, 12, 12, 22, 26, 22, 12, 15]
  ), 'Pagos');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.anuncios || []).map(a => ({
      id: a.id, title: a.title, message: a.message || a.content || '',
      condo: a.condo, target: a.target, createdByRole: a.createdByRole,
      dateLabel: a.dateLabel || a.date || '', author: a.author || '',
      category: a.category || '', priority: a.priority || '',
    })),
    [38, 32, 52, 22, 16, 16, 24, 22, 16, 12]
  ), 'Anuncios');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.asambleas || []).map(a => ({
      id: a.id, title: a.title, description: a.description, condo: a.condo,
      startDate: a.startDate || '', dueDate: a.dueDate,
      documentName: a.documentName, documentPath: a.documentPath || '',
      createdAt: a.createdAt || '',
      votesYes:        a.votes?.favor      ?? a.votesYes        ?? 0,
      votesNo:         a.votes?.contra     ?? a.votesNo         ?? 0,
      votesAbstencion: a.votes?.abstencion ?? a.votesAbstencion ?? 0,
      userVotesJSON: JSON.stringify(a.userVotes || {}),
    })),
    [38, 36, 52, 22, 14, 14, 32, 32, 22, 10, 10, 14, 32]
  ), 'Asambleas');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.visitas || []).map(v => ({
      id: v.id, code: v.code, mode: v.mode, fullName: v.fullName,
      idNumber: v.idNumber, property: v.property, motive: v.motive,
      plate: v.plate, idDocumentName: v.idDocumentName || '',
      platePhotoName: v.platePhotoName || '', createdBy: v.createdBy,
      createdAt: v.createdAt, status: v.status,
    })),
    [38, 12, 10, 26, 14, 32, 26, 12, 22, 22, 22, 16, 12]
  ), 'Visitas');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.historialVisitas || []).map(h => ({
      id: h.id,
      visitante: h.visitante || h.visitorName || '',
      cedula: h.cedula || '',
      propiedad: h.propiedad || h.unit || '',
      tipo: h.tipo || h.action || '',
      placa: h.placa || '-',
      fecha: h.fecha || '',
      entrada: h.entrada || h.timestamp || '',
      salida: h.salida || '-',
      motivo: h.motivo || h.method || '',
      guard: h.guard || '',
    })),
    [38, 26, 14, 32, 12, 12, 12, 18, 18, 22, 20]
  ), 'Historial');

  XLSX.utils.book_append_sheet(wb, toSheet(
    (data.panicAlerts || []).map(p => ({
      id: p.id, resident: p.resident, phone: p.phone,
      address: p.address, unit: p.unit, status: p.status, createdAt: p.createdAt,
    })),
    [38, 26, 16, 32, 12, 16, 12]
  ), 'Panico');

  XLSX.writeFile(wb, DB_FILE);
  saveTokens(data.resetTokens || []);
}

module.exports = { readDB, writeDB };
