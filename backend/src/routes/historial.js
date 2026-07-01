const router = require('express').Router();
const ctrl   = require('../controllers/historialController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

/**
 * @swagger
 * /api/historial-visitas/my-visits:
 *   get:
 *     tags: [Historial Visitas]
 *     summary: Historial de visitas de las propiedades del usuario logueado
 *     description: Cualquier rol autenticado. Devuelve solo las visitas de las propiedades donde el usuario es propietario o inquilino.
 *     responses:
 *       200: { description: Lista de registros de historial }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// Debe ir antes de /:id
router.get('/my-visits', requireAuth, requireRole(...ALL), ctrl.getMyVisits);

/**
 * @swagger
 * /api/historial-visitas:
 *   get:
 *     tags: [Historial Visitas]
 *     summary: Listar historial de ingresos/salidas
 *     description: Super Admin / Administrador / Seguridad. Soporta paginación opcional (?page=&limit=&tipo=&q=&condo=).
 *     parameters:
 *       - { name: page,  in: query, schema: { type: integer } }
 *       - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: tipo,  in: query, schema: { type: string, enum: [todos, peatonal, vehicular] } }
 *       - { name: q,     in: query, schema: { type: string }, description: 'Búsqueda por visitante/cédula/placa' }
 *       - { name: condo, in: query, schema: { type: string }, description: 'Solo Super Admin' }
 *     responses:
 *       200:
 *         description: >
 *           Lista (o página) de registros. En modo paginado, cada registro incluye hasIdDocumentFront/
 *           hasIdDocumentBack/hasPlatePhoto (si la visita ligada tiene esas fotos), y los totales del mes
 *           actual (total, totalPeatonales, totalVehiculares).
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Historial Visitas]
 *     summary: Crear un registro de historial (registrar ingreso manualmente)
 *     description: Super Admin / Administrador / Seguridad.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               visitante: { type: string }
 *               cedula:    { type: string }
 *               propiedad: { type: string }
 *               tipo:      { type: string, enum: [peatonal, vehicular] }
 *               placa:     { type: string }
 *               motivo:    { type: string }
 *               guard:     { type: string }
 *               visitaId:  { type: string, description: 'id del pase QR vinculado, si aplica' }
 *     responses:
 *       201: { description: Registro creado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/',  requireAuth, requireRole(...MGMT), ctrl.getAll);
router.post('/', requireAuth, requireRole(...MGMT), ctrl.create);

/**
 * @swagger
 * /api/historial-visitas/{id}/salida:
 *   patch:
 *     tags: [Historial Visitas]
 *     summary: Marcar la salida de un visitante
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [salida]
 *             properties:
 *               salida: { type: string, example: '14:35', description: 'Hora de salida' }
 *     responses:
 *       200: { description: Registro actualizado }
 *       400: { description: Falta la hora de salida, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/salida', requireAuth, requireRole(...MGMT), ctrl.updateSalida);

/**
 * @swagger
 * /api/historial-visitas/{id}:
 *   delete:
 *     tags: [Historial Visitas]
 *     summary: Eliminar un registro de historial
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio). Usar solo ante duplicados o errores de registro.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:id', requireAuth, requireRole(...MGMT), ctrl.remove);

module.exports = router;
