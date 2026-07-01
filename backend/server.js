require('dotenv').config();

// ── Validate required env vars ─────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[STARTUP ERROR] Faltan variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');
const path      = require('path');
const fs        = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/swagger');

const app = express();

// Detrás de un solo proxy inverso (Render/Heroku/etc.) — sin esto, el rate
// limiter ve la IP del proxy para todos los usuarios en vez de la real.
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // CSP desactivado para el panel admin (HTML con scripts inline en /public)
  // La API misma sigue protegida por JWT — el CSP no afecta eso
  contentSecurityPolicy: false,
}));

// ── CORS — only allow known origins ───────────────────────────
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.APP_URL,      // el panel admin se sirve desde el propio backend
  'http://localhost:3001',
  'http://localhost:4173',
  'https://localhost',      // app móvil (Capacitor Android)
  'capacitor://localhost',  // app móvil (Capacitor iOS)
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origen no permitido — ${origin}`));
  },
  credentials: true,
}));

// ── Global rate limit (2000 req / 15 min por IP) ──────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intentá más tarde.' },
}));

// ── Request logging ────────────────────────────────────────────
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));

// ── Body parsing (limit payload size) ─────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── reset-password.html served dynamically (injects FRONTEND_URL) ─
app.get('/reset-password.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'reset-password.html');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const html = fs.readFileSync(filePath, 'utf8').replace(/\{\{FRONTEND_URL\}\}/g, frontendUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Static files (admin panel) ─────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Uploaded documents (authenticated via route-level middleware in asambleas routes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API docs (Swagger UI) — solo documentación, no requiere login para
// verla; cada endpoint protegido sigue pidiendo su token vía "Authorize".
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',              require('./src/routes/auth'));
app.use('/api/condominios',       require('./src/routes/condominios'));
app.use('/api/usuarios',          require('./src/routes/usuarios'));
app.use('/api/propiedades',       require('./src/routes/propiedades'));
app.use('/api/pagos',             require('./src/routes/pagos'));
app.use('/api/anuncios',          require('./src/routes/anuncios'));
app.use('/api/asambleas',         require('./src/routes/asambleas'));
app.use('/api/visitas',           require('./src/routes/visitas'));
app.use('/api/historial-visitas', require('./src/routes/historial'));
app.use('/api/panic',             require('./src/routes/panic'));
app.use('/api/areas-sociales',    require('./src/routes/areasSociales'));
app.use('/api/reservas-areas',    require('./src/routes/reservasAreas'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── 404 handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Global error handler ───────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Backend corriendo en http://localhost:${PORT}`);
  console.log(`✓ Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Email:   ${process.env.BREVO_SENDER_EMAIL}`);
  console.log(`✓ Docs:    http://localhost:${PORT}/api-docs\n`);
});
