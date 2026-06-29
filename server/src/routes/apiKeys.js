const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/apiKeysController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/:id/revoke', ctrl.revoke);
router.delete('/:id', ctrl.revoke);

module.exports = router;
