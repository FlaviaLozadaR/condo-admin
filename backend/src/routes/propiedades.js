const router = require('express').Router();
const ctrl   = require('../controllers/propiedadesController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN = ['Super Admin', 'Administrador'];
const MGMT  = ['Super Admin', 'Administrador', 'Seguridad'];

// Debe ir antes de /:id
router.get('/my-property',       requireAuth, requireRole(...ALL),   ctrl.getMyProperty);
router.get('/my-properties',     requireAuth, requireRole(...ALL),   ctrl.getMyProperties);

router.get('/',                  requireAuth, requireRole(...MGMT),  ctrl.getAll);
router.post('/',                 requireAuth, requireRole(...ADMIN), ctrl.create);
router.put('/:id',               requireAuth, requireRole(...ADMIN), ctrl.update);
router.delete('/:id',            requireAuth, requireRole(...ADMIN), ctrl.remove);
router.put('/:id/cargo-extra',   requireAuth, requireRole(...ADMIN), ctrl.updateCargoExtra);

module.exports = router;
