const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db     = require('../data/db');
const UserDTO = require('../dto/userDto');
const { sendWelcomeEmail } = require('../services/mailer');

async function getAll(req, res) {
  try {
    const { page, limit, q, condo } = req.query;
    if (page) {
      const result = await db.getUsuariosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        q, condo,
      });
      return res.json({ ...result, data: result.data.map(UserDTO.toResponse) });
    }
    const usuarios = await db.getUsuarios();
    res.json(usuarios.map(UserDTO.toResponse));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = UserDTO.fromRequest(req.body);
    const exists = await db.getUsuarioByEmail(data.email);
    if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    const plainPassword = data.password || '123456';
    const nuevo = await db.createUsuario({
      id: uuid(),
      ...data,
      password: await bcrypt.hash(plainPassword, 10),
    });

    let emailSent = false, emailError = null;
    try {
      await sendWelcomeEmail(nuevo.email, nuevo.name, plainPassword, nuevo.role);
      emailSent = true;
    } catch (err) {
      emailError = err.message;
      console.error('Email de bienvenida no enviado:', err.message);
    }

    res.status(201).json({ ...UserDTO.toResponse(nuevo), emailSent, emailError, tempPassword: plainPassword });
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const isAdmin = ['Super Admin', 'Administrador'].includes(req.user?.role);
    const { name, email, phone, role, property, condo } = req.body || {};

    const changes = {
      ...(name  && { name }),
      ...(phone !== undefined && { phone }),
      ...(isAdmin && email    && { email }),
      ...(isAdmin && role     && { role }),
      ...(isAdmin && property !== undefined && { property }),
      ...(isAdmin && condo    !== undefined && { condo }),
    };

    const updated = await db.updateUsuario(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(UserDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    await db.deleteUsuario(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ error: 'Nueva contraseña requerida' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });

    const user = await db.getUsuarioById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const isAdmin = ['Super Admin', 'Administrador'].includes(req.user?.role);
    const isSelf  = String(req.user?.id) === String(req.params.id);

    // Admins can reset any user's password without knowing the current one
    if (!isAdmin) {
      if (!currentPassword) return res.status(400).json({ error: 'Contraseña actual requerida' });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    await db.updateUsuario(user.id, { password: await bcrypt.hash(newPassword, 10) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, changePassword };
