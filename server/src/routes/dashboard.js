const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ctrl.overview);
router.get('/stats', authenticate, ctrl.overview);

module.exports = router;
