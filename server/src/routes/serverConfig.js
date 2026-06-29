const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/serverConfigController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', ctrl.status);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
