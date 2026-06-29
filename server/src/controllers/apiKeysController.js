const crypto = require('crypto');
const db = require('../config/database');
const { AppError, validate } = require('../utils/errors');

const apiKeysController = {
  async list(req, res, next) {
    try {
      const result = await db.query(
        `SELECT id, name, key_prefix, permissions, expires_at, last_used_at, is_active, created_at
         FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id]
      );
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { name, permissions } = req.body;

      const v = validate([
        { field: 'name', value: name, rules: [{ required: true }, { minLength: 2 }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const rawKey = `og_${crypto.randomBytes(24).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 10);

      const result = await db.query(
        `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, permissions, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, key_prefix, permissions, created_at`,
        [req.user.id, name, keyHash, keyPrefix,
         JSON.stringify(permissions || ['read']),
         req.body.expires_at || null]
      );

      res.status(201).json({
        ...result.rows[0],
        api_key: rawKey,
        message: 'Store this key securely — it will not be shown again.',
      });
    } catch (err) { next(err); }
  },

  async revoke(req, res, next) {
    try {
      const result = await db.query('UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'API key not found', code: 'NOT_FOUND' });
      res.json({ message: 'API key revoked' });
    } catch (err) { next(err); }
  },
};

module.exports = apiKeysController;
