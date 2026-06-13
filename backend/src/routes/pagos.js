const router = require('express').Router();
const ctrl   = require('../controllers/pagosController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL    = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN  = ['Super Admin', 'Administrador'];
const RESIDENTS = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];

router.get('/',             requireAuth, requireRole(...ALL),       ctrl.getAll);
router.post('/',            requireAuth, requireRole(...RESIDENTS), ctrl.upload.single('comprobante'), ctrl.create);
router.patch('/:id/status', requireAuth, requireRole(...ADMIN),     ctrl.updateStatus);

module.exports = router;
