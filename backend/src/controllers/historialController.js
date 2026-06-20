const { v4: uuid } = require('uuid');
const db  = require('../data/db');
const HistorialDTO = require('../dto/historialDto');

async function getAll(req, res) {
  try {
    const { page, limit, tipo, q } = req.query;
    // Solo Super Admin puede elegir condominio por query — el resto queda fijo al suyo.
    const condo = req.user.role === 'Super Admin' ? (req.query.condo || undefined) : req.user.condo;
    if (page) {
      const result = await db.getHistorialPaged({
        page:  Math.max(1, parseInt(page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        tipo, q, condo,
      });
      return res.json({ ...result, data: result.data.map(HistorialDTO.toResponse) });
    }
    res.json((await db.getHistorial(condo)).map(HistorialDTO.toResponse));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const data  = HistorialDTO.fromRequest(req.body);
    const nuevo = await db.createHistorial({ id: uuid(), ...data, condo: req.user?.condo || '' });
    res.status(201).json(HistorialDTO.toResponse(nuevo));
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function updateSalida(req, res) {
  try {
    const { salida } = req.body || {};
    if (!salida?.trim()) return res.status(400).json({ error: 'Salida requerida' });
    const existing = await db.getHistorialById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'Super Admin' && existing.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const updated = await db.updateHistorial(req.params.id, { salida: salida.trim() });
    res.json(HistorialDTO.toResponse(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// GET /historial-visitas/my-visits — historial de visitas de las propiedades
// donde el usuario logueado es propietario o inquilino.
async function getMyVisits(req, res) {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const propiedades = await db.getPropiedades(user.condo);
    const myLabels = new Set(
      propiedades
        .filter(p =>
          p.owner === user.name ||
          (Array.isArray(p.tenants) ? p.tenants.includes(user.name) : p.tenant === user.name)
        )
        .map(p => `${p.street} - ${p.code}`)
    );

    const historial = await db.getHistorial(user.condo);
    const mine = historial.filter(h => myLabels.has(h.propiedad));
    res.json(mine.map(HistorialDTO.toResponse));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateSalida, getMyVisits };
