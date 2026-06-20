const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db     = require('../data/db');
const UserDTO = require('../dto/userDto');
const { sendWelcomeEmail } = require('../services/mailer');

async function getAll(req, res) {
  try {
    const { page, limit, q, role } = req.query;
    // Administrador solo puede ver su propio condominio, sin importar lo que mande el cliente.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getUsuariosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        q, condo, role,
      });
      return res.json({ ...result, data: result.data.map(UserDTO.toResponse) });
    }
    const usuarios = await db.getUsuarios(condo);
    res.json(usuarios.map(UserDTO.toResponse));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function getSeguridad(req, res) {
  try {
    const condo = req.user.role === 'Super Admin' ? undefined : req.user.condo;
    const data = await db.getSeguridadContacts(condo);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// Un Administrador solo puede asignar estos roles — Super Admin y Administrador
// quedan reservados para que los gestione únicamente un Super Admin.
const ROLES_ASIGNABLES_POR_ADMIN = ['Propietario', 'Inquilino', 'Seguridad'];

async function create(req, res) {
  try {
    const data = UserDTO.fromRequest(req.body);

    if (req.user.role !== 'Super Admin') {
      if (!ROLES_ASIGNABLES_POR_ADMIN.includes(data.role)) {
        return res.status(403).json({ error: 'Solo un Super Admin puede asignar ese rol' });
      }
      // Un Administrador solo puede crear usuarios en su propio condominio.
      data.condo = req.user.condo;
    }

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
    const isAdmin      = ['Super Admin', 'Administrador'].includes(req.user?.role);
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const { name, email, phone, role, property, condo } = req.body || {};

    if (role && isAdmin && !isSuperAdmin && !ROLES_ASIGNABLES_POR_ADMIN.includes(role)) {
      return res.status(403).json({ error: 'Solo un Super Admin puede asignar ese rol' });
    }

    if (isAdmin && !isSuperAdmin) {
      // Un Administrador solo puede tocar residentes/seguridad de su propio
      // condominio — nunca a otro Admin/Super Admin, ni reasignarlos de condominio.
      const target = await db.getUsuarioById(req.params.id);
      if (!target || target.condo !== req.user.condo || !ROLES_ASIGNABLES_POR_ADMIN.includes(target.role)) {
        return res.status(403).json({ error: 'No autorizado para este usuario' });
      }
    }

    const changes = {
      ...(name  && { name }),
      ...(phone !== undefined && { phone }),
      ...(isAdmin && email    && { email }),
      ...(isAdmin && role     && { role }),
      ...(isAdmin && property !== undefined && { property }),
      ...(isSuperAdmin && condo !== undefined && { condo }),
    };

    const updated = await db.updateUsuario(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(UserDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    if (req.user.role === 'Administrador') {
      // Un Administrador solo puede borrar residentes/seguridad de su propio
      // condominio — nunca a otro Admin ni a un Super Admin.
      const target = await db.getUsuarioById(req.params.id);
      if (!target || target.condo !== req.user.condo || !ROLES_ASIGNABLES_POR_ADMIN.includes(target.role)) {
        return res.status(403).json({ error: 'No autorizado para este usuario' });
      }
    }
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

    const isSuperAdmin = req.user?.role === 'Super Admin';
    const isAdmin = ['Super Admin', 'Administrador'].includes(req.user?.role);
    const isSelf  = String(req.user?.id) === String(req.params.id);

    // Un Administrador solo puede resetear contraseñas de residentes/seguridad
    // de su propio condominio — nunca de otro Admin ni de un Super Admin.
    if (isAdmin && !isSuperAdmin && !isSelf) {
      if (user.condo !== req.user.condo || !ROLES_ASIGNABLES_POR_ADMIN.includes(user.role)) {
        return res.status(403).json({ error: 'No autorizado para modificar este usuario' });
      }
    }

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

module.exports = { getAll, create, update, remove, changePassword, getSeguridad };
