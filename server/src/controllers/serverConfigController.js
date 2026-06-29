const db = require('../config/database');
const { AppError, pgError, validate } = require('../utils/errors');

const serverConfigController = {
  async list(req, res, next) { try { const r = await db.query('SELECT * FROM server_configs ORDER BY name'); res.json(r.rows); } catch(e) { next(e); } },

  async get(req, res, next) {
    try {
      const r = await db.query('SELECT * FROM server_configs WHERE id=$1', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Server config not found', code: 'NOT_FOUND' });
      res.json(r.rows[0]);
    } catch(e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { name, host, port, is_ssl, ssl_cert_path, ssl_key_path, log_level,
              max_request_size_mb, request_timeout_seconds, enable_cors, cors_origins, config_file_path, is_active } = req.body;

      const v = validate([
        { field: 'name', value: name, rules: [{ required: true }, { minLength: 2 }] },
        { field: 'port', value: port, rules: [{ custom: v => (v && (v < 1 || v > 65535)) ? '"port" must be between 1 and 65535' : null }] },
        { field: 'log_level', value: log_level, rules: [{ oneOf: ['debug', 'info', 'warning', 'error'] }] },
        { field: 'max_request_size_mb', value: max_request_size_mb, rules: [{ custom: v => (v && v < 1) ? '"max_request_size_mb" must be positive' : null }] },
        { field: 'request_timeout_seconds', value: request_timeout_seconds, rules: [{ custom: v => (v && v < 1) ? '"request_timeout_seconds" must be positive' : null }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const result = await db.query(
        `INSERT INTO server_configs (name, host, port, is_ssl, ssl_cert_path, ssl_key_path, log_level,
           max_request_size_mb, request_timeout_seconds, enable_cors, cors_origins, config_file_path, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [name, host||'0.0.0.0', port||8000, is_ssl||false, ssl_cert_path||null, ssl_key_path||null,
         log_level||'info', max_request_size_mb||10, request_timeout_seconds||30,
         enable_cors||false, JSON.stringify(cors_origins||['*']), config_file_path||null, is_active||false]
      );
      res.status(201).json(result.rows[0]);
    } catch(e) {
      if (e.code) return res.status(409).json(pgError(e, 'server config').toJSON());
      next(e);
    }
  },

  async update(req, res, next) {
    try {
      const fields = ['name','host','port','is_ssl','ssl_cert_path','ssl_key_path','log_level','max_request_size_mb','request_timeout_seconds','enable_cors','config_file_path','is_active'];
      const setClauses = [];
      const params = [];
      let i = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          setClauses.push(`${f} = $${i++}`);
          params.push(f === 'cors_origins' ? JSON.stringify(req.body[f]) : req.body[f]);
        }
      }
      if (req.body.cors_origins !== undefined) { setClauses.push(`cors_origins = $${i++}`); params.push(JSON.stringify(req.body.cors_origins)); }
      setClauses.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(`UPDATE server_configs SET ${setClauses.join(',')} WHERE id=$${i} RETURNING *`, params);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Server config not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch(e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const r = await db.query('DELETE FROM server_configs WHERE id=$1 RETURNING id', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Server config not found', code: 'NOT_FOUND' });
      res.json({ message: 'Server config deleted' });
    } catch(e) { next(e); }
  },

  async status(req, res, next) {
    try {
      const active = await db.query("SELECT * FROM server_configs WHERE is_active = true LIMIT 1");
      res.json({
        has_active: active.rows.length > 0,
        config: active.rows[0] || null,
        total_configs: (await db.query('SELECT COUNT(*)::int FROM server_configs')).rows[0].count,
      });
    } catch(e) { next(e); }
  },
};

module.exports = serverConfigController;
