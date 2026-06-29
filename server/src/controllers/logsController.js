const db = require('../config/database');

const logsController = {
  // GET /api/logs
  async list(req, res) {
    try {
      const { guard_id, passed, limit = 50, offset = 0, from, to } = req.query;
      let query = `
        SELECT vl.*, u.full_name as user_name
        FROM validation_logs vl
        LEFT JOIN users u ON vl.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let idx = 1;

      if (guard_id) { query += ` AND vl.guard_id = $${idx++}`; params.push(guard_id); }
      if (passed === 'true') { query += ` AND vl.validation_passed = true`; }
      else if (passed === 'false') { query += ` AND vl.validation_passed = false`; }
      if (from) { query += ` AND vl.created_at >= $${idx++}`; params.push(from); }
      if (to) { query += ` AND vl.created_at <= $${idx++}`; params.push(to); }

      query += ` ORDER BY vl.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      // Count total
      const countQuery = query.replace(/SELECT vl\.\*, u\.full_name.*?FROM/, 'SELECT COUNT(*)::int as total FROM')
        .replace(/ ORDER BY.*/, '');
      const countResult = await db.query(countQuery, params.slice(0, -2));

      res.json({
        data: result.rows,
        total: countResult.rows[0]?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/logs/:id
  async get(req, res) {
    try {
      const result = await db.query(
        `SELECT vl.*, u.full_name as user_name, g.name as guard_display_name
         FROM validation_logs vl
         LEFT JOIN users u ON vl.user_id = u.id
         LEFT JOIN guards g ON vl.guard_id = g.id
         WHERE vl.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Log not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/logs/stats
  async stats(req, res) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*)::int as total_validations,
          COUNT(*) FILTER (WHERE validation_passed = true)::int as passed,
          COUNT(*) FILTER (WHERE validation_passed = false)::int as failed,
          ROUND(AVG(latency_ms))::int as avg_latency_ms,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int as last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as last_7d
        FROM validation_logs
      `);

      // Daily breakdown for chart
      const daily = await db.query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE validation_passed = true)::int as passed,
          COUNT(*) FILTER (WHERE validation_passed = false)::int as failed
        FROM validation_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `);

      res.json({
        overall: result.rows[0],
        daily: daily.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = logsController;
