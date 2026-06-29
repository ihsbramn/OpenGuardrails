const db = require('../config/database');
const { AppError, pgError, validate } = require('../utils/errors');

const usersController = {
  async list(req, res, next) {
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.role_id, r.name as role,
                u.last_login_at, u.created_at
         FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.role_id, r.name as role,
                u.last_login_at, u.created_at, u.updated_at
         FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    const bcrypt = require('bcryptjs');
    try {
      const { email, full_name, password, role } = req.body;

      const v = validate([
        { field: 'email', value: email, rules: [{ required: true }, { isEmail: true }] },
        { field: 'full_name', value: full_name, rules: [{ required: true }, { minLength: 2 }] },
        { field: 'password', value: password, rules: [{ required: true }, { minLength: 6 }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const hash = await bcrypt.hash(password, 10);
      const result = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role_id)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4))
         RETURNING id, email, full_name, is_active, role_id, created_at`,
        [email.toLowerCase().trim(), hash, full_name, role || 'user']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(pgError(err, 'user').toJSON());
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { email, full_name, is_active, role } = req.body;
      if (email) {
        const v = validate([{ field: 'email', value: email, rules: [{ isEmail: true }] }]);
        if (v) return res.status(400).json(v.toJSON());
      }

      const result = await db.query(
        `UPDATE users SET
           email = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           is_active = COALESCE($3, is_active),
           role_id = CASE WHEN $4::varchar IS NOT NULL THEN (SELECT id FROM roles WHERE name = $4) ELSE role_id END,
           updated_at = NOW()
         WHERE id = $5
         RETURNING id, email, full_name, is_active, role_id`,
        [email || null, full_name || null, is_active !== undefined ? is_active : null, role || null, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(pgError(err, 'user').toJSON());
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      res.json({ message: 'User deleted' });
    } catch (err) {
      next(err);
    }
  },

  async listRoles(req, res, next) {
    try {
      const result = await db.query('SELECT * FROM roles ORDER BY name');
      res.json(result.rows);
    } catch (err) { next(err); }
  },
};

module.exports = usersController;
