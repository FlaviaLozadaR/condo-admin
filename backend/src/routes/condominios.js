const router = require('express').Router();
const ctrl   = require('../controllers/condominiosController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ADMIN = ['Super Admin', 'Administrador'];
const SUPER = ['Super Admin'];

// Debe ir antes de /:id para no colisionar
router.get('/payment-qr',        requireAuth,                        ctrl.getMyPaymentQr);

router.get('/',                  requireAuth, requireRole(...ADMIN), ctrl.getAll);
router.post('/',                 requireAuth, requireRole(...SUPER), ctrl.create);
router.put('/:id',               requireAuth, requireRole(...SUPER), ctrl.update);
router.delete('/:id',            requireAuth, requireRole(...SUPER), ctrl.remove);

router.put('/:id/payment-qr',    requireAuth, requireRole(...ADMIN), ctrl.upload.single('qr'), ctrl.uploadPaymentQr);
router.delete('/:id/payment-qr', requireAuth, requireRole(...ADMIN), ctrl.deletePaymentQr);
router.put('/:id/asignar-expensas', requireAuth, requireRole(...ADMIN), ctrl.asignarExpensas);

module.exports = router;
