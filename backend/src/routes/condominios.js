const router = require('express').Router();
const ctrl   = require('../controllers/condominiosController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ADMIN = ['Super Admin', 'Administrador'];
const SUPER = ['Super Admin'];

/**
 * @swagger
 * /api/condominios/payment-qr:
 *   get:
 *     tags: [Condominios]
 *     summary: QR de pago del condominio del usuario logueado
 *     description: Cualquier rol autenticado. Devuelve el QR (link firmado, vigente 6h) y el monto de expensas mensuales del condominio al que pertenece el usuario.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentQrUrl:      { type: string }
 *                 expensasMensuales: { type: number }
 *                 condoName:         { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// Debe ir antes de /:id para no colisionar
router.get('/payment-qr',        requireAuth,                        ctrl.getMyPaymentQr);

/**
 * @swagger
 * /api/condominios:
 *   get:
 *     tags: [Condominios]
 *     summary: Listar condominios
 *     description: Super Admin ve todos; Administrador ve solo el suyo.
 *     responses:
 *       200: { description: Lista de condominios }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Condominios]
 *     summary: Crear condominio
 *     description: Solo Super Admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:    { type: string, example: 'Sevilla Real' }
 *               type:    { type: string, example: 'Condominio', description: "Default 'Condominio'" }
 *               address: { type: string }
 *               units:   { type: integer }
 *               plan:    { type: string, example: 'Básico' }
 *     responses:
 *       201: { description: Creado }
 *       400: { description: Falta el nombre, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/',                  requireAuth, requireRole(...ADMIN), ctrl.getAll);
router.post('/',                 requireAuth, requireRole(...SUPER), ctrl.create);

/**
 * @swagger
 * /api/condominios/{id}:
 *   put:
 *     tags: [Condominios]
 *     summary: Actualizar condominio
 *     description: Solo Super Admin.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:    { type: string }
 *               type:    { type: string }
 *               address: { type: string }
 *               units:   { type: integer }
 *               plan:    { type: string }
 *     responses:
 *       200: { description: Actualizado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Condominios]
 *     summary: Eliminar condominio
 *     description: Solo Super Admin.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       400: { description: ID inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id',               requireAuth, requireRole(...SUPER), ctrl.update);
router.delete('/:id',            requireAuth, requireRole(...SUPER), ctrl.remove);

/**
 * @swagger
 * /api/condominios/{id}/payment-qr:
 *   put:
 *     tags: [Condominios]
 *     summary: Subir/reemplazar el QR de pago del condominio
 *     description: Super Admin o Administrador (solo de su propio condominio). Reemplaza el QR anterior si existía.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [qr]
 *             properties:
 *               qr: { type: string, format: binary, description: 'Imagen JPG/PNG/WEBP/GIF, máx 5MB' }
 *     responses:
 *       200: { description: Condominio con el nuevo QR (link firmado) }
 *       400: { description: Falta la imagen, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Condominios]
 *     summary: Eliminar el QR de pago del condominio
 *     description: Super Admin o Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Condominio actualizado sin QR }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id/payment-qr',    requireAuth, requireRole(...ADMIN), ctrl.upload.single('qr'), ctrl.uploadPaymentQr);
router.delete('/:id/payment-qr', requireAuth, requireRole(...ADMIN), ctrl.deletePaymentQr);

/**
 * @swagger
 * /api/condominios/{id}/asignar-expensas:
 *   put:
 *     tags: [Condominios]
 *     summary: Asignar un monto de expensa a varias propiedades del condominio
 *     description: Super Admin o Administrador (solo su propio condominio). El monto se SUMA a lo que cada propiedad ya tenía asignado, no lo reemplaza.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [monto, propiedadIds]
 *             properties:
 *               monto:        { type: number, example: 350 }
 *               propiedadIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Propiedades actualizadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:      { type: boolean }
 *                 updated: { type: array, items: { type: object } }
 *       400: { description: Faltan datos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id/asignar-expensas', requireAuth, requireRole(...ADMIN), ctrl.asignarExpensas);

module.exports = router;
