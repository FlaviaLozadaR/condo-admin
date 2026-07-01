const router = require('express').Router();
const ctrl   = require('../controllers/pagosController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL    = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN  = ['Super Admin', 'Administrador'];
const RESIDENTS = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];

/**
 * @swagger
 * /api/pagos:
 *   get:
 *     tags: [Pagos]
 *     summary: Listar pagos
 *     description: Cualquier rol autenticado. Soporta paginación opcional (?page=&limit=&estado=&tipo=&q=&condo=).
 *     parameters:
 *       - { name: page,   in: query, schema: { type: integer } }
 *       - { name: limit,  in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: estado, in: query, schema: { type: string, enum: [todos, pendiente, aprobado, rechazado] } }
 *       - { name: tipo,   in: query, schema: { type: string, enum: [todos, Expensa, Reserva] } }
 *       - { name: q,      in: query, schema: { type: string }, description: 'Búsqueda por propiedad/propietario/referencia/tipo' }
 *       - { name: condo,  in: query, schema: { type: string }, description: 'Solo Super Admin puede filtrar por condominio' }
 *     responses:
 *       200: { description: Lista (o página) de pagos, con comprobante como link firmado }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Pagos]
 *     summary: Registrar un pago (subir comprobante)
 *     description: Super Admin / Administrador / Propietario / Inquilino. Un residente solo puede registrar pagos a su propio nombre.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [monto]
 *             properties:
 *               monto:       { type: number, example: 350 }
 *               propiedad:   { type: string }
 *               propietario: { type: string }
 *               tipo:        { type: string, enum: [Expensa, Reserva], description: "Default 'Expensa'" }
 *               referencia:  { type: string, description: 'Número de operación/referencia bancaria' }
 *               motivo:      { type: string, description: 'Opcional — para qué es el pago' }
 *               reservaId:   { type: string, description: 'Si tipo=Reserva, id de la reserva que se está pagando' }
 *               comprobante: { type: string, format: binary, description: 'Imagen o PDF, máx 8MB' }
 *     responses:
 *       201: { description: Pago creado, estado inicial "pendiente" }
 *       400: { description: Falta el monto, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/',             requireAuth, requireRole(...ALL),       ctrl.getAll);
router.post('/',            requireAuth, requireRole(...RESIDENTS), ctrl.upload.single('comprobante'), ctrl.create);

/**
 * @swagger
 * /api/pagos/{id}/status:
 *   patch:
 *     tags: [Pagos]
 *     summary: Aprobar o rechazar un pago
 *     description: >
 *       Super Admin / Administrador. Al aprobar, se descuentan automáticamente los cargos extra que ese pago
 *       cubre: si es una Reserva, se borra el cargo extra que la generó; si es una Expensa pagada por completo
 *       (sin saldoRestante), se borran todos los cargos extra de la propiedad. La respuesta incluye
 *       `propiedadActualizada` cuando esto ocurre.
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
 *               estado:        { type: string, enum: [aprobado, rechazado] }
 *               montoReal:     { type: number, description: 'Si el propietario pagó menos del total — pago parcial' }
 *               saldoRestante: { type: number, description: 'Calculado en el cliente: total - montoReal' }
 *               notaSaldo:     { type: string }
 *     responses:
 *       200:
 *         description: Pago actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 propiedadActualizada: { type: object, nullable: true }
 *       400: { description: Falta el estado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/status', requireAuth, requireRole(...ADMIN),     ctrl.updateStatus);

module.exports = router;
