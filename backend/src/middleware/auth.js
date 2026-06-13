const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const ROLE_LEVEL = {
  'Super Admin':   5,
  'Administrador': 4,
  'Propietario':   3,
  'Inquilino':     3,
  'Seguridad':     2,
};

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — sesión requerida' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'La sesión expiró. Ingresá nuevamente.'
      : 'Token inválido.';
    return res.status(401).json({ error: msg, expired: err.name === 'TokenExpiredError' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos suficientes para esta acción' });
    }
    next();
  };
}

function requireMinLevel(level) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if ((ROLE_LEVEL[req.user.role] || 0) < level) {
      return res.status(403).json({ error: 'Sin permisos suficientes para esta acción' });
    }
    next();
  };
}

function requireSelfOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const isAdmin = ['Super Admin', 'Administrador'].includes(req.user.role);
  const isSelf  = String(req.user.id) === String(req.params.id);
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Sin permisos suficientes para esta acción' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireMinLevel, requireSelfOrAdmin };
