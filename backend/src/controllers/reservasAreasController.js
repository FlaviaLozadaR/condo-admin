const { v4: uuid } = require('uuid');
const db = require('../data/db');

function horariosConflictan(ini1, fin1, ini2, fin2) {
  return !(fin1 <= ini2 || ini1 >= fin2);
}

// Si cualquiera de las dos reservas es de día completo, ocupan todo el día
// entre sí — si no, se compara el rango de horas normalmente.
function reservasConflictan(a, b) {
  if (a.diaCompleto || b.diaCompleto) return true;
  return horariosConflictan(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin);
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
    const { areaId, areaNombre, fecha, horaInicio, horaFin, nota, diaCompleto } = req.body || {};
    const esDiaCompleto = !!diaCompleto;
    if (!areaId || !fecha || (!esDiaCompleto && (!horaInicio || !horaFin))) {
      return res.status(400).json({ error: 'Faltan datos: areaId, fecha y horario (o marcá día completo)' });
    }
    if (!esDiaCompleto && horaInicio >= horaFin) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor a la de inicio' });
    }
    const horaInicioFinal = esDiaCompleto ? '00:00' : horaInicio;
    const horaFinFinal    = esDiaCompleto ? '23:59' : horaFin;

    const existing = await db.getReservasAreas();
    const conflict = existing.find(r =>
      r.areaId === areaId &&
      r.fecha  === fecha  &&
      r.estado !== 'rechazada' &&
      reservasConflictan(
        { diaCompleto: esDiaCompleto, horaInicio: horaInicioFinal, horaFin: horaFinFinal },
        { diaCompleto: r.diaCompleto, horaInicio: r.horaInicio, horaFin: r.horaFin }
      )
    );
    if (conflict) {
      return res.status(409).json({ error: conflict.diaCompleto ? 'Ese día ya está reservado por completo' : `Ese horario ya está reservado (${conflict.horaInicio}–${conflict.horaFin})` });
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
      horaInicio:     horaInicioFinal,
      horaFin:        horaFinFinal,
      diaCompleto:    esDiaCompleto,
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
    const reserva = (await db.getReservasAreas()).find(r => String(r.id) === String(id));
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (req.user.role !== 'Super Admin' && reserva.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    const updated = await db.updateReservaArea(id, {
      estado,
      ...(nota !== undefined && { nota }),
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function requestCambio(req, res) {
  try {
    const { id } = req.params;
    const { fecha, horaInicio, horaFin, nota, diaCompleto } = req.body || {};
    const esDiaCompleto = !!diaCompleto;
    if (!fecha || (!esDiaCompleto && (!horaInicio || !horaFin))) {
      return res.status(400).json({ error: 'Faltan datos para el cambio' });
    }
    if (!esDiaCompleto && horaInicio >= horaFin) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor a la de inicio' });
    }
    const horaInicioFinal = esDiaCompleto ? '00:00' : horaInicio;
    const horaFinFinal    = esDiaCompleto ? '23:59' : horaFin;

    const reservas = await db.getReservasAreas();
    const reserva  = reservas.find(r => String(r.id) === String(id));
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    const user = await db.getUsuarioById(req.user.id);
    if (reserva.propietario !== user?.name) {
      return res.status(403).json({ error: 'Solo podés modificar tu propia reserva' });
    }

    const conflict = reservas.find(r =>
      r.id      !== id &&
      r.areaId  === reserva.areaId &&
      r.fecha   === fecha &&
      r.estado  !== 'rechazada' &&
      reservasConflictan(
        { diaCompleto: esDiaCompleto, horaInicio: horaInicioFinal, horaFin: horaFinFinal },
        { diaCompleto: r.diaCompleto, horaInicio: r.horaInicio, horaFin: r.horaFin }
      )
    );
    if (conflict) {
      return res.status(409).json({ error: conflict.diaCompleto ? 'Ese día ya está reservado por completo' : `Ese horario ya está reservado (${conflict.horaInicio}–${conflict.horaFin})` });
    }

    const updated = await db.updateReservaArea(id, {
      solicitudCambio: { fecha, horaInicio: horaInicioFinal, horaFin: horaFinFinal, diaCompleto: esDiaCompleto, nota: nota || '', estado: 'pendiente' },
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
    if (req.user.role !== 'Super Admin' && reserva.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }

    const sc = reserva.solicitudCambio;
    const changes = aprobado
      ? { fecha: sc.fecha, horaInicio: sc.horaInicio, horaFin: sc.horaFin, diaCompleto: !!sc.diaCompleto, solicitudCambio: { ...sc, estado: 'aprobada' } }
      : { solicitudCambio: { ...sc, estado: 'rechazada' } };

    const updated = await db.updateReservaArea(id, changes);
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const reserva = (await db.getReservasAreas()).find(r => String(r.id) === String(req.params.id));
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (req.user.role !== 'Super Admin' && reserva.condo !== req.user.condo) {
      return res.status(403).json({ error: 'No autorizado para este condominio' });
    }
    await db.deleteReservaArea(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, create, updateEstado, requestCambio, responderCambio, remove };
