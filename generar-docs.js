// Genera DOCUMENTACION.xlsx con toda la info del proyecto
const XLSX = require('./backend/node_modules/xlsx');
const path = require('path');

const OUT = path.join(__dirname, 'DOCUMENTACION.xlsx');

// ── helpers ──────────────────────────────────────────────────────────────────
function sheet(rows, colWidths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
  // Bold + colored header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { wrapText: true, vertical: 'center' },
      };
    }
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

const wb = XLSX.utils.book_new();

// ── 1. RESUMEN DEL PROYECTO ────────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Campo', 'Detalle'],
  ['Nombre del proyecto', 'Condo Admin'],
  ['Descripción', 'Sistema de administración de condominios con gestión de residentes, pagos, visitas, asambleas y alertas.'],
  ['Versión', '1.0.0'],
  ['Fecha de documentación', new Date().toLocaleDateString('es-ES')],
  [''],
  ['TECNOLOGÍAS', ''],
  ['Frontend framework', 'React 18.3.1 con Vite 5.4'],
  ['Frontend estilos', 'CSS puro con custom properties (variables CSS) y dark mode'],
  ['Frontend librerías', 'xlsx 0.18.5, html5-qrcode 2.3.8, qrcode.react 4.2.0'],
  ['Backend framework', 'Node.js + Express 4.18'],
  ['Backend autenticación', 'JWT (jsonwebtoken 9.0) — tokens de 24h'],
  ['Backend base de datos', 'Excel (.xlsx) vía SheetJS/xlsx 0.18.5 — sin SQL'],
  ['Backend subida de archivos', 'Multer 2.1.1'],
  ['Backend correo', 'Nodemailer 8.0.5 (Gmail SMTP)'],
  ['Hashing de contraseñas', 'bcryptjs 2.4.3'],
  ['Seguridad HTTP', 'Helmet 8.1.0 + express-rate-limit 8.3.2 + CORS'],
  ['Logging', 'Morgan 1.10.1'],
  [''],
  ['ESTRUCTURA DE CARPETAS', ''],
  ['backend/', 'API REST con Express'],
  ['backend/server.js', 'Punto de entrada del backend (puerto 3001)'],
  ['backend/src/controllers/', 'Lógica de negocio por módulo'],
  ['backend/src/routes/', 'Definición de endpoints por módulo'],
  ['backend/src/middleware/', 'Autenticación y autorización (JWT)'],
  ['backend/src/dto/', 'Validación y transformación de datos entrantes'],
  ['backend/src/data/', 'Lectura/escritura del Excel (db.js) y datos iniciales (seed.js)'],
  ['backend/src/services/', 'Servicios auxiliares (email, dashboard)'],
  ['backend/uploads/comprobantes/', 'Comprobantes de pago subidos'],
  ['backend/uploads/asambleas/', 'Documentos de asambleas subidos'],
  ['backend/tokens.json', 'Tokens de recuperación de contraseña (JSON, no Excel)'],
  ['data.xlsx', 'Base de datos principal (hojas: Usuarios, Condominios, Propiedades, Pagos, Anuncios, Asambleas, Visitas, Historial, Panico)'],
  ['frontend/src/App.jsx', 'Aplicación React completa (~6300 líneas)'],
  ['frontend/src/api.js', 'Funciones de llamada a la API REST'],
  ['frontend/styles.css', 'Estilos globales (~6500 líneas) con soporte dark/light mode'],
  [''],
  ['VARIABLES DE ENTORNO (.env)', ''],
  ['JWT_SECRET', 'Clave secreta para firmar tokens JWT'],
  ['GMAIL_USER', 'Correo Gmail para envío de emails'],
  ['GMAIL_PASS', 'Contraseña de aplicación Gmail'],
  ['FRONTEND_URL', 'URL del frontend (default: http://localhost:5173)'],
  ['PORT', 'Puerto del backend (default: 3001)'],
  ['NODE_ENV', 'Entorno (development / production)'],
], [28, 70]), '1. Resumen');

// ── 2. ROLES Y PERMISOS ───────────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Rol', 'Nivel', 'Descripción', 'Acceso a módulos'],
  ['Super Admin', '5', 'Administrador global del sistema. Ve y gestiona TODOS los condominios.', 'Dashboard global, Condominios, Usuarios, Propiedades, Pagos, Anuncios (todos los condominios), Asambleas, Visitas, Historial, Pánico, Reportes'],
  ['Administrador', '4', 'Administra UN condominio específico.', 'Dashboard del condominio, Usuarios, Propiedades, Pagos, Anuncios, Asambleas, Visitas, Historial, Pánico'],
  ['Propietario', '3', 'Propietario de una unidad residencial.', 'Inicio (anuncios + historial propio), Mis Pagos, Pagar Expensas, Asambleas (votar), Mis Visitas, Mis Reservas, Mi Perfil, Botón de Pánico'],
  ['Inquilino', '3', 'Arrendatario de una unidad residencial.', 'Inicio (anuncios + historial propio), Mis Pagos, Pagar Expensas, Asambleas (votar), Mis Visitas, Mis Reservas, Mi Perfil, Botón de Pánico'],
  ['Seguridad', '2', 'Personal de seguridad / portería.', 'Control de Visitas, Registrar Entrada/Salida, Historial de Visitas, Alertas de Pánico, Mi Perfil'],
], [16, 8, 52, 80]), '2. Roles y Permisos');

