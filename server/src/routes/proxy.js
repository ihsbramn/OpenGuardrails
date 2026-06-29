const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/proxyController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// OpenAI-compatible chat completions proxy
router.post('/v1/chat/completions', ctrl.chatCompletions);

module.exports = router;
