const router = require('express').Router();
const ctrl   = require('../controllers/asambleasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL   = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const ADMIN = ['Super Admin', 'Administrador'];

router.get('/',               requireAuth, requireRole(...ALL),   ctrl.getAll);
router.post('/',              requireAuth, requireRole(...ADMIN), ctrl.upload.single('document'), ctrl.create);
router.put('/:id',            requireAuth, requireRole(...ADMIN), ctrl.upload.single('document'), ctrl.update);
router.delete('/:id',         requireAuth, requireRole(...ADMIN), ctrl.remove);
router.post('/:id/vote',      requireAuth, requireRole(...ALL),   ctrl.vote);
router.get('/:id/document',   requireAuth, requireRole(...ALL),   ctrl.getDocument);

module.exports = router;
