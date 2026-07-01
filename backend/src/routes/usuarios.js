const router = require('express').Router();
const ctrl   = require('../controllers/usuariosController');
const { requireAuth, requireRole, requireSelfOrAdmin } = require('../middleware/auth');

const ADMIN = ['Super Admin', 'Administrador'];

/**
 * @swagger
 * /api/usuarios/seguridad:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar contactos de seguridad del condominio del usuario
 *     description: Cualquier rol autenticado.
 *     responses:
 *       200: { description: Lista de usuarios con rol Seguridad }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/seguridad',              requireAuth, ctrl.getSeguridad);

/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar usuarios
 *     description: Super Admin / Administrador. Soporta paginación opcional (?page=&limit=&q=&role=&condo=).
 *     parameters:
 *       - { name: page,  in: query, schema: { type: integer }, description: 'Si se omite, devuelve el array completo sin paginar' }
 *       - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: q,     in: query, schema: { type: string }, description: 'Búsqueda por nombre/email' }
 *       - { name: role,  in: query, schema: { type: string } }
 *       - { name: condo, in: query, schema: { type: string }, description: 'Solo Super Admin puede filtrar por condominio' }
 *     responses:
 *       200: { description: Lista (o página) de usuarios, sin el campo password }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Usuarios]
 *     summary: Crear usuario
 *     description: Super Admin puede asignar cualquier rol; un Administrador solo puede crear Propietario/Inquilino/Seguridad, dentro de su propio condominio. Manda un email de bienvenida con la contraseña.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:     { type: string }
 *               email:    { type: string }
 *               password: { type: string, description: "Opcional, default '123456'" }
 *               phone:    { type: string }
 *               role:     { type: string, enum: ['Super Admin','Administrador','Propietario','Inquilino','Seguridad'] }
 *               property: { type: string }
 *               condo:    { type: string }
 *     responses:
 *       201: { description: Usuario creado (incluye tempPassword para mostrar al admin) }
 *       400: { description: Faltan campos requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Rol no permitido para quien lo crea, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Ya existe un usuario con ese email, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/',                      requireAuth, requireRole(...ADMIN), ctrl.getAll);
router.post('/',                     requireAuth, requireRole(...ADMIN), ctrl.create);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   put:
 *     tags: [Usuarios]
 *     summary: Actualizar usuario
 *     description: El propio usuario (solo nombre/teléfono) o un Admin (todos los campos, dentro de las reglas de su rol).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:     { type: string }
 *               email:    { type: string, description: 'Solo admins' }
 *               phone:    { type: string }
 *               role:     { type: string, description: 'Solo admins' }
 *               property: { type: string, description: 'Solo admins' }
 *               condo:    { type: string, description: 'Solo Super Admin' }
 *     responses:
 *       200: { description: Usuario actualizado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Usuarios]
 *     summary: Eliminar usuario
 *     description: Super Admin / Administrador (un Administrador solo puede borrar residentes/seguridad de su propio condominio).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Eliminado, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.put('/:id',                   requireAuth, requireSelfOrAdmin,    ctrl.update);

/**
 * @swagger
 * /api/usuarios/{id}/change-password:
 *   post:
 *     tags: [Usuarios]
 *     summary: Cambiar contraseña
 *     description: El propio usuario debe enviar currentPassword; un Admin puede resetear la de otro usuario sin conocerla (dentro de sus permisos).
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               currentPassword: { type: string, description: 'Requerido si no es admin' }
 *               newPassword:     { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Contraseña actualizada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       400: { description: Contraseña actual incorrecta o nueva muy corta, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/:id/change-password',  requireAuth, requireSelfOrAdmin,    ctrl.changePassword);
router.delete('/:id',                requireAuth, requireRole(...ADMIN),  ctrl.remove);

module.exports = router;
