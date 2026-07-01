const router = require('express').Router();
const ctrl   = require('../controllers/panicController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

/**
 * @swagger
 * /api/panic:
 *   get:
 *     tags: [Botón de Pánico]
 *     summary: Listar alertas de pánico
 *     description: Cualquier rol autenticado, filtrado a su propio condominio (Super Admin puede elegir uno con ?condo=).
 *     parameters:
 *       - { name: condo, in: query, schema: { type: string }, description: 'Solo Super Admin' }
 *     responses:
 *       200: { description: Lista de alertas }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Botón de Pánico]
 *     summary: Activar el botón de pánico
 *     description: Cualquier rol autenticado. Queda con estado "Pendiente".
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resident, address]
 *             properties:
 *               resident: { type: string }
 *               phone:    { type: string }
 *               address:  { type: string }
 *               unit:     { type: string }
 *     responses:
 *       201: { description: Alerta creada }
 *       400: { description: Faltan campos requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',             requireAuth, requireRole(...ALL),  ctrl.getAll);
router.post('/',            requireAuth, requireRole(...ALL),  ctrl.create);

/**
 * @swagger
 * /api/panic/{id}/status:
 *   patch:
 *     tags: [Botón de Pánico]
 *     summary: Cambiar el estado de una alerta (atenderla)
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [Pendiente, Atendida] }
 *     responses:
 *       200: { description: Alerta actualizada }
 *       400: { description: Falta el status, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/status', requireAuth, requireRole(...MGMT), ctrl.updateStatus);

module.exports = router;
