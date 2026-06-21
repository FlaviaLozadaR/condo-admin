const router = require('express').Router();
const ctrl   = require('../controllers/historialController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

// Debe ir antes de /:id
router.get('/my-visits', requireAuth, requireRole(...ALL), ctrl.getMyVisits);

router.get('/',  requireAuth, requireRole(...MGMT), ctrl.getAll);
router.post('/', requireAuth, requireRole(...MGMT), ctrl.create);
router.patch('/:id/salida', requireAuth, requireRole(...MGMT), ctrl.updateSalida);
router.delete('/:id', requireAuth, requireRole(...MGMT), ctrl.remove);

module.exports = router;