// ── 3. FUNCIONALIDADES ────────────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Módulo / Pantalla', 'Roles con acceso', 'Descripción', 'Estado'],
  ['Landing Page', 'Público', 'Página de presentación del producto con secciones: héroe, características, ¿Por qué elegirnos?, footer con info de contacto. Incluye toggle dark/light mode.', '✅ Completo'],
  ['Login', 'Público', 'Formulario de inicio de sesión con email y contraseña. JWT devuelto y guardado en localStorage.', '✅ Completo'],
  ['Recuperar contraseña', 'Público', 'Solicita email → backend envía link con token (1h) → formulario de nueva contraseña.', '✅ Completo'],
  ['Dashboard Super Admin', 'Super Admin', 'KPIs globales (total condominios, usuarios, propiedades, deuda total). Gráficos de pagos mensuales, visitas por día, tipo de acceso, morosos. Selector de condominio para ver métricas individuales.', '✅ Completo'],
  ['Dashboard Administrador', 'Administrador', 'KPIs del condominio (propiedades, morosos, visitas hoy, ingresos mes). Gráficos reales de pagos mensuales, visitas por día, tipo acceso, morosos.', '✅ Completo'],
  ['Inicio Propietario/Inquilino', 'Propietario, Inquilino', 'Carrusel de anuncios con auto-rotación (4.5s). Panel de historial de visitas reciente filtrado por unidad del residente.', '✅ Completo'],
  ['Inicio Seguridad', 'Seguridad', 'Panel de visitas activas, acceso rápido a registrar entrada/salida.', '✅ Completo'],
  ['Gestión de Condominios', 'Super Admin', 'Tarjetas de condominios con métricas reales (propiedades, usuarios, deuda, pagos pendientes). CRUD completo (crear, editar nombre/tipo/dirección/plan, eliminar).', '✅ Completo'],
  ['Gestión de Usuarios', 'Super Admin, Admin', 'Lista de usuarios con filtros. CRUD completo. Al crear: contraseña default "123456", se envía email de bienvenida. Admins no pueden cambiar email/rol de otros admins.', '✅ Completo'],
  ['Gestión de Propiedades', 'Super Admin, Admin', 'Lista de propiedades con deuda y propietario. CRUD completo. Validación de código único.', '✅ Completo'],
  ['Pagos / Expensas', 'Super Admin, Admin', 'Lista de pagos con filtros. Aprobación/rechazo de pagos. Ver comprobante adjunto. Exportar a Excel y PDF.', '✅ Completo'],
  ['Mis Pagos', 'Propietario, Inquilino', 'Historial de pagos propios con estado (pendiente/aprobado/rechazado).', '✅ Completo'],
  ['Pagar Expensas', 'Propietario, Inquilino', 'Modal para pagar: muestra deuda real de la propiedad, campo de monto, referencia bancaria, adjuntar comprobante (PDF/imagen, máx 8MB). Envía via FormData.', '✅ Completo'],
  ['Morosos', 'Super Admin, Admin', 'Lista de propiedades con deuda > 0. Exportar a Excel y PDF.', '✅ Completo'],
  ['Anuncios', 'Todos', 'Ver anuncios del condominio. Admin/SA puede crear, editar, eliminar. SA tiene selector de condominio destino (primer campo). Campos: título, mensaje, categoría, prioridad, target.', '✅ Completo'],
  ['Asambleas', 'Todos', 'Ver asambleas. Residentes pueden votar (favor/contra/abstención). Admin/SA puede crear con documento adjunto (PDF, DOC, etc). SA ve asambleas de todos los condominios. Header izquierdo en laptop.', '✅ Completo'],
  ['Control de Visitas', 'Seguridad, Admin, SA', 'Registrar visitas con QR automático. Verificar QR al ingreso. Cambiar estado (Activo/Finalizado). Registrar entrada y salida en historial.', '✅ Completo'],
  ['Historial de Visitas', 'Seguridad, Admin, SA', 'Log completo de entradas/salidas. Filtros por fecha. Exportar a Excel y PDF.', '✅ Completo'],
  ['Mis Visitas (Propietario)', 'Propietario, Inquilino', 'Invitaciones/pases creados por el residente. Ver estado del pase (QR).', '✅ Completo'],
  ['Mis Reservas', 'Propietario, Inquilino', 'Gestión de reservas de áreas comunes (piscina, salón, gym, cancha, BBQ). Crear, ver y cancelar reservas. Sin backend (estado local en memoria, pendiente persistencia).', '⚠️ Parcial (frontend sin persistencia)'],
  ['Alertas de Pánico', 'Todos', 'Botón de emergencia que envía alerta con nombre, dirección y teléfono. Admin/Seguridad ve lista de alertas y puede marcarlas como atendidas.', '✅ Completo'],
  ['Mi Perfil', 'Todos', 'Ver y editar nombre y teléfono. Subir foto de perfil. Cambiar contraseña (requiere contraseña actual + nueva ≥8 chars + confirmación).', '✅ Completo'],
  ['Dark Mode / Light Mode', 'Todos', 'Toggle en sidebar (circulito flotante) y en landing. Persiste en localStorage. Variables CSS para todos los componentes.', '✅ Completo'],
  ['Exportar Excel', 'Super Admin, Admin', 'Exportar Pagos, Morosos e Historial de Visitas a .xlsx usando SheetJS en el frontend.', '✅ Completo'],
  ['Exportar PDF', 'Super Admin, Admin', 'Exportar Pagos, Morosos e Historial de Visitas a PDF (tabla HTML estilizada en ventana nueva → imprimir/guardar como PDF).', '✅ Completo'],
], [30, 32, 80, 28]), '3. Funcionalidades');

