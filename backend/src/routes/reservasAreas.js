const router = require('express').Router();
const ctrl   = require('../controllers/reservasAreasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL      = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];
const ADMIN    = ['Super Admin', 'Administrador'];
const RESIDENT = ['Propietario', 'Inquilino'];

router.get('/',                         requireAuth, requireRole(...ALL),      ctrl.getAll);
router.post('/',                        requireAuth, requireRole(...RESIDENT), ctrl.create);
router.patch('/:id/estado',             requireAuth, requireRole(...ADMIN),    ctrl.updateEstado);
router.post('/:id/solicitar-cambio',    requireAuth, requireRole(...RESIDENT), ctrl.requestCambio);
router.patch('/:id/responder-cambio',   requireAuth, requireRole(...ADMIN),    ctrl.responderCambio);
router.delete('/:id',                   requireAuth, requireRole(...ADMIN),    ctrl.remove);

module.exports = router;
