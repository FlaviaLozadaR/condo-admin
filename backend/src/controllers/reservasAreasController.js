const { v4: uuid } = require('uuid');
const db = require('../data/db');

function horariosConflictan(ini1, fin1, ini2, fin2) {
  return !(fin1 <= ini2 || ini1 >= fin2);
}

async function getAll(req, res) {
  try {
    const reservas = await db.getReservasAreas();
    if (req.user.role === 'Administrador') {
      const user = await db.getUsuarioById(req.user.id);
      return res.json(reservas.filter(r => r.condo === user?.condo));
    }
    // Residentes reciben todas las del condo (para ver conflictos)
    if (['Propietario', 'Inquilino'].includes(req.user.role)) {
      const user = await db.getUsuarioById(req.user.id);
      return res.json(reservas.filter(r => r.condo === user?.condo));
    }
    res.json(reservas);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const { areaId, areaNombre, fecha, horaInicio, horaFin, nota } = req.body || {};
    if (!areaId || !fecha || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'Faltan datos: areaId, fecha, horaInicio, horaFin' });
    }
    if (horaInicio >= horaFin) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor a la de inicio' });
    }

    const existing = await db.getReservasAreas();
    const conflict = existing.find(r =>
      r.areaId === areaId &&
      r.fecha  === fecha  &&
      r.estado !== 'rechazada' &&
      horariosConflictan(horaInicio, horaFin, r.horaInicio, r.horaFin)
    );
    if (conflict) {
      return res.status(409).json({ error: `Ese horario ya está reservado (${conflict.horaInicio}–${conflict.horaFin})` });
    }

    const user   = await db.getUsuarioById(req.user.id);
    const nueva  = await db.createReservaArea({
      id:             uuid(),
      areaId,
      areaNombre:     areaNombre || '',
      condo:          user?.condo    || '',
      propiedad:      user?.property || '',
      propietario:    user?.name     || '',
      fecha,
      horaInicio,
      horaFin,
      estado:         'pendiente',
      nota:           nota || '',
      solicitudCambio: null,
    });
    res.status(201).json(nueva);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function updateEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, nota } = req.body || {};
    if (!['aprobada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado debe ser aprobada o rechazada' });
    }
    const updated = await db.updateReservaArea(id, {
      estado,
      ...(nota !== undefined && { nota }),
    });
    if (!updated) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function requestCambio(req, res) {
  try {
    const { id } = req.params;
    const { fecha, horaInicio, horaFin, nota } = req.body || {};
    if (!fecha || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'Faltan datos para el cambio' });
    }
    if (horaInicio >= horaFin) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor a la de inicio' });
    }

    const reservas = await db.getReservasAreas();
    const reserva  = reservas.find(r => String(r.id) === String(id));
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const conflict = reservas.find(r =>
      r.id      !== id &&
      r.areaId  === reserva.areaId &&
      r.fecha   === fecha &&
      r.estado  !== 'rechazada' &&
      horariosConflictan(horaInicio, horaFin, r.horaInicio, r.horaFin)
    );
    if (conflict) {
      return res.status(409).json({ error: `Ese horario ya está reservado (${conflict.horaInicio}–${conflict.horaFin})` });
    }

    const updated = await db.updateReservaArea(id, {
      solicitudCambio: { fecha, horaInicio, horaFin, nota: nota || '', estado: 'pendiente' },
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function responderCambio(req, res) {
  try {
    const { id } = req.params;
    const { aprobado } = req.body || {};

    const reservas = await db.getReservasAreas();
    const reserva  = reservas.find(r => String(r.id) === String(id));
    if (!reserva?.solicitudCambio) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const sc = reserva.solicitudCambio;
    const changes = aprobado
      ? { fecha: sc.fecha, horaInicio: sc.horaInicio, horaFin: sc.horaFin, solicitudCambio: { ...sc, estado: 'aprobada' } }
      : { solicitudCambio: { ...sc, estado: 'rechazada' } };

    const updated = await db.updateReservaArea(id, changes);
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    await db.deleteReservaArea(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateEstado, requestCambio, responderCambio, remove };
