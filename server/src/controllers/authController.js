const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/database');
const { AppError, validate } = require('../utils/errors');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const v = validate([
        { field: 'email', value: email, rules: [{ required: true }, { isEmail: true }] },
        { field: 'password', value: password, rules: [{ required: true }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const result = await db.query(
        `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active, u.role_id, r.name as role
         FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1`,
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid email or password.',
          code: 'AUTH_FAILED',
          details: [{ field: 'email', message: 'No account found with this email' }],
        });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({
          error: 'Invalid email or password.',
          code: 'AUTH_FAILED',
          details: [{ field: 'password', message: 'Incorrect password' }],
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          error: 'Account is deactivated. Contact an administrator.',
          code: 'ACCOUNT_INACTIVE',
          details: [{ field: 'email', message: 'This account has been deactivated' }],
        });
      }

      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        token,
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.role_id, r.name as role
         FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
