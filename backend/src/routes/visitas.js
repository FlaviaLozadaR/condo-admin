const router = require('express').Router();
const ctrl   = require('../controllers/visitasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

const uploadDocs = ctrl.upload.fields([
  { name: 'idDocumentFront', maxCount: 1 },
  { name: 'idDocumentBack',  maxCount: 1 },
  { name: 'platePhoto',      maxCount: 1 },
]);

/**
 * @swagger
 * /api/visitas:
 *   get:
 *     tags: [Visitas]
 *     summary: Listar pases de visita (QR)
 *     description: Cualquier rol autenticado, filtrado a su propio condominio (Super Admin puede elegir uno con ?condo=).
 *     parameters:
 *       - { name: condo, in: query, schema: { type: string }, description: 'Solo Super Admin' }
 *     responses:
 *       200: { description: 'Lista de pases, con hasIdDocumentFront/hasIdDocumentBack/hasPlatePhoto en vez de los paths reales' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Visitas]
 *     summary: Crear un pase de visita (pre-registro)
 *     description: >
 *       Cualquier rol autenticado. El QR generado vence a las 24hs de creado como máximo, sin importar
 *       `expiresAt`. Si `status` se manda como "Registrado" (caso seguridad registrando en la puerta), se crea
 *       de una vez el registro de historial con entrada = ahora.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fullName, idNumber, property, motive]
 *             properties:
 *               mode:           { type: string, enum: [peatonal, vehicular], description: "Default 'peatonal'" }
 *               fullName:       { type: string }
 *               idNumber:       { type: string }
 *               property:       { type: string }
 *               motive:         { type: string }
 *               plate:          { type: string, description: 'Requerido visualmente si mode=vehicular' }
 *               status:         { type: string, enum: [Activo, Registrado], description: "Default 'Activo'" }
 *               expiresAt:      { type: string, description: 'Fecha límite opcional (YYYY-MM-DD)' }
 *               idDocumentFront: { type: string, format: binary, description: 'Carnet (frente)' }
 *               idDocumentBack:  { type: string, format: binary, description: 'Carnet (dorso)' }
 *               platePhoto:      { type: string, format: binary, description: 'Foto de la placa (solo vehicular)' }
 *     responses:
 *       201: { description: 'Pase creado (incluye historialEntry si status=Registrado)' }
 *       400: { description: Faltan campos requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',             requireAuth, requireRole(...ALL),  ctrl.getAll);
router.post('/',            requireAuth, requireRole(...ALL),  uploadDocs, ctrl.create);

/**
 * @swagger
 * /api/visitas/verify/{code}:
 *   get:
 *     tags: [Visitas]
 *     summary: Buscar un pase por su código QR
 *     description: Super Admin / Administrador / Seguridad. Usado al escanear o ingresar el código manualmente.
 *     parameters:
 *       - { name: code, in: path, required: true, schema: { type: string }, example: 'QR-482917' }
 *     responses:
 *       200: { description: Pase encontrado }
 *       404: { description: 'Pase no encontrado (o de otro condominio)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/verify/:code', requireAuth, requireRole(...MGMT), ctrl.verify);

/**
 * @swagger
 * /api/visitas/{id}/status:
 *   patch:
 *     tags: [Visitas]
 *     summary: Cambiar el estado de un pase (Activo/Inactivo)
 *     description: Super Admin / Administrador / Seguridad. Se usa al marcar la salida del visitante, para invalidar el QR.
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
 *               status: { type: string, enum: [Activo, Inactivo] }
 *     responses:
 *       200: { description: Pase actualizado }
 *       400: { description: Falta el status, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/status', requireAuth, requireRole(...MGMT), ctrl.updateStatus);

/**
 * @swagger
 * /api/visitas/{id}:
 *   patch:
 *     tags: [Visitas]
 *     summary: Editar los datos de un pase
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               idNumber: { type: string }
 *               property: { type: string }
 *               motive:   { type: string }
 *               mode:     { type: string, enum: [peatonal, vehicular] }
 *               plate:    { type: string }
 *     responses:
 *       200: { description: Pase actualizado }
 *       400: { description: 'Nada para actualizar, o un campo viene vacío', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Visitas]
 *     summary: Eliminar un pase (borra también sus fotos del storage)
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id', requireAuth, requireRole(...MGMT), ctrl.update);

/**
 * @swagger
 * /api/visitas/{id}/document/{type}:
 *   get:
 *     tags: [Visitas]
 *     summary: Obtener el link firmado de una foto de documento
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio). El link es válido 5 minutos.
 *     parameters:
 *       - { name: id,   in: path, required: true, schema: { type: string } }
 *       - { name: type, in: path, required: true, schema: { type: string, enum: [front, back, plate] } }
 *     responses:
 *       200: { description: 'OK', content: { application/json: { schema: { type: object, properties: { url: { type: string } } } } } }
 *       400: { description: Tipo de documento inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: 'No encontrado, o ese documento no fue subido', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   delete:
 *     tags: [Visitas]
 *     summary: Eliminar una foto de documento puntual
 *     description: Super Admin / Administrador / Seguridad (solo de su propio condominio).
 *     parameters:
 *       - { name: id,   in: path, required: true, schema: { type: string } }
 *       - { name: type, in: path, required: true, schema: { type: string, enum: [front, back, plate] } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       400: { description: Tipo de documento inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/document/:type',    requireAuth, requireRole(...MGMT), ctrl.getDocumentUrl);
router.delete('/:id/document/:type', requireAuth, requireRole(...MGMT), ctrl.deleteDocument);
router.delete('/:id',                requireAuth, requireRole(...MGMT), ctrl.remove);

module.exports = router;
