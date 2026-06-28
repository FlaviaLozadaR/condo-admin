const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = s => s.replace(/([A-Z])/g, '_$1').toLowerCase();

const rowToApp = row => !row ? null : Object.fromEntries(
  Object.entries(row).map(([k, v]) => [toCamel(k), v])
);

const appToRow = (obj, exclude = []) => Object.fromEntries(
  Object.entries(obj)
    .filter(([k, v]) => v !== undefined && !exclude.includes(k) && k !== 'insertedAt')
    .map(([k, v]) => [toSnake(k), v])
);

const asambleaFromRow = row => {
  if (!row) return null;
  const r = rowToApp(row);
  r.votes         = { favor: r.votesYes || 0, contra: r.votesNo || 0, abstencion: r.votesAbstencion || 0 };
  r.userVotesJSON = JSON.stringify(r.userVotes || {});
  return r;
};
const asambleaToRow = obj => appToRow(obj, ['votes', 'userVotesJSON']);

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// USUARIOS
async function getUsuarios(condo) {
  let query = supabase.from('usuarios').select('*').order('name');
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}
async function getUsuarioById(id) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function getUsuarioByEmail(email) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('email', email.toLowerCase()).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function createUsuario(data) {
  return rowToApp(await q(supabase.from('usuarios').insert(appToRow(data)).select().single()));
}
async function updateUsuario(id, changes) {
  return rowToApp(await q(supabase.from('usuarios').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteUsuario(id) {
  await q(supabase.from('usuarios').delete().eq('id', id));
}

// Lista mínima (id, nombre, teléfono) de personal de Seguridad, para que
// propietarios/inquilinos puedan llamarlos desde el botón de pánico.
async function getSeguridadContacts(condo) {
  let query = supabase.from('usuarios').select('id, name, phone').eq('role', 'Seguridad');
  if (condo) query = query.eq('condo', condo);
  return (await q(query.order('name'))).map(rowToApp);
}

function applyUsuariosFilters(query, { q: search, condo, role } = {}) {
  let result = query;
  if (condo) result = result.eq('condo', condo);
  if (role) result = result.eq('role', role);
  if (search) result = result.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  return result;
}

async function getUsuariosPaged({ page = 1, limit = 20, q: search, condo, role } = {}) {
  const from = (page - 1) * limit;

  const { data, error, count } = await applyUsuariosFilters(
    supabase.from('usuarios').select('*', { count: 'exact' }).order('name'),
    { q: search, condo, role }
  ).range(from, from + limit - 1);
  if (error) throw error;

  return {
    data: data.map(rowToApp),
    total: count || 0,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}

// CONDOMINIOS
async function getCondominios(condo) {
  let query = supabase.from('condominios').select('*').order('name');
  if (condo) query = query.eq('name', condo);
  return (await q(query)).map(rowToApp);
}
async function createCondominio(data) {
  return rowToApp(await q(supabase.from('condominios').insert(appToRow(data)).select().single()));
}
// Tablas que guardan el nombre del condominio como string denormalizado en su columna "condo"
const CONDO_NAME_TABLES = ['usuarios', 'propiedades', 'anuncios', 'asambleas', 'areas_sociales', 'reservas_areas', 'pagos', 'visitas', 'historial_visitas', 'panic_alerts'];

// Al renombrar un condominio, propaga el nuevo nombre a todas las filas que
// todavía referencian el nombre anterior — si no, esas filas dejan de
// aparecer en cualquier filtro por condominio.
async function cascadeCondoRename(oldName, newName) {
  for (const table of CONDO_NAME_TABLES) {
    await q(supabase.from(table).update({ condo: newName }).eq('condo', oldName));
  }
}

async function updateCondominio(id, changes) {
  if (changes.name) {
    const current = await q(supabase.from('condominios').select('name').eq('id', id).single());
    const updated = rowToApp(await q(supabase.from('condominios').update(appToRow(changes)).eq('id', id).select().single()));
    if (current?.name && current.name !== changes.name) {
      await cascadeCondoRename(current.name, changes.name);
    }
    return updated;
  }
  return rowToApp(await q(supabase.from('condominios').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteCondominio(id) {
  await q(supabase.from('condominios').delete().eq('id', id));
}

// PROPIEDADES

// Ordena "10" después de "2" (no lexicográfico) comparando cada tramo numérico
// como número — así funciona también para códigos mixtos como "A-2"/"A-10".
function naturalCompare(a, b) {
  const re = /(\d+)|(\D+)/g;
  const pa = String(a ?? '').match(re) || [];
  const pb = String(b ?? '').match(re) || [];
  const len = Math.min(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i], y = pb[i];
    if (x !== y) {
      const nx = Number(x), ny = Number(y);
      if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

// Calle (alfabético) y, dentro de la misma calle, número (ascendente, natural).
function sortPropiedades(rows, { byCondoFirst = false } = {}) {
  return [...rows].sort((a, b) => {
    if (byCondoFirst) {
      const condoCmp = (a.condo || '').localeCompare(b.condo || '', 'es', { sensitivity: 'base' });
      if (condoCmp !== 0) return condoCmp;
    }
    const streetCmp = (a.street || '').localeCompare(b.street || '', 'es', { sensitivity: 'base' });
    if (streetCmp !== 0) return streetCmp;
    return naturalCompare(a.code, b.code);
  });
}

// Cargos extra: itemizados en su propia tabla — cargoExtra/notaCargo en la
// propiedad son calculados (suma y motivos unidos) para no romper a quienes
// ya leen esos dos campos como un único número/texto.
async function getCargosExtraByPropiedadIds(propiedadIds) {
  const map = new Map();
  if (!propiedadIds.length) return map;
  const { data } = await supabase.from('cargos_extra').select('*').in('propiedad_id', propiedadIds).order('inserted_at');
  (data || []).map(rowToApp).forEach(c => {
    if (!map.has(c.propiedadId)) map.set(c.propiedadId, []);
    map.get(c.propiedadId).push(c);
  });
  return map;
}
function attachCargosExtra(propiedades, cargosMap) {
  return propiedades.map(p => {
    const items = cargosMap.get(p.id) || [];
    const cargoExtra = items.reduce((s, c) => s + (Number(c.monto) || 0), 0);
    const notaCargo  = items.map(c => c.motivo).filter(Boolean).join(' · ');
    return { ...p, cargoExtra, notaCargo, cargosExtraList: items };
  });
}
async function createCargoExtra(data) {
  return rowToApp(await q(supabase.from('cargos_extra').insert(appToRow(data)).select().single()));
}
async function updateCargoExtraItem(id, changes) {
  return rowToApp(await q(supabase.from('cargos_extra').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteCargoExtraItem(id) {
  await q(supabase.from('cargos_extra').delete().eq('id', id));
}
async function getCargoExtraById(id) {
  const { data, error } = await supabase.from('cargos_extra').select('*').eq('id', id).single();
  if (error) return null;
  return rowToApp(data);
}
// Al aprobarse el pago de una reserva, el cargo extra que la generó queda
// pagado — se borra para que no siga apareciendo como pendiente.
async function deleteCargosExtraByReservaId(reservaId) {
  await q(supabase.from('cargos_extra').delete().eq('reserva_id', reservaId));
}
// Al aprobarse un pago de expensa que cubre el total (expensa + cargos
// extra), los cargos extra de esa propiedad quedan pagados — se borran.
async function deleteCargosExtraByPropiedadId(propiedadId) {
  await q(supabase.from('cargos_extra').delete().eq('propiedad_id', propiedadId));
}

async function getPropiedades(condo) {
  let query = supabase.from('propiedades').select('*');
  if (condo) query = query.eq('condo', condo);
  const rows = (await q(query)).map(rowToApp);
  const sorted = sortPropiedades(rows, { byCondoFirst: true });
  const cargosMap = await getCargosExtraByPropiedadIds(sorted.map(p => p.id));
  return attachCargosExtra(sorted, cargosMap);
}
async function createPropiedad(data) {
  return rowToApp(await q(supabase.from('propiedades').insert(appToRow(data)).select().single()));
}
async function updatePropiedad(id, changes) {
  return rowToApp(await q(supabase.from('propiedades').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deletePropiedad(id) {
  await q(supabase.from('propiedades').delete().eq('id', id));
}
async function propiedadExists(code, street) {
  const { data } = await supabase.from('propiedades').select('id').ilike('code', code).ilike('street', street);
  return data && data.length > 0;
}

function applyPropiedadesFilters(query, { q: search, condo } = {}) {
  let result = query;
  if (condo) result = result.eq('condo', condo);
  if (search) result = result.or(`code.ilike.%${search}%,street.ilike.%${search}%`);
  return result;
}

async function getPropiedadesPaged({ page = 1, limit = 20, q: search, condo } = {}) {
  const { data, error } = await applyPropiedadesFilters(
    supabase.from('propiedades').select('*'),
    { q: search, condo }
  );
  if (error) throw error;

  const sorted = sortPropiedades(data.map(rowToApp));
  const total  = sorted.length;
  const from   = (page - 1) * limit;
  const pageItems = sorted.slice(from, from + limit);
  const cargosMap = await getCargosExtraByPropiedadIds(pageItems.map(p => p.id));

  return {
    data: attachCargosExtra(pageItems, cargosMap),
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// PAGOS
async function getPagos(condo) {
  let query = supabase.from('pagos').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}
async function getPagoById(id) {
  const { data, error } = await supabase.from('pagos').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function createPago(data) {
  return rowToApp(await q(supabase.from('pagos').insert(appToRow(data)).select().single()));
}
async function updatePagoEstado(id, estado) {
  return rowToApp(await q(supabase.from('pagos').update({ estado }).eq('id', id).select().single()));
}
async function updatePago(id, changes) {
  return rowToApp(await q(supabase.from('pagos').update(appToRow(changes)).eq('id', id).select().single()));
}

function applyPagosFilters(query, { estado, q: search, condo, tipo } = {}) {
  let result = query;
  if (estado && estado !== 'todos') result = result.eq('estado', estado);
  if (tipo && tipo !== 'todos') result = result.eq('tipo', tipo);
  if (search) result = result.or(`propiedad.ilike.%${search}%,propietario.ilike.%${search}%,referencia.ilike.%${search}%,tipo.ilike.%${search}%`);
  if (condo) result = result.eq('condo', condo);
  return result;
}

async function getPagosPaged({ page = 1, limit = 20, estado, q: search, condo, tipo } = {}) {
  const from = (page - 1) * limit;

  const dataQuery = applyPagosFilters(
    supabase.from('pagos').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { estado, q: search, condo, tipo }
  ).range(from, from + limit - 1);

  // KPIs: solo filtro de condo (igual que pagosByCondo), sin tab/búsqueda
  const countByEstado = e => applyPagosFilters(
    supabase.from('pagos').select('id', { count: 'exact', head: true }),
    { estado: e, condo }
  );
  const approvedTotalQuery = applyPagosFilters(
    supabase.from('pagos').select('monto'),
    { estado: 'aprobado', condo }
  );

  const [{ data, error, count }, pendiente, aprobado, rechazado, approvedRows] = await Promise.all([
    dataQuery, countByEstado('pendiente'), countByEstado('aprobado'), countByEstado('rechazado'), approvedTotalQuery,
  ]);
  if (error) throw error;
  if (pendiente.error) throw pendiente.error;
  if (aprobado.error) throw aprobado.error;
  if (rechazado.error) throw rechazado.error;
  if (approvedRows.error) throw approvedRows.error;

  const approvedPaymentsTotal = (approvedRows.data || []).reduce((sum, r) => sum + (Number(r.monto) || 0), 0);

  return {
    data: data.map(rowToApp),
    total: count || 0,
    totalPendientes: pendiente.count || 0,
    totalAprobados:  aprobado.count || 0,
    totalRechazados: rechazado.count || 0,
    approvedPaymentsTotal,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}

// ANUNCIOS
async function getAnuncios(condo) {
  let query = supabase.from('anuncios').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}

// Replica server-side la visibilidad por rol que hoy calcula el cliente
// (isAnnouncementVisibleForUser): solo SA/Admin pueden crear anuncios, así que
// para cada rol alcanza con filtrar por target/creador.
function applyAnunciosFilters(query, { condo, viewerRole, dateFilter } = {}) {
  let result = query;
  if (condo) result = result.eq('condo', condo);
  if (viewerRole === 'Administrador') {
    result = result.or(`created_by_role.eq.Administrador,and(created_by_role.eq."Super Admin",target.eq.todos)`);
  } else if (viewerRole === 'Propietario') {
    result = result.in('target', ['todos', 'propietarios']);
  } else if (viewerRole === 'Inquilino') {
    result = result.in('target', ['todos', 'inquilinos']);
  } else if (viewerRole === 'Seguridad') {
    result = result.in('target', ['todos', 'seguridad']);
  }
  // Super Admin: sin filtro de visibilidad (ve todo)

  const DIA_MS = 24 * 60 * 60 * 1000;
  if (dateFilter === 'semana') {
    result = result.gte('inserted_at', new Date(Date.now() - 7 * DIA_MS).toISOString());
  } else if (dateFilter === 'mes') {
    result = result.gte('inserted_at', new Date(Date.now() - 30 * DIA_MS).toISOString());
  } else if (dateFilter === 'antiguos') {
    result = result.lt('inserted_at', new Date(Date.now() - 30 * DIA_MS).toISOString());
  }

  return result;
}

async function getAnunciosPaged({ page = 1, limit = 20, condo, viewerRole, dateFilter } = {}) {
  const from = (page - 1) * limit;

  const { data, error, count } = await applyAnunciosFilters(
    supabase.from('anuncios').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { condo, viewerRole, dateFilter }
  ).range(from, from + limit - 1);
  if (error) throw error;

  return {
    data: data.map(rowToApp),
    total: count || 0,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}
async function createAnuncio(data) {
  return rowToApp(await q(supabase.from('anuncios').insert(appToRow(data)).select().single()));
}
async function updateAnuncio(id, changes) {
  return rowToApp(await q(supabase.from('anuncios').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteAnuncio(id) {
  await q(supabase.from('anuncios').delete().eq('id', id));
}

// ASAMBLEAS
async function getAsambleas(condo) {
  let query = supabase.from('asambleas').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(asambleaFromRow);
}
async function getAsambleaById(id) {
  const { data, error } = await supabase.from('asambleas').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return asambleaFromRow(data);
}
async function createAsamblea(data) {
  return asambleaFromRow(await q(supabase.from('asambleas').insert(asambleaToRow(data)).select().single()));
}
async function updateAsamblea(id, changes) {
  return asambleaFromRow(await q(supabase.from('asambleas').update(asambleaToRow(changes)).eq('id', id).select().single()));
}
async function deleteAsamblea(id) {
  await q(supabase.from('asambleas').delete().eq('id', id));
}
async function voteAsamblea(id, tipo, userId) {
  const asamblea  = await getAsambleaById(id);
  if (!asamblea) throw new Error('Asamblea no encontrada');
  if (asamblea.dueDate) {
    const due = new Date(asamblea.dueDate);
    if (!isNaN(due)) {
      due.setHours(23, 59, 59, 999);
      if (due < new Date()) throw new Error('Esta asamblea ya venció — no se puede votar.');
    }
  }
  const userVotes = { ...(asamblea.userVotes || {}) };
  const votes     = { ...(asamblea.votes || { favor: 0, contra: 0, abstencion: 0 }) };
  const prev      = userVotes[userId];
  if (prev) votes[prev] = Math.max(0, (votes[prev] || 0) - 1);
  votes[tipo]       = (votes[tipo] || 0) + 1;
  userVotes[userId] = tipo;
  return updateAsamblea(id, {
    votesYes: votes.favor, votesNo: votes.contra, votesAbstencion: votes.abstencion, userVotes,
  });
}

function applyAsambleasFilters(query, { condo } = {}) {
  let result = query;
  if (condo) result = result.eq('condo', condo);
  return result;
}

async function getAsambleasPaged({ page = 1, limit = 20, condo } = {}) {
  const from = (page - 1) * limit;

  const { data, error, count } = await applyAsambleasFilters(
    supabase.from('asambleas').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { condo }
  ).range(from, from + limit - 1);
  if (error) throw error;

  return {
    data: data.map(asambleaFromRow),
    total: count || 0,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}

// VISITAS
async function getVisitas(condo) {
  let query = supabase.from('visitas').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}
async function createVisita(data) {
  return rowToApp(await q(supabase.from('visitas').insert(appToRow(data)).select().single()));
}
async function getVisitaByCode(code) {
  const { data, error } = await supabase.from('visitas').select('*').eq('code', code).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function updateVisitaStatus(id, status) {
  return rowToApp(await q(supabase.from('visitas').update({ status }).eq('id', id).select().single()));
}
async function getVisitaById(id) {
  const { data, error } = await supabase.from('visitas').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function updateVisita(id, changes) {
  return rowToApp(await q(supabase.from('visitas').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteVisita(id) {
  await q(supabase.from('visitas').delete().eq('id', id));
}

// Adjunta a cada fila de historial si la visita ligada (visitaId) tiene fotos
// de documentos disponibles — para mostrar el botón "Ver" solo cuando aplica,
// sin tener que cargar las fotos en sí (eso queda para el link firmado puntual).
async function attachVisitaDocFlags(historialRows) {
  const visitaIds = [...new Set(historialRows.map(h => h.visitaId).filter(Boolean))];
  if (!visitaIds.length) {
    return historialRows.map(h => ({ ...h, hasIdDocumentFront: false, hasIdDocumentBack: false, hasPlatePhoto: false }));
  }
  const { data } = await supabase
    .from('visitas')
    .select('id, id_document_front_path, id_document_back_path, plate_photo_path')
    .in('id', visitaIds);
  const map = new Map((data || []).map(rowToApp).map(v => [v.id, v]));
  return historialRows.map(h => {
    const v = map.get(h.visitaId);
    return {
      ...h,
      hasIdDocumentFront: !!v?.idDocumentFrontPath,
      hasIdDocumentBack:  !!v?.idDocumentBackPath,
      hasPlatePhoto:      !!v?.platePhotoPath,
    };
  });
}

// HISTORIAL
async function getHistorial(condo) {
  let query = supabase.from('historial_visitas').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}

function applyHistorialFilters(query, { tipo, q: search, condo, currentMonthOnly } = {}) {
  let result = query;
  if (tipo && tipo !== 'todos') result = result.eq('tipo', tipo);
  if (search) result = result.or(`visitante.ilike.%${search}%,cedula.ilike.%${search}%,placa.ilike.%${search}%`);
  if (condo) result = result.eq('condo', condo);
  if (currentMonthOnly) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    result = result.gte('inserted_at', startOfMonth.toISOString());
  }
  return result;
}

async function getHistorialPaged({ page = 1, limit = 20, tipo, q: search, condo } = {}) {
  const from = (page - 1) * limit;
  const dataQuery = applyHistorialFilters(
    supabase.from('historial_visitas').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { tipo, q: search, condo }
  ).range(from, from + limit - 1);

  // Tarjetas de resumen: solo el mes actual (se reinician al cambiar de mes)
  const countThisMonth = t => applyHistorialFilters(
    supabase.from('historial_visitas').select('id', { count: 'exact', head: true }),
    { tipo: t, q: search, condo, currentMonthOnly: true }
  );

  const [{ data, error, count }, totalMes, peatonalMes, vehicularMes] = await Promise.all([
    dataQuery,
    countThisMonth(undefined),
    countThisMonth('peatonal'),
    countThisMonth('vehicular'),
  ]);
  if (error) throw error;
  if (totalMes.error) throw totalMes.error;
  if (peatonalMes.error) throw peatonalMes.error;
  if (vehicularMes.error) throw vehicularMes.error;

  return {
    data: await attachVisitaDocFlags(data.map(rowToApp)),
    total: totalMes.count || 0,
    totalPeatonales: peatonalMes.count || 0,
    totalVehiculares: vehicularMes.count || 0,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}

async function createHistorial(data) {
  return rowToApp(await q(supabase.from('historial_visitas').insert(appToRow(data)).select().single()));
}
async function getHistorialById(id) {
  const { data, error } = await supabase.from('historial_visitas').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function updateHistorial(id, changes) {
  return rowToApp(await q(supabase.from('historial_visitas').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteHistorial(id) {
  await q(supabase.from('historial_visitas').delete().eq('id', id));
}

// PANIC ALERTS
async function getPanicAlerts(condo) {
  let query = supabase.from('panic_alerts').select('*').order('inserted_at', { ascending: false });
  if (condo) query = query.eq('condo', condo);
  return (await q(query)).map(rowToApp);
}
async function createPanicAlert(data) {
  return rowToApp(await q(supabase.from('panic_alerts').insert(appToRow(data)).select().single()));
}
async function getPanicAlertById(id) {
  const { data, error } = await supabase.from('panic_alerts').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return rowToApp(data);
}
async function updatePanicStatus(id, status) {
  return rowToApp(await q(supabase.from('panic_alerts').update({ status }).eq('id', id).select().single()));
}

// ÁREAS SOCIALES
async function getAreasSociales() {
  return (await q(supabase.from('areas_sociales').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
}
async function createAreaSocial(data) {
  return rowToApp(await q(supabase.from('areas_sociales').insert(appToRow(data)).select().single()));
}
async function updateAreaSocial(id, changes) {
  return rowToApp(await q(supabase.from('areas_sociales').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteAreaSocial(id) {
  await q(supabase.from('areas_sociales').delete().eq('id', id));
}

// RESERVAS DE ÁREAS
async function getReservasAreas() {
  return (await q(supabase.from('reservas_areas').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
}
async function createReservaArea(data) {
  return rowToApp(await q(supabase.from('reservas_areas').insert(appToRow(data)).select().single()));
}
async function updateReservaArea(id, changes) {
  return rowToApp(await q(supabase.from('reservas_areas').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteReservaArea(id) {
  await q(supabase.from('reservas_areas').delete().eq('id', id));
}

// RESET TOKENS
async function createResetToken(token, email, expiresAt) {
  await q(supabase.from('reset_tokens').insert({ token, email, expires_at: expiresAt }));
}
async function getResetToken(token) {
  const { data, error } = await supabase.from('reset_tokens')
    .select('*').eq('token', token).eq('used', false).single();
  if (error) return null;
  return rowToApp(data);
}
async function markTokenUsed(token) {
  await q(supabase.from('reset_tokens').update({ used: true }).eq('token', token));
}

// DASHBOARD
async function getDataForDashboard(condo) {
  const [propiedades, pagos, visitas, historialVisitas, panicAlerts] = await Promise.all([
    getPropiedades(condo), getPagos(condo), getVisitas(condo), getHistorial(condo), getPanicAlerts(condo),
  ]);
  return { propiedades, pagos, visitas, historialVisitas, panicAlerts };
}

module.exports = {
  getUsuarios, getUsuarioById, getUsuarioByEmail, createUsuario, updateUsuario, deleteUsuario, getUsuariosPaged, getSeguridadContacts,
  getCondominios, createCondominio, updateCondominio, deleteCondominio,
  getPropiedades, createPropiedad, updatePropiedad, deletePropiedad, propiedadExists, getPropiedadesPaged,
  createCargoExtra, updateCargoExtraItem, deleteCargoExtraItem, getCargoExtraById,
  deleteCargosExtraByReservaId, deleteCargosExtraByPropiedadId,
  getPagos, getPagoById, createPago, updatePagoEstado, updatePago, getPagosPaged,
  getAnuncios, createAnuncio, updateAnuncio, deleteAnuncio, getAnunciosPaged,
  getAsambleas, getAsambleaById, createAsamblea, updateAsamblea, deleteAsamblea, voteAsamblea, getAsambleasPaged,
  getVisitas, createVisita, getVisitaByCode, updateVisitaStatus, getVisitaById, updateVisita, deleteVisita,
  getHistorial, getHistorialPaged, createHistorial, getHistorialById, updateHistorial, deleteHistorial,
  getPanicAlerts, createPanicAlert, getPanicAlertById, updatePanicStatus,
  createResetToken, getResetToken, markTokenUsed,
  getDataForDashboard,
  getAreasSociales, createAreaSocial, updateAreaSocial, deleteAreaSocial,
  getReservasAreas, createReservaArea, updateReservaArea, deleteReservaArea,
};
