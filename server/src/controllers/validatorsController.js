const db = require('../config/database');
const { AppError, pgError, validate } = require('../utils/errors');

const validatorsController = {
  async list(req, res, next) {
    try {
      const { category, installed, search, source, limit = 200, offset = 0 } = req.query;
      let query = `
        SELECT v.*, vc.name as category_name, vc.icon as category_icon,
               u.full_name as created_by_name
        FROM validators v
        LEFT JOIN validator_categories vc ON v.category_id = vc.id
        LEFT JOIN users u ON v.created_by = u.id
        WHERE v.is_active = true
      `;
      const params = [];
      let idx = 1;

      if (category) { query += ` AND vc.slug = $${idx++}`; params.push(category); }
      if (installed === 'true') { query += ` AND v.is_installed = true`; }
      else if (installed === 'false') { query += ` AND v.is_installed = false`; }
      if (source === 'hub') { query += ` AND v.source = 'hub'`; }
      else if (source === 'custom') { query += ` AND v.source = 'custom'`; }
      if (search) {
        query += ` AND (v.name ILIKE $${idx} OR v.display_name ILIKE $${idx} OR v.description ILIKE $${idx} OR v.hub_uri ILIKE $${idx})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY v.source ASC, v.name ASC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      const counts = await db.query(
        `SELECT source, COUNT(*)::int as count FROM validators WHERE is_active = true GROUP BY source`
      );
      const countMap = {};
      counts.rows.forEach(c => countMap[c.source] = c.count);

      res.json({
        data: result.rows,
        hub_count: countMap.hub || 0,
        custom_count: countMap.custom || 0,
        total: result.rows.length,
      });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const result = await db.query(
        `SELECT v.*, vc.name as category_name, vc.icon as category_icon,
                u.full_name as created_by_name
         FROM validators v
         LEFT JOIN validator_categories vc ON v.category_id = vc.id
         LEFT JOIN users u ON v.created_by = u.id
         WHERE v.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Validator not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { name, display_name, description, category_id,
        validation_type, validation_code, parameters,
        hub_uri, tags, is_installed } = req.body;

      const v = validate([
        { field: 'name', value: name, rules: [{ required: true }, { minLength: 2 }, { pattern: /^[a-z0-9_-]+$/, message: '"name" must be lowercase alphanumeric with hyphens/underscores only' }] },
        { field: 'validation_type', value: validation_type, rules: [{ oneOf: ['regex', 'llm', 'script', 'keyword', 'length', 'json_schema'] }] },
        { field: 'validation_code', value: validation_code, rules: [
          { custom: (vc) => {
            if (validation_type === 'regex' && vc && !vc.includes('/')) return 'Regex validation_code must include delimiters, e.g. /pattern/flags';
            if (validation_type === 'json_schema' && vc) {
              try { JSON.parse(vc); } catch { return 'JSON Schema is not valid JSON'; }
            }
            if (validation_type === 'length' && vc) {
              try { const o = JSON.parse(vc); if (!o.min && !o.max) return 'Length must specify min and/or max'; } catch { return 'Length must be valid JSON like {"min":10,"max":500}'; }
            }
            return null;
          }}
        ]},
      ]);
      if (v) return res.status(400).json(v.toJSON());

      const uri = hub_uri || `custom://${name}_${Date.now()}`;

      const result = await client.query(
        `INSERT INTO validators (hub_uri, name, display_name, description, category_id,
           source, validation_type, validation_code, parameters, on_fail_options, tags, is_installed, created_by)
         VALUES ($1,$2,$3,$4,$5, 'custom', $6,$7, $8,$9,$10, true, $11)
         RETURNING *`,
        [uri, name, display_name || name, description || '', category_id || null,
         validation_type || 'regex', validation_code || null,
         JSON.stringify(parameters || []),
         JSON.stringify(req.body.on_fail_options || ['exception','fix','filter','reask','noop']),
         JSON.stringify(tags || []), req.user.id]
      );

      if (req.body.new_category_name && !category_id) {
        const slug = req.body.new_category_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const cat = await client.query(
          `INSERT INTO validator_categories (name, slug, description) VALUES ($1,$2,$3) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [req.body.new_category_name, slug, `Custom: ${req.body.new_category_name}`]
        );
        if (cat.rows.length > 0) await client.query('UPDATE validators SET category_id=$1 WHERE id=$2', [cat.rows[0].id, result.rows[0].id]);
      }

      await client.query('COMMIT');

      const full = await client.query(
        `SELECT v.*, vc.name as category_name FROM validators v LEFT JOIN validator_categories vc ON v.category_id=vc.id WHERE v.id=$1`,
        [result.rows[0].id]
      );
      res.status(201).json(full.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code) return res.status(409).json(pgError(err, 'validator').toJSON());
      next(err);
    } finally { client.release(); }
  },

  async update(req, res, next) {
    try {
      const fields = ['name','display_name','description','category_id','is_active','is_installed','validation_type','validation_code'];
      if (req.body.parameters !== undefined) fields.push('parameters');
      if (req.body.on_fail_options !== undefined) fields.push('on_fail_options');
      if (req.body.tags !== undefined) fields.push('tags');

      const setClauses = [];
      const params = [];
      let i = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          setClauses.push(`${f} = $${i++}`);
          params.push(['parameters','on_fail_options','tags'].includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
        }
      }
      if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });

      setClauses.push('updated_at = NOW()');
      params.push(req.params.id);

      const result = await db.query(`UPDATE validators SET ${setClauses.join(',')} WHERE id=$${i} RETURNING *`, params);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Validator not found', code: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(pgError(err, 'validator').toJSON());
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const result = await db.query('DELETE FROM validators WHERE id=$1 RETURNING id, source', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Validator not found', code: 'NOT_FOUND' });
      res.json({ message: 'Validator deleted' });
    } catch (err) {
      if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete: this validator is used by one or more guards. Remove it from guards first.', code: 'REFERENCE_CONFLICT' });
      next(err);
    }
  },

  async install(req, res, next) {
    try {
      const result = await db.query(`UPDATE validators SET is_installed=true, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Validator not found', code: 'NOT_FOUND' });
      res.json({ message: 'Validator installed', validator: result.rows[0] });
    } catch (err) { next(err); }
  },

  async listCategories(req, res, next) {
    try {
      const { source } = req.query;
      let query = `SELECT vc.*, COUNT(v.id)::int as validator_count FROM validator_categories vc LEFT JOIN validators v ON v.category_id=vc.id AND v.is_active=true`;
      if (source === 'hub') query += ` AND v.source='hub'`;
      else if (source === 'custom') query += ` AND v.source='custom'`;
      query += ` GROUP BY vc.id ORDER BY vc.name`;
      const result = await db.query(query);
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async stats(req, res, next) {
    try {
      const result = await db.query(`
        SELECT COUNT(*)::int as total_validators,
               COUNT(*) FILTER (WHERE source='hub')::int as hub_count,
               COUNT(*) FILTER (WHERE source='custom')::int as custom_count,
               COUNT(*) FILTER (WHERE is_installed=true)::int as installed,
               COUNT(*) FILTER (WHERE is_active=true)::int as active
        FROM validators
      `);
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },
};

module.exports = validatorsController;
