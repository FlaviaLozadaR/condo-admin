const router = require('express').Router();
const ctrl   = require('../controllers/usuariosController');
const { requireAuth, requireRole, requireSelfOrAdmin } = require('../middleware/auth');

const ADMIN = ['Super Admin', 'Administrador'];
const SUPER = ['Super Admin'];

router.get('/seguridad',              requireAuth, ctrl.getSeguridad);
router.get('/',                      requireAuth, requireRole(...ADMIN), ctrl.getAll);
router.post('/',                     requireAuth, requireRole(...ADMIN), ctrl.create);
router.put('/:id',                   requireAuth, requireSelfOrAdmin,    ctrl.update);
router.post('/:id/change-password',  requireAuth, requireSelfOrAdmin,    ctrl.changePassword);
router.delete('/:id',                requireAuth, requireRole(...ADMIN),  ctrl.remove);

module.exports = router;
