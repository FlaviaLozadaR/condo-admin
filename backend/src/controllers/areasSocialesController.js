const path   = require('path');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { uploadPrivateFile, getSignedUrl, deleteFile } = require('../services/supabase');

const MAX_IMAGENES = 6;

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Solo imágenes JPG, PNG o WEBP.'));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

// El campo imagenUrl puede guardar una URL simple o, cuando el área tiene
// varias fotos, un array de URLs serializado como JSON.
function parseImagenes(imagenUrl) {
  if (!imagenUrl) return [];
  const trimmed = String(imagenUrl).trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch { /* no era JSON, tratar como URL simple */ }
  }
  return [trimmed];
}

function serializeImagenes(urls) {
  if (!urls.length) return '';
  return JSON.stringify(urls);
}

async function uploadImagenes(files) {
  const urls = [];
  for (const file of files) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const filename = `area_${Date.now()}_${uuid()}${ext}`;
    urls.push(await uploadPrivateFile(file.buffer, 'areas-sociales', filename, file.mimetype));
  }
  return urls;
}

// imagenUrl se guarda como nombre(s) de archivo (bucket privado) — al
// devolver el área al cliente se reemplazan por links firmados, válidos 10 minutos.
async function withSignedImages(area) {
  const filenames = parseImagenes(area.imagenUrl);
  if (!filenames.length) return area;
  const signed = await Promise.all(
    filenames.map((f) => getSignedUrl('areas-sociales', f, 600).catch(() => ''))
  );
  return { ...area, imagenUrl: signed.filter(Boolean) };
}

async function getAdminCondo(req) {
  if (req.user.role !== 'Administrador') return null;
  const user = await db.getUsuarioById(req.user.id);
  return user?.condo || null;
}

async function getAll(req, res) {
  try {
    const areas = await db.getAreasSociales();
    let filtered = areas;
    if (req.user.role === 'Administrador') {
      const condo = await getAdminCondo(req);
      filtered = areas.filter(a => a.condo === condo);
    } else if (['Propietario', 'Inquilino'].includes(req.user.role)) {
      const user = await db.getUsuarioById(req.user.id);
      filtered = areas.filter(a => a.condo === user?.condo && a.activo !== false);
    }
    res.json(await Promise.all(filtered.map(withSignedImages)));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const { nombre, descripcion, precio, condo: condoBody } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const condo = req.user.role === 'Administrador'
      ? (await getAdminCondo(req))
      : (condoBody || '');

    if ((req.files?.length || 0) > MAX_IMAGENES) {
      return res.status(400).json({ error: `Máximo ${MAX_IMAGENES} fotos por área` });
    }

    const imagenUrl = serializeImagenes(await uploadImagenes(req.files || []));

    const nueva = await db.createAreaSocial({
      id:          uuid(),
      condo,
      nombre:      nombre.trim(),
      descripcion: descripcion || '',
      precio:      Math.max(0, Number(precio) || 0),
      imagenUrl,
      activo:      true,
    });
    res.status(201).json(await withSignedImages(nueva));
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

    const existentes = parseImagenes(area.imagenUrl); // nombres de archivo guardados en la DB
    let conservadas = existentes;
    if (req.body.imagenesActuales !== undefined) {
      try {
        const lista = JSON.parse(req.body.imagenesActuales);
        // El cliente recibió links firmados (con token y query string), no
        // nombres de archivo — comparamos solo por el nombre base del archivo.
        if (Array.isArray(lista)) {
          const keepNames = lista.map((u) => String(u).split('?')[0].split('/').pop());
          conservadas = existentes.filter((u) => keepNames.includes(u));
        }
      } catch { /* ignorar valor inválido, conservar todas */ }
    }

    if (conservadas.length + (req.files?.length || 0) > MAX_IMAGENES) {
      return res.status(400).json({ error: `Máximo ${MAX_IMAGENES} fotos por área` });
    }

    const eliminadas = existentes.filter(u => !conservadas.includes(u));
    await Promise.all(eliminadas.map(u => deleteFile('areas-sociales', u).catch(() => {})));

    const nuevasUrls = await uploadImagenes(req.files || []);
    const imagenUrl  = serializeImagenes([...conservadas, ...nuevasUrls]);

    const { nombre, descripcion, precio, activo } = req.body || {};
    const changes = {
      ...(nombre?.trim()           && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(precio      !== undefined && { precio: Math.max(0, Number(precio) || 0) }),
      ...(activo      !== undefined && { activo: activo === 'true' || activo === true }),
      imagenUrl,
    };
    const updated = await db.updateAreaSocial(id, changes);
    res.json(await withSignedImages(updated));
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

    await Promise.all(parseImagenes(area.imagenUrl).map(u => deleteFile('areas-sociales', u).catch(() => {})));
    await db.deleteAreaSocial(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove, upload };
