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
async function getUsuarios() {
  return (await q(supabase.from('usuarios').select('*').order('name'))).map(rowToApp);
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

function applyUsuariosFilters(query, { q: search, condo } = {}) {
  let result = query;
  if (condo) result = result.eq('condo', condo);
  if (search) result = result.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  return result;
}

async function getUsuariosPaged({ page = 1, limit = 20, q: search, condo } = {}) {
  const from = (page - 1) * limit;

  const { data, error, count } = await applyUsuariosFilters(
    supabase.from('usuarios').select('*', { count: 'exact' }).order('name'),
    { q: search, condo }
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
async function getCondominios() {
  return (await q(supabase.from('condominios').select('*').order('name'))).map(rowToApp);
}
async function createCondominio(data) {
  return rowToApp(await q(supabase.from('condominios').insert(appToRow(data)).select().single()));
}
async function updateCondominio(id, changes) {
  return rowToApp(await q(supabase.from('condominios').update(appToRow(changes)).eq('id', id).select().single()));
}
async function deleteCondominio(id) {
  await q(supabase.from('condominios').delete().eq('id', id));
}

// PROPIEDADES
async function getPropiedades() {
  return (await q(supabase.from('propiedades').select('*').order('condo'))).map(rowToApp);
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
  const from = (page - 1) * limit;

  const { data, error, count } = await applyPropiedadesFilters(
    supabase.from('propiedades').select('*', { count: 'exact' }).order('code'),
    { q: search, condo }
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

// PAGOS
async function getPagos() {
  return (await q(supabase.from('pagos').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
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

function applyPagosFilters(query, { estado, q: search, condo } = {}) {
  let result = query;
  if (estado && estado !== 'todos') result = result.eq('estado', estado);
  if (search) result = result.or(`propiedad.ilike.%${search}%,propietario.ilike.%${search}%,referencia.ilike.%${search}%,tipo.ilike.%${search}%`);
  if (condo) result = result.ilike('propiedad', `%${condo}%`);
  return result;
}

async function getPagosPaged({ page = 1, limit = 20, estado, q: search, condo } = {}) {
  const from = (page - 1) * limit;

  const dataQuery = applyPagosFilters(
    supabase.from('pagos').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { estado, q: search, condo }
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
async function getAnuncios() {
  return (await q(supabase.from('anuncios').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
}

// Replica server-side la visibilidad por rol que hoy calcula el cliente
// (isAnnouncementVisibleForUser): solo SA/Admin pueden crear anuncios, así que
// para cada rol alcanza con filtrar por target/creador.
function applyAnunciosFilters(query, { condo, viewerRole } = {}) {
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
  return result;
}

async function getAnunciosPaged({ page = 1, limit = 20, condo, viewerRole } = {}) {
  const from = (page - 1) * limit;

  const { data, error, count } = await applyAnunciosFilters(
    supabase.from('anuncios').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { condo, viewerRole }
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
async function getAsambleas() {
  return (await q(supabase.from('asambleas').select('*').order('inserted_at', { ascending: false }))).map(asambleaFromRow);
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
async function getVisitas() {
  return (await q(supabase.from('visitas').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
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

// HISTORIAL
async function getHistorial() {
  return (await q(supabase.from('historial_visitas').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
}

function applyHistorialFilters(query, { tipo, q: search, condo } = {}) {
  let result = query;
  if (tipo && tipo !== 'todos') result = result.eq('tipo', tipo);
  if (search) result = result.or(`visitante.ilike.%${search}%,cedula.ilike.%${search}%,placa.ilike.%${search}%`);
  if (condo) result = result.ilike('propiedad', `%${condo}%`);
  return result;
}

async function getHistorialPaged({ page = 1, limit = 20, tipo, q: search, condo } = {}) {
  const from = (page - 1) * limit;
  const dataQuery = applyHistorialFilters(
    supabase.from('historial_visitas').select('*', { count: 'exact' }).order('inserted_at', { ascending: false }),
    { tipo, q: search, condo }
  ).range(from, from + limit - 1);

  const countByTipo = t => applyHistorialFilters(
    supabase.from('historial_visitas').select('id', { count: 'exact', head: true }),
    { tipo: t, q: search, condo }
  );

  const [{ data, error, count }, peatonal, vehicular] = await Promise.all([
    dataQuery,
    countByTipo('peatonal'),
    countByTipo('vehicular'),
  ]);
  if (error) throw error;
  if (peatonal.error) throw peatonal.error;
  if (vehicular.error) throw vehicular.error;

  return {
    data: data.map(rowToApp),
    total: count || 0,
    totalPeatonales: peatonal.count || 0,
    totalVehiculares: vehicular.count || 0,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  };
}

async function createHistorial(data) {
  return rowToApp(await q(supabase.from('historial_visitas').insert(appToRow(data)).select().single()));
}

// PANIC ALERTS
async function getPanicAlerts() {
  return (await q(supabase.from('panic_alerts').select('*').order('inserted_at', { ascending: false }))).map(rowToApp);
}
async function createPanicAlert(data) {
  return rowToApp(await q(supabase.from('panic_alerts').insert(appToRow(data)).select().single()));
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
async function getDataForDashboard() {
  const [propiedades, pagos, visitas, historialVisitas, panicAlerts] = await Promise.all([
    getPropiedades(), getPagos(), getVisitas(), getHistorial(), getPanicAlerts(),
  ]);
  return { propiedades, pagos, visitas, historialVisitas, panicAlerts };
}

module.exports = {
  getUsuarios, getUsuarioById, getUsuarioByEmail, createUsuario, updateUsuario, deleteUsuario, getUsuariosPaged,
  getCondominios, createCondominio, updateCondominio, deleteCondominio,
  getPropiedades, createPropiedad, updatePropiedad, deletePropiedad, propiedadExists, getPropiedadesPaged,
  getPagos, createPago, updatePagoEstado, updatePago, getPagosPaged,
  getAnuncios, createAnuncio, updateAnuncio, deleteAnuncio, getAnunciosPaged,
  getAsambleas, getAsambleaById, createAsamblea, updateAsamblea, deleteAsamblea, voteAsamblea, getAsambleasPaged,
  getVisitas, createVisita, getVisitaByCode, updateVisitaStatus,
  getHistorial, getHistorialPaged, createHistorial,
  getPanicAlerts, createPanicAlert, updatePanicStatus,
  createResetToken, getResetToken, markTokenUsed,
  getDataForDashboard,
  getAreasSociales, createAreaSocial, updateAreaSocial, deleteAreaSocial,
  getReservasAreas, createReservaArea, updateReservaArea, deleteReservaArea,
};
