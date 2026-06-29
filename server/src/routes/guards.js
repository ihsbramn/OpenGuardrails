const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/guardsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/validate', ctrl.run);

module.exports = router;