// ── 4. RUTAS API ──────────────────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Método', 'Ruta', 'Roles permitidos', 'Función controlador', 'Descripción', 'Middleware especial'],
  // AUTH
  ['POST', '/api/auth/login', 'Público', 'authController.login', 'Autenticación: valida email/password, devuelve JWT + usuario', 'rate-limit: 30 req/5min'],
  ['POST', '/api/auth/forgot-password', 'Público', 'authController.forgotPassword', 'Envía email con link de reset (token válido 1h)', 'rate-limit: 30 req/5min'],
  ['POST', '/api/auth/reset-password', 'Público', 'authController.resetPassword', 'Valida token de reset, establece nueva contraseña', 'rate-limit: 30 req/5min'],
  ['GET', '/api/health', 'Público', '(inline)', 'Health-check del servidor', ''],
  // CONDOMINIOS
  ['GET', '/api/condominios', 'Super Admin, Administrador', 'condominiosController.getAll', 'Lista todos los condominios', ''],
  ['POST', '/api/condominios', 'Super Admin', 'condominiosController.create', 'Crea nuevo condominio', ''],
  ['PUT', '/api/condominios/:id', 'Super Admin', 'condominiosController.update', 'Actualiza datos del condominio', ''],
  ['DELETE', '/api/condominios/:id', 'Super Admin', 'condominiosController.remove', 'Elimina condominio', ''],
  // USUARIOS
  ['GET', '/api/usuarios', 'Super Admin, Administrador', 'usuariosController.getAll', 'Lista todos los usuarios (sin passwords)', ''],
  ['POST', '/api/usuarios', 'Super Admin, Administrador', 'usuariosController.create', 'Crea usuario, envía email de bienvenida', ''],
  ['PUT', '/api/usuarios/:id', 'Self o Admin', 'usuariosController.update', 'Actualiza usuario (admins: todos los campos; self: solo nombre/teléfono)', 'requireSelfOrAdmin'],
  ['POST', '/api/usuarios/:id/change-password', 'Self o Admin', 'usuariosController.changePassword', 'Cambia contraseña validando la actual', 'requireSelfOrAdmin'],
  ['DELETE', '/api/usuarios/:id', 'Super Admin', 'usuariosController.remove', 'Elimina usuario', ''],
  // PROPIEDADES
  ['GET', '/api/propiedades', 'Super Admin, Administrador', 'propiedadesController.getAll', 'Lista todas las propiedades', ''],
  ['POST', '/api/propiedades', 'Super Admin, Administrador', 'propiedadesController.create', 'Crea propiedad (valida código único)', ''],
  ['PUT', '/api/propiedades/:id', 'Super Admin, Administrador', 'propiedadesController.update', 'Actualiza propiedad', ''],
  ['DELETE', '/api/propiedades/:id', 'Super Admin, Administrador', 'propiedadesController.remove', 'Elimina propiedad', ''],
  // PAGOS
  ['GET', '/api/pagos', 'Todos los roles', 'pagosController.getAll', 'Lista todos los pagos', ''],
  ['POST', '/api/pagos', 'SA, Admin, Propietario, Inquilino', 'pagosController.create', 'Registra pago con comprobante adjunto (multer)', 'upload.single("comprobante")'],
  ['PATCH', '/api/pagos/:id/status', 'Super Admin, Administrador', 'pagosController.updateStatus', 'Cambia estado del pago (pendiente/aprobado/rechazado)', ''],
  // ANUNCIOS
  ['GET', '/api/anuncios', 'Todos los roles', 'anunciosController.getAll', 'Lista todos los anuncios', ''],
  ['POST', '/api/anuncios', 'Super Admin, Administrador', 'anunciosController.create', 'Crea anuncio', ''],
  ['PUT', '/api/anuncios/:id', 'Super Admin, Administrador', 'anunciosController.update', 'Actualiza anuncio', ''],
  ['DELETE', '/api/anuncios/:id', 'Super Admin, Administrador', 'anunciosController.remove', 'Elimina anuncio', ''],
  // ASAMBLEAS
  ['GET', '/api/asambleas', 'Todos los roles', 'asambleasController.getAll', 'Lista asambleas (residentes ven solo su estado de voto)', ''],
  ['POST', '/api/asambleas', 'Super Admin, Administrador', 'asambleasController.create', 'Crea asamblea con documento adjunto', 'upload.single("document")'],
  ['PUT', '/api/asambleas/:id', 'Super Admin, Administrador', 'asambleasController.update', 'Actualiza asamblea (reemplaza archivo si se envía uno nuevo)', 'upload.single("document")'],
  ['DELETE', '/api/asambleas/:id', 'Super Admin, Administrador', 'asambleasController.remove', 'Elimina asamblea y su archivo en disco', ''],
  ['POST', '/api/asambleas/:id/vote', 'Todos los roles', 'asambleasController.vote', 'Registra voto (favor/contra/abstencion), un voto por usuario', ''],
  ['GET', '/api/asambleas/:id/document', 'Todos los roles', 'asambleasController.getDocument', 'Descarga documento de la asamblea', ''],
  // VISITAS
  ['GET', '/api/visitas', 'Todos los roles', 'visitasController.getAll', 'Lista todas las visitas', ''],
  ['POST', '/api/visitas', 'Todos los roles', 'visitasController.create', 'Registra visita, genera código QR (QR-######)', ''],
  ['GET', '/api/visitas/verify/:code', 'SA, Admin, Seguridad', 'visitasController.verify', 'Busca visita por código QR (usado en portería)', ''],
  ['PATCH', '/api/visitas/:id/status', 'SA, Admin, Seguridad', 'visitasController.updateStatus', 'Actualiza estado de visita (Activo/Finalizado)', ''],
  // HISTORIAL
  ['GET', '/api/historial-visitas', 'SA, Admin, Seguridad', 'historialController.getAll', 'Lista historial de entradas/salidas', ''],
  ['POST', '/api/historial-visitas', 'SA, Admin, Seguridad', 'historialController.create', 'Registra entrada o salida en el historial', ''],
  // PÁNICO
  ['GET', '/api/panic', 'Todos los roles', 'panicController.getAll', 'Lista alertas de pánico', ''],
  ['POST', '/api/panic', 'Todos los roles', 'panicController.create', 'Envía alerta de emergencia', ''],
  ['PATCH', '/api/panic/:id/status', 'SA, Admin, Seguridad', 'panicController.updateStatus', 'Marca alerta como atendida', ''],
], [8, 34, 30, 36, 60, 28]), '4. Rutas API');

