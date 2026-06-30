const db = require('../config/database');
const { AppError, pgError, validate } = require('../utils/errors');

/**
 * Execute a validator against text.
 * Mirrors the logic in gatewayController.js for consistency.
 */
function executeValidatorRun(v, text) {
  try {
    switch (v.validation_type) {
      case 'regex': {
        if (!v.validation_code) return { passed: true, message: 'No pattern defined' };
        const match = v.validation_code.match(/^\/(.+)\/([gimsu]*)$/);
        if (!match) return { passed: true, message: 'Invalid regex format' };
        const re = new RegExp(match[1], match[2]);
        const matches = text.match(re);
        if (matches) {
          return { passed: false, message: `Matched prohibited pattern: ${matches[0]}`, issues: matches.slice(0, 5) };
        }
        return { passed: true, message: 'No pattern match' };
      }
      case 'keyword': {
        if (!v.validation_code) return { passed: true, message: 'No keywords defined' };
        const keywords = v.validation_code.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const lower = text.toLowerCase();
        const found = keywords.filter(k => lower.includes(k));
        if (found.length) return { passed: false, message: `Matched keywords: ${found.join(', ')}`, issues: found };
        return { passed: true, message: 'No keyword match' };
      }
      case 'length': {
        if (!v.validation_code) return { passed: true, message: 'No length config' };
        const cfg = JSON.parse(v.validation_code);
        if (cfg.min && text.length < cfg.min) return { passed: false, message: `Too short (${text.length} < ${cfg.min})` };
        if (cfg.max && text.length > cfg.max) return { passed: false, message: `Too long (${text.length} > ${cfg.max})` };
        return { passed: true, message: 'Length OK' };
      }
      case 'script': {
        if (!v.validation_code) return { passed: true, message: 'No script' };
        const fn = new Function('text', 'params', v.validation_code);
        return fn(text, v.parameters || {});
      }
      default:
        return { passed: true, message: `Skipped (${v.validation_type || 'unknown'})` };
    }
  } catch (err) {
    return { passed: false, message: `Validator error: ${err.message}`, issues: [err.message] };
  }
}

