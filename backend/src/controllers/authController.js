const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db     = require('../data/db');
const { computeDashboard } = require('../services/dashboard');
const { sendResetEmail }   = require('../services/mailer');

const JWT_SECRET = process.env.JWT_SECRET;

const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutos
const loginAttempts = new Map();       // email → { count, lockedUntil }

// Limpia entradas viejas cada hora para no acumular memoria
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (val.lockedUntil < now && val.count < MAX_ATTEMPTS) loginAttempts.delete(key);
    else if (val.lockedUntil < now - LOCKOUT_MS)           loginAttempts.delete(key);
  }
}, 60 * 60 * 1000);

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const key    = email.trim().toLowerCase();
    const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };

    if (record.lockedUntil > Date.now()) {
      const minsLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intentá nuevamente en ${minsLeft} minuto${minsLeft !== 1 ? 's' : ''}.`
      });
    }

    const user = await db.getUsuarioByEmail(email.trim());
    const valid = user && await bcrypt.compare(password, user.password);

    if (!valid) {
      record.count += 1;
      if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_MS;
        loginAttempts.set(key, record);
        return res.status(429).json({
          error: `Demasiados intentos fallidos. Tu cuenta está bloqueada por 15 minutos.`
        });
      }
      const remaining = MAX_ATTEMPTS - record.count;
      loginAttempts.set(key, record);
      return res.status(401).json({
        error: `Credenciales inválidas. Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} intento${remaining !== 1 ? 's' : ''}.`
      });
    }

    loginAttempts.delete(key);

    const condo     = user.role === 'Super Admin' ? undefined : user.condo;
    const dbData    = await db.getDataForDashboard(condo);
    const dashboard = computeDashboard(user, dbData);
    const token     = jwt.sign({ id: user.id, role: user.role, condo: user.condo || null }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userClean } = user;

    res.json({ token, user: { ...userClean, dashboard } });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await db.getUsuarioByEmail(email.trim());
    if (!user) return res.json({ ok: true }); // No revelar si existe

    const token = uuid();
    await db.createResetToken(token, user.email, Date.now() + 60 * 60 * 1000);

    await sendResetEmail(user.email, user.name, token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Error al enviar el email. Verificá la configuración en .env' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const entry = await db.getResetToken(token);
    if (!entry) return res.status(400).json({ error: 'Token inválido o ya utilizado' });
    if (Date.now() > entry.expiresAt) return res.status(400).json({ error: 'El link expiró. Solicitá uno nuevo.' });

    const user = await db.getUsuarioByEmail(entry.email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.updateUsuario(user.id, { password: await bcrypt.hash(password, 10) });
    await db.markTokenUsed(token);
    res.json({ ok: true });
  } catch (e) {
    console.error('Reset password error:', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function me(req, res) {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    const condo     = user.role === 'Super Admin' ? undefined : user.condo;
    const dbData    = await db.getDataForDashboard(condo);
    const dashboard = computeDashboard(user, dbData);
    const { password: _, ...userClean } = user;
    res.json({ user: { ...userClean, dashboard } });
  } catch (e) {
    console.error('Me error:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, forgotPassword, resetPassword, me };
