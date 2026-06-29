const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/validatorsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/categories', ctrl.listCategories);
router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);
router.post('/:id/install', ctrl.install);

module.exports = router;
