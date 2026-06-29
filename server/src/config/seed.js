const bcrypt = require('bcryptjs');
const config = require('./env');
const { pool } = require('./database');

async function seed() {
  const client = await pool.connect();
  try {
    // Admin user
    const adminHash = await bcrypt.hash(config.seed.adminPassword, 10);
    await client.query(`
      UPDATE users SET password_hash = $1 WHERE email = $2
    `, [adminHash, config.seed.adminEmail]);

    // Demo user
    const demoHash = await bcrypt.hash(config.seed.demoPassword, 10);
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role_id)
      VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = 'user'))
      ON CONFLICT (email) DO UPDATE SET
        password_hash = $2,
        full_name = $3
    `, [config.seed.demoEmail, demoHash, config.seed.demoFullName]);

    // Default AI endpoint
    await client.query(`
      INSERT INTO ai_endpoints (name, provider, base_url, default_model, available_models)
      VALUES ('Default OpenAI', 'openai', 'https://api.openai.com/v1', 'gpt-4o',
              '["gpt-4o","gpt-4o-mini","gpt-4-turbo","gpt-3.5-turbo"]')
      ON CONFLICT DO NOTHING
    `);

    // Default server config
    await client.query(`
      INSERT INTO server_configs (name, host, port, is_active)
      VALUES ('Default Server', '0.0.0.0', 8000, false)
      ON CONFLICT DO NOTHING
    `);

    console.log('Seed data created successfully.');
    console.log(`  Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
    console.log(`  User:  ${config.seed.demoEmail} / ${config.seed.demoPassword}`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