// ── 5. BASE DE DATOS (HOJAS EXCEL) ───────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Hoja Excel', 'Campo', 'Tipo', 'Requerido', 'Descripción / Ejemplo'],
  // USUARIOS
  ['Usuarios', 'id', 'UUID string', 'Sí', 'Identificador único (uuid v4)'],
  ['Usuarios', 'name', 'string', 'Sí', 'Nombre completo del usuario'],
  ['Usuarios', 'email', 'string', 'Sí', 'Email único, usado para login'],
  ['Usuarios', 'password', 'bcrypt hash', 'Sí', 'Contraseña hasheada con bcryptjs (salt 10)'],
  ['Usuarios', 'role', 'string enum', 'Sí', 'Super Admin | Administrador | Propietario | Inquilino | Seguridad'],
  ['Usuarios', 'phone', 'string', 'No', 'Teléfono de contacto'],
  ['Usuarios', 'property', 'string/UUID', 'No', 'ID de la propiedad asignada (o "-")'],
  ['Usuarios', 'condo', 'string', 'No', 'Nombre del condominio (o "General" para SA)'],
  // CONDOMINIOS
  ['Condominios', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Condominios', 'name', 'string', 'Sí', 'Nombre del condominio'],
  ['Condominios', 'type', 'string', 'No', 'Tipo: "Condominio" | "Residencial" | "Edificio" | etc.'],
  ['Condominios', 'address', 'string', 'No', 'Dirección física'],
  ['Condominios', 'units', 'number', 'No', 'Número de unidades'],
  ['Condominios', 'plan', 'string', 'No', 'Plan contratado: Básico | Estándar | Premium'],
  // PROPIEDADES
  ['Propiedades', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Propiedades', 'condo', 'string', 'Sí', 'Nombre del condominio al que pertenece'],
  ['Propiedades', 'code', 'string', 'Sí', 'Código de la unidad (ej: "A-101"). Único por condominio.'],
  ['Propiedades', 'street', 'string', 'Sí', 'Calle o bloque descriptivo'],
  ['Propiedades', 'block', 'string', 'No', 'Bloque o torre (derivado del código)'],
  ['Propiedades', 'owner', 'string', 'Sí', 'Nombre del propietario'],
  ['Propiedades', 'tenant', 'string', 'No', 'Nombre del inquilino (o "-")'],
  ['Propiedades', 'debt', 'number', 'No', 'Deuda acumulada en moneda local'],
  // PAGOS
  ['Pagos', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Pagos', 'propiedad', 'string', 'No', 'Código o descripción de la propiedad'],
  ['Pagos', 'propietario', 'string', 'No', 'Nombre del propietario/inquilino'],
  ['Pagos', 'tipo', 'string', 'No', '"Expensa" | "Alícuota" | "Multa" | "Otro"'],
  ['Pagos', 'monto', 'number', 'Sí', 'Monto del pago'],
  ['Pagos', 'fecha', 'string', 'No', 'Fecha del pago en formato es-ES (D/M/YYYY)'],
  ['Pagos', 'estado', 'string', 'No', '"pendiente" | "aprobado" | "rechazado"'],
  ['Pagos', 'referencia', 'string', 'No', 'Referencia bancaria o número de transacción'],
  ['Pagos', 'comprobante', 'string', 'No', 'Nombre del archivo subido en /uploads/comprobantes/'],
  ['Pagos', 'resident', 'string', 'No', 'Nombre del residente que pagó'],
  ['Pagos', 'unit', 'string', 'No', 'Código de la unidad'],
  ['Pagos', 'dueDate', 'string', 'No', 'Fecha de vencimiento'],
  // ANUNCIOS
  ['Anuncios', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Anuncios', 'title', 'string', 'Sí', 'Título del anuncio'],
  ['Anuncios', 'message', 'string', 'No', 'Cuerpo del anuncio (también guardado como "content")'],
  ['Anuncios', 'condo', 'string', 'No', 'Condominio destino (nombre o "General" para todos)'],
  ['Anuncios', 'target', 'string', 'No', '"todos" | "propietarios" | "inquilinos" | "seguridad"'],
  ['Anuncios', 'createdByRole', 'string', 'No', 'Rol del creador'],
  ['Anuncios', 'dateLabel', 'string', 'No', 'Fecha legible en español'],
  ['Anuncios', 'author', 'string', 'No', 'Nombre del autor'],
  ['Anuncios', 'category', 'string', 'No', '"General" | "Mantenimiento" | "Seguridad" | "Finanzas" | etc.'],
  ['Anuncios', 'priority', 'string', 'No', '"Baja" | "Media" | "Alta" | "Urgente"'],
  // ASAMBLEAS
  ['Asambleas', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Asambleas', 'title', 'string', 'Sí', 'Título de la asamblea'],
  ['Asambleas', 'description', 'string', 'No', 'Descripción o agenda'],
  ['Asambleas', 'condo', 'string', 'No', 'Condominio al que pertenece'],
  ['Asambleas', 'startDate', 'string', 'Sí', 'Fecha de inicio de la asamblea'],
  ['Asambleas', 'dueDate', 'string', 'Sí', 'Fecha límite de votación'],
  ['Asambleas', 'documentName', 'string', 'No', 'Nombre original del archivo subido'],
  ['Asambleas', 'documentPath', 'string', 'No', 'Nombre del archivo guardado en /uploads/asambleas/'],
  ['Asambleas', 'createdAt', 'ISO timestamp', 'No', 'Fecha/hora de creación'],
  ['Asambleas', 'votesYes', 'number', 'No', 'Votos a favor'],
  ['Asambleas', 'votesNo', 'number', 'No', 'Votos en contra'],
  ['Asambleas', 'votesAbstencion', 'number', 'No', 'Abstenciones'],
  ['Asambleas', 'userVotesJSON', 'JSON string', 'No', 'Mapa de userId → tipo de voto (evita duplicados)'],
  // VISITAS
  ['Visitas', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Visitas', 'code', 'string', 'Sí', 'Código QR generado (formato: QR-######)'],
  ['Visitas', 'mode', 'string', 'No', '"peatonal" | "vehicular"'],
  ['Visitas', 'fullName', 'string', 'Sí', 'Nombre completo del visitante'],
  ['Visitas', 'idNumber', 'string', 'Sí', 'Número de cédula/pasaporte'],
  ['Visitas', 'property', 'string', 'Sí', 'Propiedad que visita'],
  ['Visitas', 'motive', 'string', 'Sí', 'Motivo de la visita'],
  ['Visitas', 'plate', 'string', 'No', 'Placa del vehículo (o "-")'],
  ['Visitas', 'createdBy', 'string', 'No', 'Nombre del usuario que registró la visita'],
  ['Visitas', 'createdAt', 'string', 'No', 'Fecha/hora de registro'],
  ['Visitas', 'status', 'string', 'No', '"Activo" | "Finalizado"'],
  // HISTORIAL
  ['Historial', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Historial', 'visitante', 'string', 'No', 'Nombre del visitante'],
  ['Historial', 'cedula', 'string', 'No', 'Número de identificación'],
  ['Historial', 'propiedad', 'string', 'No', 'Propiedad visitada'],
  ['Historial', 'tipo', 'string', 'No', '"Entrada" | "Salida"'],
  ['Historial', 'placa', 'string', 'No', 'Placa del vehículo (o "-")'],
  ['Historial', 'fecha', 'string', 'No', 'Fecha del registro (es-ES)'],
  ['Historial', 'entrada', 'string', 'No', 'Hora de entrada (timestamp HH:mm)'],
  ['Historial', 'salida', 'string', 'No', 'Hora de salida (o "-" si no ha salido)'],
  ['Historial', 'motivo', 'string', 'No', 'Motivo o método de acceso'],
  ['Historial', 'guard', 'string', 'No', 'Nombre del guardia que registró'],
  // PÁNICO
  ['Panico', 'id', 'UUID string', 'Sí', 'Identificador único'],
  ['Panico', 'resident', 'string', 'Sí', 'Nombre del residente que activó la alerta'],
  ['Panico', 'phone', 'string', 'No', 'Teléfono de contacto'],
  ['Panico', 'address', 'string', 'Sí', 'Dirección de la emergencia'],
  ['Panico', 'unit', 'string', 'No', 'Código de la unidad'],
  ['Panico', 'status', 'string', 'No', '"Pendiente" | "Atendido"'],
  ['Panico', 'createdAt', 'string', 'No', 'Hora de la alerta (HH:mm, es-ES)'],
], [16, 18, 14, 12, 62]), '5. Base de Datos');

// ── 6. ARCHIVOS DEL PROYECTO ──────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Archivo', 'Ruta completa', 'Descripción', 'Tamaño aprox.'],
  ['App.jsx', 'frontend/src/App.jsx', 'Aplicación React completa: Landing, Login, Dashboard con todos los módulos. Contiene todos los componentes y la lógica de UI.', '~6300 líneas'],
  ['styles.css', 'frontend/styles.css', 'Estilos globales para toda la aplicación, incluyendo dark mode con variables CSS (--dash-*) y overrides [data-theme="dark"].', '~6500 líneas'],
  ['api.js', 'frontend/src/api.js', 'Funciones de acceso a la API REST del backend. Maneja el token JWT y envía requests con fetch().', '~100 líneas'],
  ['main.jsx', 'frontend/src/main.jsx', 'Punto de entrada de React. Monta <App /> en el DOM.', '~10 líneas'],
  ['vite.config.js', 'frontend/vite.config.js', 'Configuración de Vite. Proxy de /api a localhost:3001 para desarrollo.', '~15 líneas'],
  ['server.js', 'backend/server.js', 'Punto de entrada del backend. Configura Express, middlewares, rutas y arranca el servidor.', '~70 líneas'],
  ['auth.js (middleware)', 'backend/src/middleware/auth.js', 'Middlewares de autenticación: requireAuth, requireRole, requireMinLevel, requireSelfOrAdmin.', '~50 líneas'],
  ['db.js', 'backend/src/data/db.js', 'readDB() y writeDB(): lectura y escritura del Excel (data.xlsx) con todas las hojas.', '~180 líneas'],
  ['seed.js', 'backend/src/data/seed.js', 'Datos iniciales del sistema (un Super Admin). Se usa si no existe data.xlsx.', '~30 líneas'],
  ['authController.js', 'backend/src/controllers/authController.js', 'Login, forgot-password, reset-password.', '~80 líneas'],
  ['condominiosController.js', 'backend/src/controllers/condominiosController.js', 'CRUD completo de condominios.', '~60 líneas'],
  ['usuariosController.js', 'backend/src/controllers/usuariosController.js', 'CRUD de usuarios + changePassword.', '~100 líneas'],
  ['propiedadesController.js', 'backend/src/controllers/propiedadesController.js', 'CRUD de propiedades con validación de código único.', '~70 líneas'],
  ['pagosController.js', 'backend/src/controllers/pagosController.js', 'Pagos: getAll, create (con multer), updateStatus.', '~70 líneas'],
  ['anunciosController.js', 'backend/src/controllers/anunciosController.js', 'CRUD de anuncios.', '~60 líneas'],
  ['asambleasController.js', 'backend/src/controllers/asambleasController.js', 'CRUD de asambleas + vote + getDocument. Maneja archivos adjuntos.', '~120 líneas'],
  ['visitasController.js', 'backend/src/controllers/visitasController.js', 'Visitas: getAll, create (genera QR), verify, updateStatus.', '~70 líneas'],
  ['historialController.js', 'backend/src/controllers/historialController.js', 'Historial de visitas: getAll, create.', '~40 líneas'],
  ['panicController.js', 'backend/src/controllers/panicController.js', 'Alertas de pánico: getAll, create, updateStatus.', '~50 líneas'],
  ['mailer.js', 'backend/src/services/mailer.js', 'Servicio de envío de emails con Nodemailer (bienvenida + reset de contraseña).', '~60 líneas'],
  ['dashboard.js', 'backend/src/services/dashboard.js', 'Computa el objeto dashboard para el login response según el rol del usuario.', '~60 líneas'],
  ['data.xlsx', 'data.xlsx', 'Base de datos principal. Se crea automáticamente si no existe. Hojas: Usuarios, Condominios, Propiedades, Pagos, Anuncios, Asambleas, Visitas, Historial, Panico.', 'Variable'],
  ['tokens.json', 'backend/tokens.json', 'Tokens temporales de recuperación de contraseña. JSON separado del Excel para no saturar la base de datos.', 'Variable'],
  ['DOCUMENTACION.xlsx', 'DOCUMENTACION.xlsx', 'Este archivo. Documentación completa del proyecto (actualizar a medida que avanza el desarrollo).', 'Variable'],
], [22, 42, 72, 18]), '6. Archivos del Proyecto');

// ── 7. HISTORIAL DE CAMBIOS ───────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Versión', 'Fecha', 'Módulo / Área', 'Cambio realizado', 'Archivos afectados'],
  ['v1.0', '2026-04-26', 'Landing Page', 'Centrado de sección "Seguridad Avanzada". Rediseño de sección "¿Por Qué Elegirnos?" con grid de 3 columnas adaptado a laptop. Footer con información real de contacto.', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Anuncios', 'Super Admin: selector de condominio destino como PRIMER campo en los modales de crear y editar anuncios.', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Anuncios / Inicio Propietario', 'Carrusel automático de anuncios en la pantalla de inicio del propietario/inquilino (auto-rotación cada 4.5 segundos).', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Historial de Visitas recientes', 'Panel de visitas recientes en dashboard: reemplaza nombres hardcodeados por datos reales del backend (historialVisitasData).', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Dashboards', 'Todos los dashboards (SA, Admin, Propietario) usan datos 100% reales del backend. Eliminados todos los valores estáticos/hardcodeados. Escalas dinámicas en gráficos.', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Mi Perfil', 'Fix de permisos: Propietario/Inquilino podían ver pero no guardar su perfil (error 403). Implementado middleware requireSelfOrAdmin.', 'backend/src/middleware/auth.js, backend/src/routes/usuarios.js, backend/src/controllers/usuariosController.js'],
  ['v1.0', '2026-04-26', 'Exportar Reportes', 'Botones de exportación Excel y PDF en: Pagos (Admin/SA), Morosos, Historial de Visitas. Usa SheetJS en frontend + ventana HTML para PDF.', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Toasts / Notificaciones', 'Fix de visibilidad: toasts tenían texto blanco sobre fondo blanco. Cambiado a fondo blanco con texto oscuro (#0f172a) y borde gris neutro (#e2e8f0).', 'styles.css'],
  ['v1.0', '2026-04-26', 'Asambleas', 'Header de asambleas en Super Admin alineado a la izquierda en laptops (corrige centrado que se veía mal).', 'styles.css'],
  ['v1.0', '2026-04-26', 'Condominios (SA)', 'Tarjetas de condominios con métricas reales: propiedades, usuarios, deuda total, pagos pendientes. CRUD completo (crear, editar, eliminar condominio).', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Historial de Visitas del Propietario', 'Panel en pantalla de inicio del propietario/inquilino que muestra historial de visitas filtrado por su unidad (datos reales).', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Mis Reservas', 'Pantalla de reservas de áreas comunes para propietarios/inquilinos (piscina, salón, gym, cancha, BBQ). Solo frontend, sin persistencia en backend.', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Cambio de Contraseña', 'Funcionalidad de cambio de contraseña en Mi Perfil: valida contraseña actual, exige mínimo 8 caracteres, confirmación.', 'App.jsx, backend/src/controllers/usuariosController.js, backend/src/routes/usuarios.js'],
  ['v1.0', '2026-04-26', 'Gráficos Super Admin', 'Dashboard SA con gráficos reales: pagos mensuales por condominio seleccionado, visitas por día, tipo de acceso (peatonal/vehicular), morosos. Selector de condominio.', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Dark Mode / Light Mode', 'Toggle de tema oscuro/claro en sidebar y landing. Persiste en localStorage. Variables CSS --dash-* con overrides [data-theme="dark"] para TODOS los componentes.', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Pagar Expensas', 'Modal completamente funcional: muestra deuda real de la propiedad, campo de monto editable, referencia bancaria, adjuntar comprobante (PDF/imagen max 8MB). Envía con FormData. Multer en backend.', 'App.jsx, backend/src/controllers/pagosController.js, backend/src/routes/pagos.js, backend/src/dto/pagoDto.js, backend/src/data/db.js'],
  ['v1.0', '2026-04-26', 'Ver Comprobante (Admin)', 'Botón "Ver comprobante" en tabla de pagos (Admin/SA) que abre el archivo adjunto en nueva pestaña (/uploads/comprobantes/archivo).', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Gráficos SA - Fix sintaxis', 'Fix de error de sintaxis JSX en renderSuperAdminDashboardScreen: múltiples hijos sin Fragment wrapper en expresión &&. Separado en dos expresiones condicionales.', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Dark Mode FAB', 'Reemplazado botón rectangular con texto en sidebar por circulito flotante fijo (position: fixed, bottom-left) con solo ícono. No interfiere con el contenido.', 'App.jsx, styles.css'],
  ['v1.0', '2026-04-26', 'Historial export fix', 'Fix: la función de exportación ignoraba su parámetro data y leía window.__historialVisitas (siempre vacío). Ahora recibe filteredHistorialVisitas directamente.', 'App.jsx'],
  ['v1.0', '2026-04-26', 'Ruta POST /api/pagos', 'Cambio de ADMIN-only a RESIDENTS (SA, Admin, Propietario, Inquilino) para que los residentes puedan registrar sus pagos.', 'backend/src/routes/pagos.js'],
  ['v1.0', '2026-04-26', 'Historial DTO - fecha', 'Agregado campo fecha (fecha actual en es-ES) al HistorialDTO para poder agrupar visitas por día en los gráficos.', 'backend/src/dto/historialDto.js, backend/src/data/db.js'],
], [8, 12, 28, 80, 60]), '7. Historial de Cambios');

// ── 8. FLUJOS PRINCIPALES ─────────────────────────────────────────────────
XLSX.utils.book_append_sheet(wb, sheet([
  ['Flujo', 'Paso', 'Actor', 'Acción', 'Endpoint / Función', 'Notas'],
  ['Login', '1', 'Usuario', 'Ingresa email y contraseña', 'POST /api/auth/login', ''],
  ['Login', '2', 'Backend', 'Valida credenciales con bcrypt, genera JWT 24h', '—', 'Devuelve token + objeto user con dashboard data'],
  ['Login', '3', 'Frontend', 'Guarda token en localStorage, redirige al dashboard', '—', 'Role determina qué secciones se muestran'],
  [''],
  ['Pagar Expensas', '1', 'Propietario/Inquilino', 'Abre modal "Pagar Expensas" → ve su deuda real', '—', 'myDebt calculado de pagos pendientes de su unidad'],
  ['Pagar Expensas', '2', 'Propietario/Inquilino', 'Completa monto, referencia y adjunta comprobante', '—', 'FormData: monto, referencia, unit, resident, archivo'],
  ['Pagar Expensas', '3', 'Frontend', 'Envía FormData a la API', 'POST /api/pagos (multipart)', 'Multer guarda archivo en /uploads/comprobantes/'],
  ['Pagar Expensas', '4', 'Admin', 'Ve el pago en sección Pagos, abre comprobante, aprueba/rechaza', 'PATCH /api/pagos/:id/status', 'Estado cambia: pendiente → aprobado/rechazado'],
  [''],
  ['Visita con QR', '1', 'Propietario', 'Registra visita: nombre, cédula, motivo, propiedad', 'POST /api/visitas', 'Backend genera código QR-######'],
  ['Visita con QR', '2', 'Visitante', 'Llega a la portería, muestra su código QR', '—', ''],
  ['Visita con QR', '3', 'Seguridad', 'Escanea / ingresa el código QR', 'GET /api/visitas/verify/:code', 'Ve nombre, propiedad, motivo del visitante'],
  ['Visita con QR', '4', 'Seguridad', 'Registra entrada en historial', 'POST /api/historial-visitas', 'tipo: "Entrada", timestamp automático'],
  ['Visita con QR', '5', 'Seguridad', 'Al salir, registra salida', 'POST /api/historial-visitas + PATCH status', 'tipo: "Salida", actualiza estado visita a Finalizado'],
  [''],
  ['Asamblea + Votación', '1', 'Admin', 'Crea asamblea con título, descripción, fechas y documento', 'POST /api/asambleas (multipart)', 'Archivo guardado en /uploads/asambleas/'],
  ['Asamblea + Votación', '2', 'Residente', 'Ve la asamblea en su pantalla', 'GET /api/asambleas', ''],
  ['Asamblea + Votación', '3', 'Residente', 'Vota: A favor / En contra / Abstención', 'POST /api/asambleas/:id/vote', 'Un voto por usuario. userVotesJSON almacena el mapa userId→voto'],
  [''],
  ['Recuperar Contraseña', '1', 'Usuario', 'Ingresa su email en "¿Olvidaste tu contraseña?"', 'POST /api/auth/forgot-password', 'Siempre devuelve éxito (seguridad: no revela si existe)'],
  ['Recuperar Contraseña', '2', 'Backend', 'Guarda token en tokens.json, envía email con link', '—', 'Link: FRONTEND_URL/reset-password?token=...'],
  ['Recuperar Contraseña', '3', 'Usuario', 'Hace clic en el link, ingresa nueva contraseña', 'POST /api/auth/reset-password', 'Token expira en 1 hora'],
  [''],
  ['Alerta de Pánico', '1', 'Residente', 'Presiona el botón de pánico en la app', 'POST /api/panic', 'Se registra con nombre, dirección, unidad, teléfono'],
  ['Alerta de Pánico', '2', 'Admin/Seguridad', 'Ve la alerta en su panel de Pánico', 'GET /api/panic', 'Estado: "Pendiente"'],
  ['Alerta de Pánico', '3', 'Admin/Seguridad', 'Atiende la emergencia y marca como atendida', 'PATCH /api/panic/:id/status', 'Estado: "Atendido"'],
], [22, 6, 22, 40, 36, 52]), '8. Flujos Principales');

// guardar
XLSX.writeFile(wb, OUT);
console.log('✅ Documentación generada en:', OUT);
