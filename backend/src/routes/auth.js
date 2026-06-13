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

router.post('/login',           authLimiter, ctrl.login);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password',  authLimiter, ctrl.resetPassword);

module.exports = router;
