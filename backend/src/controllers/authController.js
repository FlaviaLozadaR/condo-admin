const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db     = require('../data/db');
const { computeDashboard } = require('../services/dashboard');
const { sendResetEmail }   = require('../services/mailer');

const JWT_SECRET = process.env.JWT_SECRET;

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const user = await db.getUsuarioByEmail(email.trim());
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const dbData    = await db.getDataForDashboard();
    const dashboard = computeDashboard(user, dbData);
    const token     = jwt.sign({ id: user.id, role: user.role, condo: user.condo || null }, JWT_SECRET, { expiresIn: '24h' });
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

module.exports = { login, forgotPassword, resetPassword };
