const router = require('express').Router();
const ctrl   = require('../controllers/visitasController');
const { requireAuth, requireRole } = require('../middleware/auth');

const ALL  = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const MGMT = ['Super Admin', 'Administrador', 'Seguridad'];

const uploadDocs = ctrl.upload.fields([
  { name: 'idDocumentFront', maxCount: 1 },
  { name: 'idDocumentBack',  maxCount: 1 },
  { name: 'platePhoto',      maxCount: 1 },
]);

router.get('/',             requireAuth, requireRole(...ALL),  ctrl.getAll);
router.post('/',            requireAuth, requireRole(...ALL),  uploadDocs, ctrl.create);
router.get('/verify/:code', requireAuth, requireRole(...MGMT), ctrl.verify);
router.patch('/:id/status', requireAuth, requireRole(...MGMT), ctrl.updateStatus);
router.patch('/:id', requireAuth, requireRole(...MGMT), ctrl.update);

router.get('/:id/document/:type',    requireAuth, requireRole(...MGMT), ctrl.getDocumentUrl);
router.delete('/:id/document/:type', requireAuth, requireRole(...MGMT), ctrl.deleteDocument);
router.delete('/:id',                requireAuth, requireRole(...MGMT), ctrl.remove);

module.exports = router;
