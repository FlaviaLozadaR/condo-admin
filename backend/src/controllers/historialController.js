const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const HistorialDTO = require('../dto/historialDto');

async function getAll(req, res) {
  try {
    const { page, limit, tipo, q, condo } = req.query;
    if (page) {
      const result = await db.getHistorialPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        tipo, q, condo,
      });
      return res.json({ ...result, data: result.data.map(HistorialDTO.toResponse) });
    }
    res.json(await db.getHistorial());
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = HistorialDTO.fromRequest(req.body);
    const nuevo = await db.createHistorial({ id: uuid(), ...data });
    res.status(201).json(HistorialDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

module.exports = { getAll, create };
