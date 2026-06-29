const db = require('../config/database');

// Log audit events
async function auditLog(userId, action, resourceType, resourceId, details = {}, clientIp = null) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, client_ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, JSON.stringify(details), clientIp]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// Middleware to auto-log API actions
function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (req.user && req.method !== 'GET') {
      const resourceType = req.path.split('/')[2] || 'unknown';
      const resourceId = req.params.id || null;
      auditLog(req.user.id, req.method, resourceType, resourceId, {
        path: req.originalUrl,
        statusCode: res.statusCode,
      }, req.ip);
    }
    return originalJson(body);
  };
  next();
}

module.exports = { auditLog, auditMiddleware };
