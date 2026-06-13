const router = require('express').Router();
const ctrl   = require('../controllers/panicController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

router.get('/',             requireAuth, requireRole(...ALL),  ctrl.getAll);
router.post('/',            requireAuth, requireRole(...ALL),  ctrl.create);
router.patch('/:id/status', requireAuth, requireRole(...MGMT), ctrl.updateStatus);

module.exports = router;
