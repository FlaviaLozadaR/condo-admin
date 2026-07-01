const router = require('express').Router();
const ctrl   = require('../controllers/areasSocialesController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];
const ADMIN = ['Super Admin', 'Administrador'];

/**
 * @swagger
 * /api/areas-sociales:
 *   get:
 *     tags: [Áreas Sociales]
 *     summary: Listar áreas sociales reservables
 *     description: 'Super Admin: todas. Administrador: solo las de su condominio. Propietario/Inquilino: solo las activas de su condominio.'
 *     responses:
 *       200: { description: 'Lista de áreas, con imagenUrl como array de links firmados' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Áreas Sociales]
 *     summary: Crear área social
 *     description: Super Admin / Administrador (un Administrador crea siempre en su propio condominio). Hasta 6 fotos.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nombre]
 *             properties:
 *               nombre:      { type: string, example: 'Churrasquera rosada I' }
 *               descripcion: { type: string }
 *               precio:      { type: number, example: 100, description: 'Costo de la reserva, 0 si es gratis' }
 *               condo:       { type: string, description: 'Solo Super Admin' }
 *               imagenes:    { type: array, items: { type: string, format: binary }, description: 'Hasta 6 imágenes JPG/PNG/WEBP, máx 8MB c/u' }
 *     responses:
 *       201: { description: Creada }
 *       400: { description: 'Falta el nombre, o más de 6 fotos', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',    requireAuth, requireRole(...ALL),   ctrl.getAll);
router.post('/',   requireAuth, requireRole(...ADMIN), ctrl.upload.array('imagenes', 6), ctrl.create);

/**
 * @swagger
 * /api/areas-sociales/{id}:
 *   put:
 *     tags: [Áreas Sociales]
 *     summary: Actualizar área social (agregar/quitar fotos, activar/desactivar)
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:           { type: string }
 *               descripcion:      { type: string }
 *               precio:           { type: number }
 *               activo:           { type: boolean }
 *               imagenesActuales: { type: string, description: 'JSON array con las URLs firmadas de las fotos que se quieren conservar (las que no estén acá se eliminan)' }
 *               imagenes:         { type: array, items: { type: string, format: binary }, description: 'Fotos nuevas a agregar' }
 *     responses:
 *       200: { description: Actualizada }
 *       400: { description: 'Máximo 6 fotos por área', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Sin permisos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Áreas Sociales]
 *     summary: Eliminar área social (borra también sus fotos del storage)
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { description: Sin permisos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id', requireAuth, requireRole(...ADMIN), ctrl.upload.array('imagenes', 6), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...ADMIN), ctrl.remove);

module.exports = router;
