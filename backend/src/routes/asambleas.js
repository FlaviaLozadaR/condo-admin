const router = require('express').Router();
const ctrl   = require('../controllers/asambleasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN = ['Super Admin', 'Administrador'];

/**
 * @swagger
 * /api/asambleas:
 *   get:
 *     tags: [Asambleas]
 *     summary: Listar asambleas
 *     description: >
 *       Cualquier rol autenticado. Admins ven los votos completos (votesYes/votesNo/votesAbstencion); el resto
 *       de los roles solo ve su propio voto, y nunca recibe documentPath (privacidad de votos).
 *       Soporta paginación opcional (?page=&limit=).
 *     parameters:
 *       - { name: page,  in: query, schema: { type: integer } }
 *       - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Lista (o página) de asambleas }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Asambleas]
 *     summary: Crear asamblea
 *     description: Super Admin / Administrador (un Administrador crea siempre en su propio condominio).
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, startDate, dueDate]
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               startDate:   { type: string, example: '2026-07-10' }
 *               dueDate:     { type: string, example: '2026-07-20' }
 *               condo:       { type: string, description: 'Solo Super Admin' }
 *               document:    { type: string, format: binary, description: 'PDF/Office/imagen, máx 10MB' }
 *     responses:
 *       201: { description: Creada }
 *       400: { description: Faltan campos requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/',               requireAuth, requireRole(...ALL),   ctrl.getAll);
router.post('/',              requireAuth, requireRole(...ADMIN), ctrl.upload.single('document'), ctrl.create);

/**
 * @swagger
 * /api/asambleas/{id}:
 *   put:
 *     tags: [Asambleas]
 *     summary: Actualizar asamblea (y opcionalmente reemplazar el documento adjunto)
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               startDate:   { type: string }
 *               dueDate:     { type: string }
 *               document:    { type: string, format: binary }
 *     responses:
 *       200: { description: Actualizada }
 *       400: { description: Falta el título, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Asambleas]
 *     summary: Eliminar asamblea (borra también el documento adjunto del storage)
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id',            requireAuth, requireRole(...ADMIN), ctrl.upload.single('document'), ctrl.update);
router.delete('/:id',         requireAuth, requireRole(...ADMIN), ctrl.remove);

/**
 * @swagger
 * /api/asambleas/{id}/vote:
 *   post:
 *     tags: [Asambleas]
 *     summary: Votar en una asamblea
 *     description: Cualquier rol autenticado. Un voto por usuario (votar de nuevo reemplaza el voto anterior).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo]
 *             properties:
 *               tipo: { type: string, enum: [favor, contra, abstencion] }
 *     responses:
 *       200: { description: Asamblea con el voto registrado }
 *       400: { description: Falta el tipo de voto, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:id/vote',      requireAuth, requireRole(...ALL),   ctrl.vote);

/**
 * @swagger
 * /api/asambleas/{id}/document:
 *   get:
 *     tags: [Asambleas]
 *     summary: Descargar/ver el documento adjunto de la asamblea
 *     description: Cualquier rol autenticado (dentro de su condominio). Redirige (302) a un link firmado, vigente 5 minutos.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       302: { description: Redirección al archivo firmado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: 'La asamblea no tiene documento adjunto', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:id/document',   requireAuth, requireRole(...ALL),   ctrl.getDocument);

module.exports = router;
