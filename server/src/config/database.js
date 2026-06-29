const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  console.error('Unexpected database error on idle client', err);
  // Don't crash in production — let the pool handle reconnection
  if (config.nodeEnv !== 'production') {
    process.exit(-1);
  }
});

// Graceful shutdown hook
async function shutdown() {
  console.log('Closing database pool...');
  await pool.end();
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  shutdown,
};
