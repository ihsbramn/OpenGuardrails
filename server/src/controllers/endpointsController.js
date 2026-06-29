const db = require('../config/database');
const { AppError, pgError, validate } = require('../utils/errors');

const endpointsController = {
  async list(req, res, next) {
    try {
      const { provider, active, limit = 200, offset = 0 } = req.query;
      let query = `SELECT e.*, u.full_name as created_by_name FROM ai_endpoints e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1`;
      const params = [];
      let i = 1;
      if (provider) { query += ` AND e.provider = $${i++}`; params.push(provider); }
      if (active === 'true') { query += ` AND e.is_active = true`; }
      else if (active === 'false') { query += ` AND e.is_active = false`; }
      query += ` ORDER BY e.name LIMIT $${i++} OFFSET $${i++}`;
      params.push(parseInt(limit), parseInt(offset));
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const result = await db.query(`SELECT e.*, u.full_name as created_by_name FROM ai_endpoints e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { name, provider, base_url, api_key, default_model, available_models, headers } = req.body;

      const v = validate([
        { field: 'name', value: name, rules: [{ required: true }, { minLength: 2 }] },
        { field: 'provider', value: provider, rules: [{ required: true }, { oneOf: ['openai', 'anthropic', 'openai_compatible', 'anthropic_compatible'] }] },
        { field: 'base_url', value: base_url, rules: [{ required: true }, { isUrl: true }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const result = await db.query(
        `INSERT INTO ai_endpoints (name, provider, base_url, api_key_encrypted, default_model, available_models, headers, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, provider, base_url, api_key || null, default_model || null,
         JSON.stringify(available_models || []), JSON.stringify(headers || {}), req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code) return res.status(409).json(pgError(err, 'endpoint').toJSON());
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { name, provider, base_url, api_key, default_model, available_models, headers, is_active } = req.body;

      if (base_url) {
        const v = validate([{ field: 'base_url', value: base_url, rules: [{ isUrl: true }] }]);
        if (v) return res.status(400).json(v.toJSON());
      }
      if (provider) {
        const v = validate([{ field: 'provider', value: provider, rules: [{ oneOf: ['openai', 'anthropic', 'openai_compatible', 'anthropic_compatible'] }] }]);
        if (v) return res.status(400).json(v.toJSON());
      }

      const result = await db.query(
        `UPDATE ai_endpoints SET name=COALESCE($1,name), provider=COALESCE($2,provider),
           base_url=COALESCE($3,base_url), api_key_encrypted=COALESCE($4,api_key_encrypted),
           default_model=COALESCE($5,default_model), available_models=COALESCE($6,available_models),
           headers=COALESCE($7,headers), is_active=COALESCE($8,is_active), updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [name||null, provider||null, base_url||null, api_key||null, default_model||null,
         available_models?JSON.stringify(available_models):null, headers?JSON.stringify(headers):null,
         is_active!==undefined?is_active:null, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code) return res.status(409).json(pgError(err, 'endpoint').toJSON());
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await db.query('DELETE FROM ai_endpoints WHERE id=$1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      res.json({ message: 'Endpoint deleted' });
    } catch (err) {
      if (err.code === '23503') return res.status(400).json(pgError(err, 'endpoint').toJSON());
      next(err);
    }
  },

  async test(req, res, next) {
    try {
      const ep = await db.query('SELECT * FROM ai_endpoints WHERE id=$1', [req.params.id]);
      if (ep.rows.length === 0) return res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });

      const { name, provider, base_url } = ep.rows[0];
      // Basic connectivity check — try fetching models list
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const resp = await fetch(`${base_url}/models`, {
          headers: { 'Authorization': `Bearer ${ep.rows[0].api_key_encrypted || ''}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await resp.json();
        res.json({
          success: resp.ok,
          status: resp.status,
          endpoint: name,
          provider,
          models_found: data?.data?.length || data?.models?.length || 0,
          message: resp.ok ? 'Connection successful' : `HTTP ${resp.status}: ${JSON.stringify(data).substring(0, 200)}`,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        res.json({
          success: false,
          status: fetchErr.name === 'AbortError' ? 'timeout' : 'error',
          endpoint: name,
          provider,
          message: fetchErr.name === 'AbortError'
            ? `Connection timed out (8s) — check that "${base_url}" is reachable`
            : `Cannot reach ${base_url}: ${fetchErr.message}`,
        });
      }
    } catch (err) { next(err); }
  },
};

module.exports = endpointsController;
