const router = require('express').Router();
const ctrl   = require('../controllers/reservasAreasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL      = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];
const ADMIN    = ['Super Admin', 'Administrador'];
const RESIDENT = ['Propietario', 'Inquilino'];

/**
 * @swagger
 * /api/reservas-areas:
 *   get:
 *     tags: [Reservas de Áreas]
 *     summary: Listar reservas de áreas sociales
 *     description: Administrador ve solo las de su condominio; Propietario/Inquilino ven todas las de su condominio (para detectar conflictos de horario); Super Admin ve todas.
 *     responses:
 *       200: { description: Lista de reservas }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Reservas de Áreas]
 *     summary: Crear una reserva
 *     description: Propietario / Inquilino. Rechaza la reserva si el horario (o el día completo) ya está ocupado por otra reserva no rechazada de la misma área.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [areaId, fecha]
 *             properties:
 *               areaId:      { type: string }
 *               areaNombre:  { type: string }
 *               fecha:       { type: string, example: '2026-07-10' }
 *               horaInicio:  { type: string, example: '08:00', description: 'Requerido si diaCompleto=false' }
 *               horaFin:     { type: string, example: '14:00' }
 *               diaCompleto: { type: boolean, description: "Si es true, ocupa 00:00–23:59" }
 *               nota:        { type: string }
 *     responses:
 *       201: { description: Reserva creada, estado inicial "pendiente" }
 *       400: { description: 'Faltan datos, o la hora de fin no es mayor a la de inicio', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: 'Ese horario (o día completo) ya está reservado', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',                         requireAuth, requireRole(...ALL),      ctrl.getAll);
router.post('/',                        requireAuth, requireRole(...RESIDENT), ctrl.create);

/**
 * @swagger
 * /api/reservas-areas/{id}/estado:
 *   patch:
 *     tags: [Reservas de Áreas]
 *     summary: Aprobar o rechazar una reserva
 *     description: Super Admin / Administrador (solo de su propio condominio). Si el área tiene costo y todavía no fue cobrada, hay que llamar primero a /cobrar — no se puede aprobar sin cobrar.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado: { type: string, enum: [aprobada, rechazada] }
 *               nota:   { type: string }
 *     responses:
 *       200: { description: Reserva actualizada }
 *       400: { description: 'Estado inválido, o falta cobrar antes de aprobar', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/estado',             requireAuth, requireRole(...ADMIN),    ctrl.updateEstado);

/**
 * @swagger
 * /api/reservas-areas/{id}/cobrar:
 *   patch:
 *     tags: [Reservas de Áreas]
 *     summary: Cobrar el costo de la reserva como cargo extra
 *     description: >
 *       Super Admin / Administrador (solo de su propio condominio). Crea un cargo extra en la propiedad del
 *       propietario que reservó, por el precio del área. Ese cargo extra se borra solo cuando se aprueba el
 *       pago correspondiente (ver PATCH /api/pagos/{id}/status). No se puede cobrar dos veces la misma reserva.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reserva:   { type: object }
 *                 propiedad: { type: object }
 *       400: { description: 'Ya fue cobrada, o el área no tiene costo', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: 'Reserva no encontrada, o no se encontró la propiedad del propietario', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/:id/cobrar',             requireAuth, requireRole(...ADMIN),    ctrl.cobrar);

/**
 * @swagger
 * /api/reservas-areas/{id}/solicitar-cambio:
 *   post:
 *     tags: [Reservas de Áreas]
 *     summary: Solicitar un cambio de fecha/horario sobre una reserva propia
 *     description: Propietario / Inquilino (solo el dueño de la reserva). Queda pendiente de aprobación del admin.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fecha]
 *             properties:
 *               fecha:       { type: string }
 *               horaInicio:  { type: string }
 *               horaFin:     { type: string }
 *               diaCompleto: { type: boolean }
 *               nota:        { type: string }
 *     responses:
 *       200: { description: Reserva con la solicitud de cambio adjunta (pendiente) }
 *       400: { description: 'Faltan datos para el cambio', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: 'Solo podés modificar tu propia reserva', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'Ese horario ya está reservado', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:id/solicitar-cambio',    requireAuth, requireRole(...RESIDENT), ctrl.requestCambio);

/**
 * @swagger
 * /api/reservas-areas/{id}/responder-cambio:
 *   patch:
 *     tags: [Reservas de Áreas]
 *     summary: Aprobar o rechazar una solicitud de cambio
 *     description: Super Admin / Administrador (solo de su propio condominio). Si se aprueba, la reserva pasa a la nueva fecha/horario.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [aprobado]
 *             properties:
 *               aprobado: { type: boolean }
 *     responses:
 *       200: { description: Reserva actualizada }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: 'Reserva o solicitud de cambio no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/:id/responder-cambio',   requireAuth, requireRole(...ADMIN),    ctrl.responderCambio);

/**
 * @swagger
 * /api/reservas-areas/{id}:
 *   delete:
 *     tags: [Reservas de Áreas]
 *     summary: Eliminar una reserva
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:id',                   requireAuth, requireRole(...ADMIN),    ctrl.remove);

module.exports = router;
