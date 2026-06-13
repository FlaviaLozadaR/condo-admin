const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { uploadFile, deleteFile } = require('../services/supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Solo imágenes JPG, PNG o WEBP.'));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

async function getAdminCondo(req) {
  if (req.user.role !== 'Administrador') return null;
  const user = await db.getUsuarioById(req.user.id);
  return user?.condo || null;
}

async function getAll(req, res) {
  try {
    const areas = await db.getAreasSociales();
    if (req.user.role === 'Administrador') {
      const condo = await getAdminCondo(req);
      return res.json(areas.filter(a => a.condo === condo));
    }
    // Residentes: filtrar por su condo
    if (['Propietario', 'Inquilino'].includes(req.user.role)) {
      const user = await db.getUsuarioById(req.user.id);
      return res.json(areas.filter(a => a.condo === user?.condo && a.activo !== false));
    }
    res.json(areas);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const { nombre, descripcion, precio, condo: condoBody } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const condo = req.user.role === 'Administrador'
      ? (await getAdminCondo(req))
      : (condoBody || '');

    let imagenUrl = '';
    if (req.file) {
      const ext      = path.extname(req.file.originalname).toLowerCase();
      const filename = `area_${Date.now()}_${uuid()}${ext}`;
      imagenUrl = await uploadFile(req.file.buffer, 'areas-sociales', filename, req.file.mimetype);
    }

    const nueva = await db.createAreaSocial({
      id:          uuid(),
      condo,
      nombre:      nombre.trim(),
      descripcion: descripcion || '',
      precio:      Math.max(0, Number(precio) || 0),
      imagenUrl,
      activo:      true,
    });
    res.status(201).json(nueva);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const areas   = await db.getAreasSociales();
    const area    = areas.find(a => String(a.id) === String(id));
    if (!area) return res.status(404).json({ error: 'Área no encontrada' });

    if (req.user.role === 'Administrador') {
      const condo = await getAdminCondo(req);
      if (area.condo !== condo) return res.status(403).json({ error: 'Sin permisos' });
    }

    let imagenUrl = area.imagenUrl || '';
    if (req.file) {
      if (imagenUrl) await deleteFile('areas-sociales', imagenUrl).catch(() => {});
      const ext      = path.extname(req.file.originalname).toLowerCase();
      const filename = `area_${Date.now()}_${uuid()}${ext}`;
      imagenUrl = await uploadFile(req.file.buffer, 'areas-sociales', filename, req.file.mimetype);
    }

    const { nombre, descripcion, precio, activo } = req.body || {};
    const changes = {
      ...(nombre?.trim()           && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(precio      !== undefined && { precio: Math.max(0, Number(precio) || 0) }),
      ...(activo      !== undefined && { activo: activo === 'true' || activo === true }),
      imagenUrl,
    };
    const updated = await db.updateAreaSocial(id, changes);
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const areas   = await db.getAreasSociales();
    const area    = areas.find(a => String(a.id) === String(id));
    if (!area) return res.status(404).json({ error: 'Área no encontrada' });

    if (req.user.role === 'Administrador') {
      const condo = await getAdminCondo(req);
      if (area.condo !== condo) return res.status(403).json({ error: 'Sin permisos' });
    }

    if (area.imagenUrl) await deleteFile('areas-sociales', area.imagenUrl).catch(() => {});
    await db.deleteAreaSocial(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, upload };
