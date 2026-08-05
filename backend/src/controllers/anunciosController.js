const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const AnuncioDTO = require('../dto/anuncioDto');
const fcm = require('../services/fcm');

const TARGET_ROLES = {
  'Todos':            ['Propietario', 'Inquilino', 'Seguridad', 'Administrador', 'Super Admin'],
  'Propietarios':     ['Propietario'],
  'Inquilinos':       ['Inquilino'],
  'Seguridad':        ['Seguridad'],
  'Administradores':  ['Administrador', 'Super Admin'],
};

async function getAll(req, res) {
  try {
    const { page, limit, dateFilter } = req.query;
    // Solo Super Admin puede elegir condominio por query — el resto queda fijo al suyo.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getAnunciosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        condo,
        dateFilter,
        viewerRole: req.user.role,
      });
      return res.json({ ...result, data: result.data.map(AnuncioDTO.toResponse) });
    }
    res.json(await db.getAnuncios(condo));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data = AnuncioDTO.fromRequest(req.body);
    // El condominio y el rol creador los decide el servidor, no el cliente.
    if (req.user.role !== 'Super Admin') data.condo = req.user.condo;
    data.createdByRole = req.user.role;
    const nuevo = await db.createAnuncio({ id: uuid(), ...data });

    // Notificar a los roles que corresponden según el target del anuncio
    const roles = TARGET_ROLES[nuevo.target] || TARGET_ROLES['Todos'];
    fcm.notifyRole(nuevo.condo, roles, 'announcement',
      'Nuevo anuncio',
      nuevo.title || 'Hay un nuevo anuncio en tu condominio',
      { type: 'announcement', anuncioId: nuevo.id }
    ).catch(() => {});

    res.status(201).json(AnuncioDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const existing = (await db.getAnuncios()).find(a => String(a.id) === String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Anuncio no encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const { title, message, target } = req.body || {};
    const changes = {
      ...(title?.trim()         && { title: title.trim() }),
      ...(message !== undefined && { message }),
      ...(target                && { target }),
    };
    const updated = await db.updateAnuncio(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'Anuncio no encontrado' });
    res.json(AnuncioDTO.toResponse(updated));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const existing = (await db.getAnuncios()).find(a => String(a.id) === String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Anuncio no encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    await db.deleteAnuncio(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove };
