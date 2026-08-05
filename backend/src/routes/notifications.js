const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationsController');

router.post  ('/token',       requireAuth, ctrl.registerToken);
router.delete('/token',       requireAuth, ctrl.removeToken);
router.get   ('/preferences', requireAuth, ctrl.getPreferences);
router.put   ('/preferences', requireAuth, ctrl.updatePreferences);

module.exports = router;