const guardsController = {
  async list(req, res, next) {
    try {
      const { search, active, limit = 200, offset = 0 } = req.query;
      let query = `SELECT g.*, e.name as endpoint_name, e.provider as endpoint_provider,
                          u.full_name as created_by_name,
                          (SELECT COUNT(*)::int FROM guard_validators gv WHERE gv.guard_id = g.id) as validator_count
                   FROM guards g
                   LEFT JOIN ai_endpoints e ON g.endpoint_id = e.id
                   LEFT JOIN users u ON g.created_by = u.id WHERE 1=1`;
      const params = [];
      let i = 1;
      if (active === 'true') { query += ` AND g.is_active = true`; }
      else if (active === 'false') { query += ` AND g.is_active = false`; }
      if (search) { query += ` AND (g.name ILIKE $${i} OR g.display_name ILIKE $${i})`; params.push(`%${search}%`); i++; }
      query += ` ORDER BY g.name LIMIT $${i++} OFFSET $${i++}`;
      params.push(parseInt(limit), parseInt(offset));
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const guard = await db.query(
        `SELECT g.*, e.name as endpoint_name, e.provider as endpoint_provider, u.full_name as created_by_name
         FROM guards g LEFT JOIN ai_endpoints e ON g.endpoint_id = e.id
         LEFT JOIN users u ON g.created_by = u.id WHERE g.id = $1`, [req.params.id]
      );
      if (guard.rows.length === 0) return res.status(404).json({ error: 'Guard not found', code: 'NOT_FOUND' });

      const validators = await db.query(
        `SELECT v.id, v.name, v.display_name, v.hub_uri, v.category_id, vc.name as category_name,
                v.source, v.validation_type, v.validation_code, v.parameters,
                gv.on_fail_action, gv.priority, v.is_installed, v.is_active, v.tags
         FROM guard_validators gv
         JOIN validators v ON gv.validator_id = v.id
         LEFT JOIN validator_categories vc ON v.category_id = vc.id
         WHERE gv.guard_id = $1 ORDER BY gv.priority ASC`,
        [req.params.id]
      );
      res.json({ ...guard.rows[0], validators: validators.rows });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { name, display_name, description, guard_type, on_fail_action, endpoint_id, model, prompt_template, config, is_active, use_server, validators } = req.body;

      const v = validate([
        { field: 'name', value: name, rules: [{ required: true }, { minLength: 2 }, { pattern: /^[a-z0-9_-]+$/, message: '"name" must be lowercase alphanumeric with hyphens/underscores only' }] },
        { field: 'guard_type', value: guard_type, rules: [{ oneOf: ['input', 'output', 'both'] }] },
        { field: 'on_fail_action', value: on_fail_action, rules: [{ oneOf: ['exception', 'fix', 'filter', 'reask', 'noop', 'log'] }] },
      ]);
      if (v) return res.status(400).json(v.toJSON());

      if (!validators || !Array.isArray(validators) || validators.length === 0) {
        return res.status(400).json({
          error: 'At least one validator is required',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'validators', message: 'A guard must have at least one validator. Provide an array of { validator_id } objects.' }],
        });
      }

      const guard = await client.query(
        `INSERT INTO guards (name, display_name, description, guard_type, on_fail_action, endpoint_id, model, prompt_template, config, is_active, use_server, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [name, display_name||name, description||'', guard_type||'output', on_fail_action||'exception',
         endpoint_id||null, model||null, prompt_template||null, JSON.stringify(config||{}),
         is_active!==false, use_server!==false, req.user.id]
      );

      if (validators && validators.length > 0) {
        for (let i = 0; i < validators.length; i++) {
          const vd = validators[i];
          await client.query(
            `INSERT INTO guard_validators (guard_id, validator_id, parameters, on_fail_action, priority)
             VALUES ($1,$2,$3,$4,$5)`,
            [guard.rows[0].id, vd.validator_id || vd.id,
             JSON.stringify(vd.parameters || {}), vd.on_fail_action || on_fail_action || 'exception', i]
          );
        }
      }
      await client.query('COMMIT');
      res.status(201).json(guard.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code) return res.status(409).json(pgError(err, 'guard').toJSON());
      next(err);
    } finally { client.release(); }
  },

  async update(req, res, next) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const fields = ['name','display_name','description','guard_type','on_fail_action','endpoint_id','model','prompt_template','is_active','use_server'];
      const vals = fields.map(f => req.body[f] !== undefined ? req.body[f] : null);
      if (req.body.config !== undefined) vals[vals.indexOf(null)] = JSON.stringify(req.body.config);

      const setClauses = [];
      const params = [];
      let i = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          setClauses.push(`${f} = $${i++}`);
          params.push(f === 'config' ? JSON.stringify(req.body[f]) : req.body[f]);
        }
      }
      setClauses.push(`updated_at = NOW()`);
      params.push(req.params.id);

      const result = await client.query(
        `UPDATE guards SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`, params
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Guard not found', code: 'NOT_FOUND' });
      }

      if (req.body.validators) {
        await client.query('DELETE FROM guard_validators WHERE guard_id = $1', [req.params.id]);
        for (let idx = 0; idx < req.body.validators.length; idx++) {
          const vd = req.body.validators[idx];
          await client.query(
            `INSERT INTO guard_validators (guard_id, validator_id, parameters, on_fail_action, priority)
             VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, vd.validator_id || vd.id,
             JSON.stringify(vd.parameters || {}), vd.on_fail_action || req.body.on_fail_action || 'exception', idx]
          );
        }
      }
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23503') return res.status(400).json(pgError(err, 'guard').toJSON());
      if (err.code === '23505') return res.status(409).json(pgError(err, 'guard').toJSON());
      next(err);
    } finally { client.release(); }
  },

  async remove(req, res, next) {
    try {
      const result = await db.query('DELETE FROM guards WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Guard not found', code: 'NOT_FOUND' });
      res.json({ message: 'Guard deleted' });
    } catch (err) { next(err); }
  },

  async run(req, res, next) {
    try {
      const guard = await db.query('SELECT * FROM guards WHERE id = $1', [req.params.id]);
      if (guard.rows.length === 0) return res.status(404).json({ error: 'Guard not found', code: 'NOT_FOUND' });

      const { text } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text to validate is required',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'text', message: 'Provide the input/output text to validate' }],
        });
      }

      const validators = await db.query(
        `SELECT v.* FROM guard_validators gv JOIN validators v ON gv.validator_id = v.id WHERE gv.guard_id = $1 ORDER BY gv.priority`,
        [req.params.id]
      );

      // Run each validator against the text
      const results = [];
      for (const v of validators.rows) {
        const result = executeValidatorRun(v, text);
        results.push({
          validator_id: v.id,
          name: v.name,
          display_name: v.display_name,
          type: v.source,
          validation_type: v.validation_type,
          passed: result.passed,
          message: result.message,
          issues: result.issues || [],
          score: result.passed ? 1.0 : 0.0,
        });
      }

      const allPassed = results.every(r => r.passed);

      // Log the run
      await db.query(
        `INSERT INTO validation_logs (guard_id, guard_name, input_text, output_text, validation_passed, total_checks, checks_passed, checks_failed, validator_results)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [req.params.id, guard.rows[0].name, text, null, allPassed, results.length,
         results.filter(r=>r.passed).length, results.filter(r=>!r.passed).length, JSON.stringify(results)]
      );

      res.json({ passed: allPassed, total_checks: results.length, results });
    } catch (err) { next(err); }
  },

  async stats(req, res, next) {
    try {
      const result = await db.query(`
        SELECT COUNT(*)::int as total_guards,
               COUNT(*) FILTER (WHERE is_active = true)::int as active,
               COUNT(*) FILTER (WHERE guard_type = 'input')::int as input_guards,
               COUNT(*) FILTER (WHERE guard_type = 'output')::int as output_guards,
               COUNT(*) FILTER (WHERE guard_type = 'both')::int as both_guards
        FROM guards
      `);
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },
};

module.exports = guardsController;
