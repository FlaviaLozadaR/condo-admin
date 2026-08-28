const router = require('express').Router();
const ctrl   = require('../controllers/contactsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const RESIDENTS = ['Propietario', 'Inquilino', 'Residente'];
const SEC_ADMIN = ['Super Admin', 'Administrador', 'Seguridad'];
const ALL       = [...RESIDENTS, ...SEC_ADMIN];
const CAN_WRITE = [...RESIDENTS, 'Super Admin', 'Administrador'];

router.get('/',    requireAuth, requireRole(...ALL),       ctrl.getAll);
router.post('/',   requireAuth, requireRole(...RESIDENTS), ctrl.create);
router.get('/:id', requireAuth, requireRole(...ALL),       ctrl.getById);
router.put('/:id', requireAuth, requireRole(...CAN_WRITE), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...CAN_WRITE), ctrl.remove);
router.post('/:id/photos', requireAuth, requireRole(...CAN_WRITE), ctrl.upload.single('photo'), ctrl.addPhoto);
router.delete('/:id/photos/:index', requireAuth, requireRole(...CAN_WRITE), ctrl.removePhoto);

module.exports = router;
