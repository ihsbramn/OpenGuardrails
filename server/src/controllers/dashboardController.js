const db = require('../config/database');

const dashboardController = {
  // GET /api/dashboard
  async overview(req, res) {
    try {
      const stats = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE is_active = true) as total_users,
          (SELECT COUNT(*)::int FROM ai_endpoints WHERE is_active = true) as active_endpoints,
          (SELECT COUNT(*)::int FROM validators WHERE is_active = true) as total_validators,
          (SELECT COUNT(*)::int FROM validators WHERE is_installed = true) as installed_validators,
          (SELECT COUNT(*)::int FROM guards WHERE is_active = true) as active_guards,
          (SELECT COUNT(*)::int FROM validation_logs) as total_validations,
          (SELECT COUNT(*)::int FROM validation_logs WHERE validation_passed = false) as failed_validations,
          (SELECT COUNT(*)::int FROM validation_logs WHERE created_at >= NOW() - INTERVAL '24 hours') as validations_24h,
          (SELECT COALESCE(ROUND(
            (SELECT COUNT(*)::numeric FROM validation_logs WHERE validation_passed = true) /
            NULLIF((SELECT COUNT(*)::numeric FROM validation_logs), 0) * 100, 1
          ), 0)) as pass_rate
      `);

      const topGuards = await db.query(`
        SELECT g.name, COUNT(vl.id)::int as validation_count,
               COUNT(*) FILTER (WHERE vl.validation_passed = false)::int as failures
        FROM validation_logs vl
        JOIN guards g ON vl.guard_id = g.id
        GROUP BY g.name
        ORDER BY validation_count DESC
        LIMIT 5
      `);

      const recentActivity = await db.query(`
        SELECT a.*, u.full_name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 10
      `);

      const endpointHealth = await db.query(`
        SELECT e.name, e.provider, e.is_active,
               COUNT(vl.id)::int as recent_calls
        FROM ai_endpoints e
        LEFT JOIN validation_logs vl ON vl.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY e.id
        ORDER BY e.name
      `);

      res.json({
        stats: stats.rows[0],
        top_guards: topGuards.rows,
        recent_activity: recentActivity.rows,
        endpoint_health: endpointHealth.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = dashboardController;
