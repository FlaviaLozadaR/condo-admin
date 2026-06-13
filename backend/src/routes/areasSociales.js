const router = require('express').Router();
const ctrl   = require('../controllers/areasSocialesController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino'];
const ADMIN = ['Super Admin', 'Administrador'];

router.get('/',    requireAuth, requireRole(...ALL),   ctrl.getAll);
router.post('/',   requireAuth, requireRole(...ADMIN), ctrl.upload.single('imagen'), ctrl.create);
router.put('/:id', requireAuth, requireRole(...ADMIN), ctrl.upload.single('imagen'), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...ADMIN), ctrl.remove);

module.exports = router;
