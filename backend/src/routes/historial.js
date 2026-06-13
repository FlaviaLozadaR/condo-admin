const router = require('express').Router();
const ctrl   = require('../controllers/historialController');
const { requireAuth, requireRole } = require('../middleware/auth');

const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

router.get('/',  requireAuth, requireRole(...MGMT), ctrl.getAll);
router.post('/', requireAuth, requireRole(...MGMT), ctrl.create);

module.exports = router;
