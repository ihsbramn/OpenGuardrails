/**
 * Centralized environment configuration.
 * All config values come from environment variables with sensible defaults.
 * No hardcoded secrets — everything is injectable via K8s ConfigMap/Secret.
 */
require('dotenv').config();

const config = {
  // ---- Node ----
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // ---- Database ----
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/openguardrails',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 10) || 5000,
    },
  },

  // ---- JWT / Auth ----
  jwt: {
    secret: process.env.JWT_SECRET || 'openguardrails-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // ---- CORS ----
  cors: {
    origins: parseArray(process.env.CORS_ORIGINS) || ['*'],
  },

  // ---- Server ----
  server: {
    logLevel: process.env.LOG_LEVEL || 'info',
    maxRequestSizeMb: parseInt(process.env.MAX_REQUEST_SIZE_MB, 10) || 10,
  },

  // ---- Seed ----
  seed: {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@openguardrails.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    adminFullName: process.env.ADMIN_FULL_NAME || 'Administrator',
    demoEmail: process.env.DEMO_EMAIL || 'user@openguardrails.com',
    demoPassword: process.env.DEMO_PASSWORD || 'demo123',
    demoFullName: process.env.DEMO_FULL_NAME || 'Demo User',
  },
};

function parseArray(val) {
  if (!val || val === '*') return ['*'];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = config;
