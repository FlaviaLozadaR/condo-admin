const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');
const TOKEN_KEY = 'condo_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Subscribers notified when a 401/expired event occurs
const _unauthorizedCallbacks = new Set();
export function onUnauthorized(cb) {
  _unauthorizedCallbacks.add(cb);
  return () => _unauthorizedCallbacks.delete(cb);
}

function _notifyUnauthorized(expired) {
  _unauthorizedCallbacks.forEach(cb => cb(expired));
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: isFormData ? options.body : (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new Error('Sin conexión con el servidor. Verificá que el backend esté corriendo.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    clearToken();
    _notifyUnauthorized(data.expired === true);
    throw new Error(data.error || 'Sesión expirada. Ingresá nuevamente.');
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;}

// Auth
export const forgotPassword = (email) => request('/auth/forgot-password', { method: 'POST', body: { email } });
export const resetPassword = (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } });

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
  }
  return data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

// Condominios
export const getCondominios = () => request('/condominios');
export const createCondo = (data) => request('/condominios', { method: 'POST', body: data });
export const updateCondo = (id, data) => request(`/condominios/${id}`, { method: 'PUT', body: data });
export const deleteCondo = (id) => request(`/condominios/${id}`, { method: 'DELETE' });
export const getMyCondoPaymentQr = () => request('/condominios/payment-qr');
export const uploadCondoPaymentQr = (condoId, formData) => request(`/condominios/${condoId}/payment-qr`, { method: 'PUT', body: formData });
export const deleteCondoPaymentQr = (condoId) => request(`/condominios/${condoId}/payment-qr`, { method: 'DELETE' });
export const asignarExpensas = (condoId, monto, propiedadIds) => request(`/condominios/${condoId}/asignar-expensas`, { method: 'PUT', body: { monto, propiedadIds } });
export const getMyProperty = () => request('/propiedades/my-property');
export const getMyProperties = () => request('/propiedades/my-properties');
export const addCargoExtra    = (propId, monto, motivo) => request(`/propiedades/${propId}/cargos-extra`, { method: 'POST', body: { monto, motivo } });
export const editCargoExtra   = (propId, cargoId, monto, motivo) => request(`/propiedades/${propId}/cargos-extra/${cargoId}`, { method: 'PUT', body: { monto, motivo } });
export const removeCargoExtra = (propId, cargoId) => request(`/propiedades/${propId}/cargos-extra/${cargoId}`, { method: 'DELETE' });

// Usuarios
export const getUsuarios = () => request('/usuarios');
export const getUsuariosPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/usuarios?${qs.toString()}`);
};
export const createUsuario = (data) => request('/usuarios', { method: 'POST', body: data });
export const updateUsuario = (id, data) => request(`/usuarios/${id}`, { method: 'PUT', body: data });
export const changePassword = (id, data) => request(`/usuarios/${id}/change-password`, { method: 'POST', body: data });
export const deleteUsuario = (id) => request(`/usuarios/${id}`, { method: 'DELETE' });

// Propiedades
export const getPropiedades = () => request('/propiedades');
export const getPropiedadesPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/propiedades?${qs.toString()}`);
};
export const createPropiedad = (data) => request('/propiedades', { method: 'POST', body: data });
export const updatePropiedad = (id, data) => request(`/propiedades/${id}`, { method: 'PUT', body: data });
export const deletePropiedad = (id) => request(`/propiedades/${id}`, { method: 'DELETE' });

// Pagos
export const getPagos = () => request('/pagos');
export const getPagosPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/pagos?${qs.toString()}`);
};
export const createPago = (data) => request('/pagos', { method: 'POST', body: data });
export const updatePagoStatus = (id, estado, montoReal, saldoRestante, notaSaldo) =>
  request(`/pagos/${id}/status`, { method: 'PATCH', body: { estado, montoReal, saldoRestante, notaSaldo } });

// Anuncios
export const getAnuncios = () => request('/anuncios');
export const getAnunciosPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/anuncios?${qs.toString()}`);
};
export const createAnuncio = (data) => request('/anuncios', { method: 'POST', body: data });
export const updateAnuncio = (id, data) => request(`/anuncios/${id}`, { method: 'PUT', body: data });
export const deleteAnuncio = (id) => request(`/anuncios/${id}`, { method: 'DELETE' });

