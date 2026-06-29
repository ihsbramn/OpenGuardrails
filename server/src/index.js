const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/env');
const { shutdown } = require('./config/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const endpointRoutes = require('./routes/endpoints');
const validatorRoutes = require('./routes/validators');
const guardRoutes = require('./routes/guards');
const logRoutes = require('./routes/logs');
const serverConfigRoutes = require('./routes/serverConfig');
const dashboardRoutes = require('./routes/dashboard');
const apiKeyRoutes = require('./routes/apiKeys');
const { auditMiddleware } = require('./middleware/audit');

const app = express();

// ---- Middleware ----
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));
app.use(express.json({ limit: `${config.server.maxRequestSizeMb}mb` }));
if (config.nodeEnv !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}
app.use(auditMiddleware);

// Trust proxy headers when behind nginx/ingress
app.set('trust proxy', true);

// ---- Health / Readiness check ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    await require('./config/database').query('SELECT 1');
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/endpoints', endpointRoutes);
app.use('/api/validators', validatorRoutes);
app.use('/api/guards', guardRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/server-configs', serverConfigRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/api-keys', apiKeyRoutes);

// ---- 404 ----
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---- Global Error Handler ----
app.use((err, req, res, _next) => {
  if (err.status && err.code) {
    // AppError — already formatted
    return res.status(err.status).json(err.toJSON());
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
      code: 'INVALID_TOKEN',
      details: [{ field: 'token', message: 'The authentication token is malformed or expired.' }],
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Your session has expired. Please log in again.',
      code: 'TOKEN_EXPIRED',
      details: [{ field: 'token', message: `Token expired at ${err.expiredAt}` }],
    });
  }

  // Body parse errors
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({
      error: 'Request body is malformed or too large.',
      code: 'BODY_PARSE_ERROR',
      details: [{ field: 'body', message: err.message }],
    });
  }

  // Unknown errors — don't leak details in production
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error.',
    code: 'INTERNAL_ERROR',
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
});

// ---- Graceful shutdown ----
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down...');
  await shutdown();
  process.exit(0);
});

// ---- Start ----
if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`OpenGuardrails API running on 0.0.0.0:${config.port} [${config.nodeEnv}]`);
    console.log(`Health check: http://0.0.0.0:${config.port}/api/health`);
  });
}

module.exports = app;
