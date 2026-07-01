const router = require('express').Router();
const ctrl   = require('../controllers/propiedadesController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN = ['Super Admin', 'Administrador'];
const MGMT  = ['Super Admin', 'Administrador', 'Seguridad'];

/**
 * @swagger
 * /api/propiedades/my-property:
 *   get:
 *     tags: [Propiedades]
 *     summary: Propiedad del usuario logueado (resumen de expensas)
 *     description: Propietario/Inquilino/Administrador/Seguridad/Super Admin. Si el usuario no tiene propiedad asignada, devuelve valores en cero.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:             { type: string }
 *                 code:           { type: string }
 *                 street:         { type: string }
 *                 block:          { type: string }
 *                 condo:          { type: string }
 *                 expensaMensual: { type: number }
 *                 cargoExtra:     { type: number }
 *                 notaCargo:      { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// Debe ir antes de /:id
router.get('/my-property',       requireAuth, requireRole(...ALL),   ctrl.getMyProperty);

/**
 * @swagger
 * /api/propiedades/my-properties:
 *   get:
 *     tags: [Propiedades]
 *     summary: Todas las propiedades donde el usuario es propietario o inquilino
 *     description: Usado para restringir el pre-registro de visitas a las propias propiedades.
 *     responses:
 *       200: { description: 'Lista de { id, code, street, condo, label }' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/my-properties',     requireAuth, requireRole(...ALL),   ctrl.getMyProperties);

/**
 * @swagger
 * /api/propiedades:
 *   get:
 *     tags: [Propiedades]
 *     summary: Listar propiedades
 *     description: Super Admin / Administrador / Seguridad. Soporta paginación opcional (?page=&limit=&q=).
 *     parameters:
 *       - { name: page,  in: query, schema: { type: integer } }
 *       - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: q,     in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Lista (o página) de propiedades, con cargoExtra/notaCargo/cargosExtraList calculados }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Propiedades]
 *     summary: Crear propiedad
 *     description: Super Admin / Administrador (un Administrador crea siempre dentro de su propio condominio).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, street, owner]
 *             properties:
 *               code:    { type: string, example: '2-A' }
 *               street:  { type: string, example: 'Calle Marruecos' }
 *               block:   { type: string }
 *               owner:   { type: string }
 *               tenant:  { type: string, description: 'Legado — usar tenants' }
 *               tenants: { type: array, items: { type: string } }
 *               debt:    { type: number }
 *               condo:   { type: string }
 *     responses:
 *       201: { description: Creada }
 *       400: { description: Faltan campos requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: 'Código duplicado, o el inquilino ya está asignado a otra propiedad', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',                  requireAuth, requireRole(...MGMT),  ctrl.getAll);
router.post('/',                 requireAuth, requireRole(...ADMIN), ctrl.create);

/**
 * @swagger
 * /api/propiedades/{id}:
 *   put:
 *     tags: [Propiedades]
 *     summary: Actualizar propiedad
 *     description: Super Admin / Administrador (solo de su propio condominio; reasignar el condominio es exclusivo de Super Admin).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:    { type: string }
 *               street:  { type: string }
 *               block:   { type: string }
 *               owner:   { type: string }
 *               tenant:  { type: string }
 *               tenants: { type: array, items: { type: string } }
 *               debt:    { type: number }
 *               condo:   { type: string, description: 'Solo Super Admin' }
 *     responses:
 *       200: { description: Actualizada }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: 'El inquilino ya está asignado a otra propiedad', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   delete:
 *     tags: [Propiedades]
 *     summary: Eliminar propiedad
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.put('/:id',               requireAuth, requireRole(...ADMIN), ctrl.update);
router.delete('/:id',            requireAuth, requireRole(...ADMIN), ctrl.remove);

/**
 * @swagger
 * /api/propiedades/{id}/cargos-extra:
 *   post:
 *     tags: [Propiedades]
 *     summary: Agregar un cargo extra a la propiedad
 *     description: Super Admin / Administrador (solo de su propio condominio). Cada cargo extra es un ítem independiente (se pueden agregar varios).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [monto]
 *             properties:
 *               monto:  { type: number, example: 150 }
 *               motivo: { type: string, example: 'Multa por ruido' }
 *     responses:
 *       201: { description: Cargo extra creado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:id/cargos-extra',              requireAuth, requireRole(...ADMIN), ctrl.addCargoExtra);

/**
 * @swagger
 * /api/propiedades/{id}/cargos-extra/{cargoId}:
 *   put:
 *     tags: [Propiedades]
 *     summary: Editar un cargo extra puntual
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *       - { name: cargoId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monto:  { type: number }
 *               motivo: { type: string }
 *     responses:
 *       200: { description: Cargo extra actualizado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Propiedades]
 *     summary: Eliminar un cargo extra puntual
 *     description: Super Admin / Administrador (solo de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *       - { name: cargoId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/:id/cargos-extra/:cargoId',      requireAuth, requireRole(...ADMIN), ctrl.editCargoExtra);
router.delete('/:id/cargos-extra/:cargoId',   requireAuth, requireRole(...ADMIN), ctrl.removeCargoExtra);

module.exports = router;
