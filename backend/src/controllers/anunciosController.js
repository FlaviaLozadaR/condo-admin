const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const AnuncioDTO = require('../dto/anuncioDto');

async function getAll(req, res) {
  try {
    const { page, limit, condo } = req.query;
    if (page) {
      const result = await db.getAnunciosPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        condo,
        viewerRole: req.user.role,
      });
      return res.json({ ...result, data: result.data.map(AnuncioDTO.toResponse) });
    }
    res.json(await db.getAnuncios());
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = AnuncioDTO.fromRequest(req.body);
    const nuevo = await db.createAnuncio({ id: uuid(), ...data });
    res.status(201).json(AnuncioDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
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
    await db.deleteAnuncio(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, update, remove };