// Asambleas
export const getAsambleas = () => request('/asambleas');
export const getAsambleasPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/asambleas?${qs.toString()}`);
};
export const createAsamblea = (formData) => request('/asambleas', { method: 'POST', body: formData });
export const updateAsamblea = (id, formData) => request(`/asambleas/${id}`, { method: 'PUT', body: formData });
export const deleteAsamblea = (id) => request(`/asambleas/${id}`, { method: 'DELETE' });
export const voteAsamblea = (id, tipo, userId) => request(`/asambleas/${id}/vote`, { method: 'POST', body: { tipo, userId } });
export const getAsambleaDocumentUrl = (id) => `${BASE_URL}/asambleas/${id}/document`;
export const getUploadUrl = (relativePath) => `${SERVER_URL}/uploads/${relativePath}`;

// Visitas (pases QR)
export const getVisitas = () => request('/visitas');
export const createVisita = (data) => request('/visitas', { method: 'POST', body: data });
export const updateVisitaStatus = (id, status) => request(`/visitas/${id}/status`, { method: 'PATCH', body: { status } });
export const updateVisita = (id, data) => request(`/visitas/${id}`, { method: 'PATCH', body: data });
export const getVisitaDocumentUrl = (id, type) => request(`/visitas/${id}/document/${type}`);
export const deleteVisitaDocument = (id, type) => request(`/visitas/${id}/document/${type}`, { method: 'DELETE' });
export const deleteVisita = (id) => request(`/visitas/${id}`, { method: 'DELETE' });

// Verificar QR por código
export const verifyVisita = (code) => request(`/visitas/verify/${encodeURIComponent(code)}`);

// URL pública que codifica el QR de un pase de visita (apunta al backend)
export const getVisitaVerifyUrl = (code) => `${SERVER_URL}/api/visitas/verify/${encodeURIComponent(code)}`;

// Historial visitas
export const getHistorialVisitas = () => request('/historial-visitas');
export const getMyVisitHistory = () => request('/historial-visitas/my-visits');
export const getHistorialVisitasPaged = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  return request(`/historial-visitas?${qs.toString()}`);
};
export const createHistorialVisita = (data) => request('/historial-visitas', { method: 'POST', body: data });
export const updateHistorialSalida = (id, salida) => request(`/historial-visitas/${id}/salida`, { method: 'PATCH', body: { salida } });
export const deleteHistorialVisita = (id) => request(`/historial-visitas/${id}`, { method: 'DELETE' });

// Botón de pánico
export const getPanicAlerts = (condo) => request(condo ? `/panic?condo=${encodeURIComponent(condo)}` : '/panic');
export const createPanicAlert = (data) => request('/panic', { method: 'POST', body: data });
export const updatePanicStatus = (id, status) => request(`/panic/${id}/status`, { method: 'PATCH', body: { status } });
export const getSeguridadContacts = () => request('/usuarios/seguridad');

// Áreas sociales
export const getAreasSociales = () => request('/areas-sociales');
export const createAreaSocial = (formData) => request('/areas-sociales', { method: 'POST', body: formData });
export const updateAreaSocial = (id, formData) => request(`/areas-sociales/${id}`, { method: 'PUT', body: formData });
export const deleteAreaSocial = (id) => request(`/areas-sociales/${id}`, { method: 'DELETE' });

// Reservas de áreas
export const getReservasAreas = () => request('/reservas-areas');
export const createReservaArea = (data) => request('/reservas-areas', { method: 'POST', body: data });
export const aprobarReservaArea = (id, estado, nota) => request(`/reservas-areas/${id}/estado`, { method: 'PATCH', body: { estado, nota } });
export const solicitarCambioReserva = (id, data) => request(`/reservas-areas/${id}/solicitar-cambio`, { method: 'POST', body: data });
export const responderCambioReserva = (id, aprobado) => request(`/reservas-areas/${id}/responder-cambio`, { method: 'PATCH', body: { aprobado } });
export const deleteReservaArea = (id) => request(`/reservas-areas/${id}`, { method: 'DELETE' });
