const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const VisitaDTO = require('../dto/visitaDto');

async function getAll(req, res) {
  try { res.json(await db.getVisitas()); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = VisitaDTO.fromRequest(req.body);
    const nuevo = await db.createVisita({ id: uuid(), ...data });
    res.status(201).json(VisitaDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function verify(req, res) {
  try {
    const visita = await db.getVisitaByCode(req.params.code);
    if (!visita) return res.status(404).json({ error: 'Pase no encontrado', code: req.params.code });
    res.json(visita);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status requerido' });
    const updated = await db.updateVisitaStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'No encontrado' });
    res.json(VisitaDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, verify, updateStatus };
