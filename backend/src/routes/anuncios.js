const router = require('express').Router();
const ctrl   = require('../controllers/anunciosController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN = ['Super Admin', 'Administrador'];

/**
 * @swagger
 * /api/anuncios:
 *   get:
 *     tags: [Anuncios]
 *     summary: Listar anuncios
 *     description: Cualquier rol autenticado. Soporta paginación opcional (?page=&limit=&dateFilter=&condo=).
 *     parameters:
 *       - { name: page,       in: query, schema: { type: integer } }
 *       - { name: limit,      in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: dateFilter, in: query, schema: { type: string } }
 *       - { name: condo,      in: query, schema: { type: string }, description: 'Solo Super Admin puede filtrar por condominio' }
 *     responses:
 *       200: { description: Lista (o página) de anuncios }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Anuncios]
 *     summary: Crear anuncio
 *     description: Super Admin / Administrador (un Administrador publica siempre en su propio condominio).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:    { type: string }
 *               message:  { type: string }
 *               content:  { type: string, description: 'Alias de message' }
 *               author:   { type: string }
 *               category: { type: string, example: General }
 *               priority: { type: string, enum: [Baja, Media, Alta], example: Media }
 *               target:   { type: string, example: todos }
 *               condo:    { type: string, description: 'Solo Super Admin' }
 *     responses:
 *       201: { description: Creado }
 *       400: { description: Falta el título, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/',       requireAuth, requireRole(...ALL),   ctrl.getAll);
router.post('/',      requireAuth, requireRole(...ADMIN), ctrl.create);

/**
 * @swagger
 * /api/anuncios/{id}:
 *   put:
 *     tags: [Anuncios]
 *     summary: Actualizar anuncio
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:   { type: string }
 *               message: { type: string }
 *               target:  { type: string }
 *     responses:
 *       200: { description: Actualizado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Anuncios]
 *     summary: Eliminar anuncio
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id',    requireAuth, requireRole(...ADMIN), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...ADMIN), ctrl.remove);

module.exports = router;
