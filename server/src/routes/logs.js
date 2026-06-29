const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/logsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

module.exports = router;
