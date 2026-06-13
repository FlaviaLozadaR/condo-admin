const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const PanicDTO = require('../dto/panicDto');

async function getAll(req, res) {
  try { res.json(await db.getPanicAlerts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = PanicDTO.fromRequest(req.body);
    const nuevo = await db.createPanicAlert({ id: uuid(), ...data });
    res.status(201).json(PanicDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status requerido' });
    const updated = await db.updatePanicStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(PanicDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateStatus };
