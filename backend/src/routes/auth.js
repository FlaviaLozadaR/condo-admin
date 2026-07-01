const router      = require('express').Router();
const rateLimit   = require('express-rate-limit');
const ctrl        = require('../controllers/authController');

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: Público. Devuelve un JWT (válido 24h) y los datos del usuario, incluyendo su dashboard precalculado.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: admin@condo.com }
 *               password: { type: string, format: password, example: '123456' }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:  { type: object }
 *       400: { description: Faltan email o password, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: Credenciales inválidas, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       429: { description: Demasiados intentos (rate limit) }
 */
router.post('/login',           authLimiter, ctrl.login);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar email de recuperación de contraseña
 *     description: "Público. Si el email existe, manda un link de reset (válido 1h) vía Brevo. Siempre responde ok=true, exista o no el email, para no revelar qué cuentas existen."
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: admin@condo.com }
 *     responses:
 *       200:
 *         description: Siempre ok, exista o no el email
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } }
 *       429: { description: Demasiados intentos (rate limit) }
 */
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Establecer nueva contraseña con el token del email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string, description: Token recibido por email }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: Contraseña actualizada, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
 *       400: { description: Token inválido, expirado, o password muy corta, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       429: { description: Demasiados intentos (rate limit) }
 */
router.post('/reset-password',  authLimiter, ctrl.resetPassword);

module.exports = router;
