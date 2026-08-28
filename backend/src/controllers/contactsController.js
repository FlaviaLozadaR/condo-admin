const { v4: uuid } = require('uuid');
const multer         = require('multer');
const path           = require('path');
const db             = require('../data/db');
const { uploadFile, deleteFile } = require('../services/supabase');

const BUCKET = 'contacts';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const RESIDENTS = ['Propietario', 'Inquilino', 'Residente'];

async function getAll(req, res) {
  try {
    const { role, condo, id: userId } = req.user;
    const ownerOnly = RESIDENTS.includes(role) ? userId : null;
    const items = await db.getContacts(condo, ownerOnly);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function getById(req, res) {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(contact);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const { fullName, idNumber, property, notes } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    if (!property?.trim())  return res.status(400).json({ error: 'Propiedad requerida' });
    const nuevo = await db.createContact({
      id:        uuid(),
      condoId:   req.user.condo,
      createdBy: req.user.id,
      fullName:  fullName.trim(),
      idNumber:  idNumber?.trim()  || '',
      property:  property.trim(),
      notes:     notes?.trim()     || '',
      photos:    [],
    });
    res.status(201).json(nuevo);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const fields = ['fullName', 'idNumber', 'property', 'notes'];
    const changes = Object.fromEntries(
      fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f].trim()])
    );
    const updated = await db.updateContact(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
    if (contact.photos?.length) {
      await Promise.all(contact.photos.map(url => deleteFile(BUCKET, url.split('/').pop()).catch(() => {})));
    }
    await db.deleteContact(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function addPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna foto' });
    const contact = await db.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });

    const ext      = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `${Date.now()}_${uuid()}${ext}`;
    const url      = await uploadFile(req.file.buffer, BUCKET, filename, req.file.mimetype);

    const photos  = [...(contact.photos || []), url];
    const updated = await db.updateContact(req.params.id, { photos });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function removePhoto(req, res) {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });

    const idx    = parseInt(req.params.index, 10);
    const photos = contact.photos || [];
    if (idx < 0 || idx >= photos.length) return res.status(400).json({ error: 'Índice inválido' });

    await deleteFile(BUCKET, photos[idx].split('/').pop()).catch(() => {});
    const updated = await db.updateContact(req.params.id, { photos: photos.filter((_, i) => i !== idx) });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { upload, getAll, getById, create, update, remove, addPhoto, removePhoto };
