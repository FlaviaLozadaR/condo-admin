const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const PanicDTO = require('../dto/panicDto');

async function getAll(req, res) {
  try {
    // Super Admin puede ver todos los condominios (o filtrar por uno con ?condo=).
    // El resto solo ve las alertas de su propio condominio.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    res.json(await db.getPanicAlerts(condo));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = PanicDTO.fromRequest(req.body, req.user.condo);
    const nuevo = await db.createPanicAlert({ id: uuid(), ...data });
    res.status(201).json(PanicDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status requerido' });
    const existing = await db.getPanicAlertById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const updated = await db.updatePanicStatus(req.params.id, status);
    res.json(PanicDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateStatus };
