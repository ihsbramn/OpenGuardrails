const http = require('http');

const NODE = '/Applications/Open Cowork.app/Contents/Resources/node/bin/node';
const BASE = 'http://localhost:3000';
let token = '';

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function test(name, fn) {
  try {
    const result = await fn();
    if (result && typeof result === 'object' && result.error) {
      console.log(`  ✗ ${name}: ${result.error}${result.code ? ' [' + result.code + ']' : ''}`);
      if (result.details) result.details.forEach(d => console.log(`    → ${d.field}: ${d.message}`));
    } else {
      const summary = typeof result === 'object' ? JSON.stringify(result).substring(0, 120) : result;
      console.log(`  ✓ ${name}: ${summary}`);
    }
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

async function main() {
  console.log('=== AUTH TESTS ===\n');

  // Login
  const login = await req('POST', '/api/auth/login', { email: 'admin@openguardrails.com', password: 'admin123' });
  if (login.body.token) {
    console.log('  ✓ Login: got token');
    token = login.body.token;
  } else {
    console.log('  ✗ Login:', JSON.stringify(login.body));
    process.exit(1);
  }

  // Bad login
  await test('Bad email', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'nope@x.com', password: 'x' });
    return r.body;
  });

  await test('Bad password', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'admin@openguardrails.com', password: 'wrong' });
    return r.body;
  });

  await test('Missing fields', async () => {
    const r = await req('POST', '/api/auth/login', { email: '' });
    return r.body;
  });

  // Me
  const me = await req('GET', '/api/auth/me');
  console.log(`  ✓ Me: ${me.body.email} (${me.body.role})`);

  // Health
  const health = await req('GET', '/api/health');
  console.log(`  ✓ Health: ${health.body.status}`);

  const ready = await req('GET', '/api/health/ready');
  console.log(`  ✓ Ready: ${ready.body.status}`);

  console.log('\n=== VALIDATORS ===\n');

  const hub = await req('GET', '/api/validators?source=hub&limit=5');
  console.log(`  ✓ Hub validators: ${hub.body.hub_count} total, ${hub.body.data.length} returned`);
  const names = hub.body.data.map(v => v.display_name).slice(0, 5).join(', ');
  console.log(`    → ${names}`);

  const cats = await req('GET', '/api/validators/categories');
  console.log(`  ✓ Categories: ${cats.body.length} (${cats.body.map(c => c.name + ':' + c.validator_count).join(', ')})`);

  const stats = await req('GET', '/api/validators/stats');
  console.log(`  ✓ Stats: hub=${stats.body.hub_count} custom=${stats.body.custom_count} installed=${stats.body.installed}`);

  // Validation error test — missing name
  await test('Create validator — missing fields', async () => {
    const r = await req('POST', '/api/validators', { description: 'test' });
    return r.body;
  });

  // Validation error — bad name
  await test('Create validator — bad name', async () => {
    const r = await req('POST', '/api/validators', { name: 'Bad Name!', validation_type: 'regex' });
    return r.body;
  });

  // Validation error — bad validation_type
  await test('Create validator — bad type', async () => {
    const r = await req('POST', '/api/validators', { name: 'test_check', validation_type: 'garbage' });
    return r.body;
  });

  // Successful custom create
  let customId;
  await test('Create custom validator', async () => {
    const r = await req('POST', '/api/validators', {
      name: 'qa_test_validator',
      display_name: 'QA Test Validator',
      description: 'Auto-created by QA suite',
      validation_type: 'regex',
      validation_code: '/error|fail/i',
      tags: ['test', 'qa'],
      parameters: [{ name: 'threshold', type: 'number', default: 0.5 }],
    });
    if (r.body.id) customId = r.body.id;
    return { id: r.body.id, name: r.body.name, source: r.body.source };
  });

  // Verify it shows in custom tab
  const customList = await req('GET', '/api/validators?source=custom');
  console.log(`  ✓ Custom list after create: ${customList.body.custom_count} validators`);

  // Install a hub validator
  if (hub.body.data.length > 0) {
    const firstHub = hub.body.data[0];
    await test(`Install ${firstHub.display_name}`, async () => {
      const r = await req('POST', `/api/validators/${firstHub.id}/install`);
      return { validator: r.body.validator?.display_name, is_installed: r.body.validator?.is_installed };
    });
  }

  // Cleanup — delete the test validator
  if (customId) {
    await test('Delete custom validator', async () => {
      const r = await req('DELETE', `/api/validators/${customId}`);
      return r.body;
    });
  }

  console.log('\n=== ENDPOINTS ===\n');

  await test('Create endpoint — missing fields', async () => {
    const r = await req('POST', '/api/endpoints', { name: 'test' });
    return r.body;
  });

  await test('Create endpoint — bad provider', async () => {
    const r = await req('POST', '/api/endpoints', { name: 'test', provider: 'invalid', base_url: 'https://api.test.com' });
    return r.body;
  });

  await test('Create endpoint — bad URL', async () => {
    const r = await req('POST', '/api/endpoints', { name: 'test', provider: 'openai', base_url: 'not-a-url' });
    return r.body;
  });

  let endpointId;
  await test('Create endpoint — valid', async () => {
    const r = await req('POST', '/api/endpoints', {
      name: 'QA Test Endpoint',
      provider: 'openai',
      base_url: 'https://api.test.com/v1',
      default_model: 'gpt-test',
    });
    if (r.body.id) endpointId = r.body.id;
    return { id: r.body.id, name: r.body.name, provider: r.body.provider };
  });

  // Duplicate name — unique constraint
  await test('Create endpoint — duplicate name', async () => {
    const r = await req('POST', '/api/endpoints', {
      name: 'QA Test Endpoint',
      provider: 'openai',
      base_url: 'https://api.other.com/v1',
    });
    return r.body;
  });

  // Test connection
  await test('Test endpoint connection', async () => {
    const r = await req('POST', `/api/endpoints/${endpointId}/test`);
    return { success: r.body.success, message: r.body.message?.substring(0, 80) };
  });

  if (endpointId) {
    await test('Delete endpoint', async () => {
      const r = await req('DELETE', `/api/endpoints/${endpointId}`);
      return r.body;
    });
  }

  console.log('\n=== GUARDS ===\n');

  // Create a guard (needs validators)
  const allValidators = await req('GET', '/api/validators?limit=2');
  if (allValidators.body.data && allValidators.body.data.length >= 2) {
    const [v1, v2] = allValidators.body.data;

    await test('Create guard — missing validators', async () => {
      const r = await req('POST', '/api/guards', { name: 'test_guard', guard_type: 'output' });
      return r.body;
    });

    await test('Create guard — bad name', async () => {
      const r = await req('POST', '/api/guards', { name: 'Bad Guard Name', guard_type: 'output', validators: [{ validator_id: v1.id }] });
      return r.body;
    });

    let guardId;
    await test('Create guard', async () => {
      const r = await req('POST', '/api/guards', {
        name: 'qa_test_guard',
        display_name: 'QA Test Guard',
        description: 'Auto-created by QA',
        guard_type: 'both',
        on_fail_action: 'filter',
        validators: [
          { validator_id: v1.id, parameters: { threshold: 0.5 }, on_fail_action: 'exception' },
          { validator_id: v2.id, parameters: {}, on_fail_action: 'fix' },
        ],
      });
      if (r.body.id) guardId = r.body.id;
      return { id: r.body.id, name: r.body.name };
    });

    // Get guard with validators
    if (guardId) {
      const g = await req('GET', `/api/guards/${guardId}`);
      console.log(`  ✓ Get guard: ${g.body.name}, validators: ${g.body.validators?.length}`);

      // Run guard (simulated)
      await test('Run guard', async () => {
        const r = await req('POST', `/api/guards/${guardId}/validate`, { text: 'This is a test input for validation' });
        return { passed: r.body.passed, checks: r.body.total_checks, results: r.body.results?.length };
      });

      // Delete guard
      await test('Delete guard', async () => {
        const r = await req('DELETE', `/api/guards/${guardId}`);
        return r.body;
      });
    }
  }

  console.log('\n=== USERS ===\n');

  await test('Create user — missing fields', async () => {
    const r = await req('POST', '/api/users', { email: 'test@test.com' });
    return r.body;
  });

  await test('Create user — bad email', async () => {
    const r = await req('POST', '/api/users', { email: 'not-an-email', full_name: 'Test', password: '123456' });
    return r.body;
  });

  await test('Create user — short password', async () => {
    const r = await req('POST', '/api/users', { email: 'test@test.com', full_name: 'Test', password: '123' });
    return r.body;
  });

  let userId;
  await test('Create user', async () => {
    const r = await req('POST', '/api/users', {
      email: 'qa-user@test.com', full_name: 'QA Test User', password: 'password123', role: 'user',
    });
    if (r.body.id) userId = r.body.id;
    return { id: r.body.id, email: r.body.email, full_name: r.body.full_name };
  });

  // Duplicate
  await test('Create user — duplicate email', async () => {
    const r = await req('POST', '/api/users', {
      email: 'qa-user@test.com', full_name: 'Duplicate', password: 'password123',
    });
    return r.body;
  });

  // Roles
  const roles = await req('GET', '/api/users/roles');
  console.log(`  ✓ Roles: ${roles.body.map(r => r.name).join(', ')}`);

  if (userId) {
    await test('Delete user', async () => {
      const r = await req('DELETE', `/api/users/${userId}`);
      return r.body;
    });
  }

  console.log('\n=== API KEYS ===\n');

  await test('Create API key — missing name', async () => {
    const r = await req('POST', '/api/api-keys', {});
    return r.body;
  });

  let keyId;
  await test('Create API key', async () => {
    const r = await req('POST', '/api/api-keys', { name: 'QA Test Key', permissions: ['read', 'write'] });
    if (r.body.id) keyId = r.body.id;
    return { id: r.body.id, has_key: !!r.body.api_key, prefix: r.body.key_prefix };
  });

  if (keyId) {
    await test('Revoke API key', async () => {
      const r = await req('POST', `/api/api-keys/${keyId}/revoke`);
      return r.body;
    });
  }

  console.log('\n=== SERVER CONFIG ===\n');

  await test('Create config — missing name', async () => {
    const r = await req('POST', '/api/server-configs', { port: 8080 });
    return r.body;
  });

  await test('Create config — bad port', async () => {
    const r = await req('POST', '/api/server-configs', { name: 'test', port: 99999 });
    return r.body;
  });

  await test('Create config — bad log_level', async () => {
    const r = await req('POST', '/api/server-configs', { name: 'test', log_level: 'verbose' });
    return r.body;
  });

  let configId;
  await test('Create config', async () => {
    const r = await req('POST', '/api/server-configs', {
      name: 'QA Test Config',
      host: '0.0.0.0',
      port: 8888,
      log_level: 'debug',
      enable_cors: true,
      cors_origins: ['http://localhost:8080'],
    });
    if (r.body.id) configId = r.body.id;
    return { id: r.body.id, name: r.body.name, port: r.body.port };
  });

  // Status
  const srvStatus = await req('GET', '/api/server-configs/status');
  console.log(`  ✓ Server status: active=${srvStatus.body.has_active}, total=${srvStatus.body.total_configs}`);

  if (configId) {
    await test('Delete config', async () => {
      const r = await req('DELETE', `/api/server-configs/${configId}`);
      return r.body;
    });
  }

  console.log('\n=== DASHBOARD ===\n');
  const dash = await req('GET', '/api/dashboard/stats');
  const d = dash.body.stats || dash.body;
  console.log(`  ✓ Dashboard: ${d.total_users} users, ${d.total_validators} validators, ${d.active_guards || d.total_guards || 0} guards, ${d.active_endpoints} endpoints`);

  console.log('\n=== 404 ===\n');
  const notFound = await req('GET', '/api/nonexistent');
  console.log(`  ✓ 404: ${notFound.body.error}`);

  console.log('\n========== QA COMPLETE ==========');
}

main().catch(console.error);
