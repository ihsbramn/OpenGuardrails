const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gatewayController');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');

/**
 * Gateway auth middleware — accepts JWT tokens OR API keys.
 * Expects: Authorization: Bearer <token_or_api_key>
 */
async function gatewayAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use Bearer <token>.', code: 'UNAUTHORIZED' });
  }

  const token = header.slice(7);

  // Try JWT first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'openguardrails-secret-key-change-in-production');
    req.user = decoded;
    return next();
  } catch (jwtErr) {
    // Not a JWT — try as API key
  }

  // Try as API key (keys are stored as SHA-256 hash)
  try {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const keyResult = await db.query(
      'SELECT ak.*, u.email, u.full_name, r.name as role FROM api_keys ak JOIN users u ON ak.user_id = u.id LEFT JOIN roles r ON u.role_id = r.id WHERE ak.key_hash = $1 AND ak.is_active = true',
      [keyHash]
    );
    if (keyResult.rows.length > 0) {
      const k = keyResult.rows[0];
      req.user = { id: k.user_id, email: k.email, role: k.role };
      req.apiKeyId = k.id;

      // Update last_used
      await db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [k.id]);
      return next();
    }
  } catch (err) {
    // DB error — fall through
  }

  return res.status(401).json({ error: 'Invalid token or API key.', code: 'INVALID_TOKEN' });
}

// OpenAI-compatible gateway endpoint
router.post('/v1/chat/completions', gatewayAuth, ctrl.chatCompletions);

// Anthropic-compatible gateway endpoint
router.post('/v1/messages', gatewayAuth, ctrl.messages);

module.exports = router;
