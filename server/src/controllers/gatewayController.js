const db = require('../config/database');

/**
 * OpenGuardrails LLM Gateway
 *
 * Single unified endpoint that routes requests through all active guards.
 * OpenAI-compatible: POST /api/v1/chat/completions
 * Anthropic-compatible: POST /api/v1/messages
 *
 * The gateway reads global settings from the active server_config to determine
 * which guards to apply. No guard_id needed — everything is configured server-side.
 */

// ---- Format Conversion Helpers ----

/** Convert OpenAI messages format to Anthropic format */
function toAnthropicMessages(openaiMessages) {
  const system = openaiMessages
    .filter(m => m.role === 'system')
    .map(m => ({ type: 'text', text: m.content }));

  const messages = openaiMessages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }));

  return { system: system.length > 0 ? system : undefined, messages };
}

/** Convert Anthropic response content to OpenAI format */
function toOpenAIResponse(anthropicBody, model) {
  const text = anthropicBody.content
    ?.filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n') || '';

  return {
    id: anthropicBody.id || 'chatcmpl-gateway',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || anthropicBody.model || 'unknown',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: mapStopReason(anthropicBody.stop_reason),
    }],
  };
}

function mapStopReason(reason) {
  switch (reason) {
    case 'end_turn': return 'stop';
    case 'max_tokens': return 'length';
    case 'stop_sequence': return 'stop';
    default: return reason || 'stop';
  }
}

/** Build Anthropic request body from OpenAI format */
function buildAnthropicRequest(openaiBody, model) {
  const { system, messages } = toAnthropicMessages(openaiBody.messages || []);
  const body = {
    model: model || openaiBody.model,
    messages,
    max_tokens: openaiBody.max_tokens || 1024,
  };
  if (system) body.system = system;
  if (openaiBody.temperature != null) body.temperature = openaiBody.temperature;
  if (openaiBody.top_p != null) body.top_p = openaiBody.top_p;
  if (openaiBody.stop) body.stop_sequences = Array.isArray(openaiBody.stop) ? openaiBody.stop : [openaiBody.stop];
  return body;
}

// ---- Validator Execution ----

function executeValidator(v, text) {
  try {
    switch (v.validation_type) {
      case 'regex': {
        if (!v.validation_code) return { passed: true, message: 'No pattern' };
        const match = v.validation_code.match(/^\/(.+)\/([gimsu]*)$/);
        if (!match) return { passed: true, message: 'Invalid regex' };
        const re = new RegExp(match[1], match[2]);
        const matches = text.match(re);
        if (matches) {
          return { passed: false, message: `Matched prohibited pattern`, issues: matches.slice(0, 5) };
        }
        return { passed: true, message: 'No match' };
      }
      case 'keyword': {
        if (!v.validation_code) return { passed: true, message: 'No keywords' };
        const keywords = v.validation_code.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const lower = text.toLowerCase();
        const found = keywords.filter(k => lower.includes(k));
        if (found.length) return { passed: false, message: `Matched: ${found.join(', ')}`, issues: found };
        return { passed: true, message: 'No match' };
      }
      case 'length': {
        if (!v.validation_code) return { passed: true, message: 'No config' };
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
        return { passed: true, message: `Skipped (${v.validation_type})` };
    }
  } catch (err) {
    return { passed: false, message: `Error: ${err.message}`, issues: [err.message] };
  }
}

/** Extract text from an OpenAI-compatible response */
function extractResponseText(body) {
  if (body.choices && Array.isArray(body.choices)) {
    return body.choices.map(c => {
      const parts = [];
      if (c.message?.content) parts.push(c.message.content);
      if (c.message?.reasoning_content) parts.push(c.message.reasoning_content);
      return parts.join('\n');
    }).join('\n');
  }
  return '';
}

/** Extract user input text from the request body */
function extractInputText(body) {
  if (!body || !body.messages) return '';
  return body.messages.map(m => `[${m.role}]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');
}

/** Apply token-based redaction from validator results */
function redactText(text, results) {
  let out = text;
  for (const r of results) {
    if (!r.passed && r.issues) {
      for (const issue of r.issues) {
        if (typeof issue === 'string' && issue.length > 0) {
          out = out.replaceAll(issue, '█'.repeat(issue.length));
        }
      }
    }
  }
  return out;
}

// ---- Gateway Controller ----

const gatewayController = {
  /**
   * POST /api/v1/chat/completions
   * OpenAI-compatible gateway endpoint.
   */
  async chatCompletions(req, res, next) {
    await handleGatewayRequest(req, res, next, 'openai');
  },

  /**
   * POST /api/v1/messages
   * Anthropic-compatible gateway endpoint.
   */
  async messages(req, res, next) {
    await handleGatewayRequest(req, res, next, 'anthropic');
  },
};

async function handleGatewayRequest(req, res, next, mode) {
  const client = await db.pool.connect();
  try {
    // 1. Load gateway config from the active server_config
    const configRes = await client.query(
      `SELECT * FROM server_configs WHERE is_active = true LIMIT 1`
    );
    if (configRes.rows.length === 0) {
      return res.status(503).json({ error: 'No active server configuration. Configure gateway in Server Config.', code: 'GATEWAY_NOT_CONFIGURED' });
    }
    const gwConfig = configRes.rows[0];

    // Check per-mode toggle
    if (mode === 'openai' && !gwConfig.gateway_openai_enabled) {
      return res.status(503).json({ error: 'OpenAI-compatible gateway is not enabled. Enable it in Server Config.', code: 'GATEWAY_OPENAI_DISABLED' });
    }
    if (mode === 'anthropic' && !gwConfig.gateway_anthropic_enabled) {
      return res.status(503).json({ error: 'Anthropic-compatible gateway is not enabled. Enable it in Server Config.', code: 'GATEWAY_ANTHROPIC_DISABLED' });
    }

    const guardIds = gwConfig.gateway_guard_ids || [];
    if (!guardIds.length) {
      return res.status(503).json({ error: 'No guards configured for gateway. Select guards in Server Config.', code: 'GATEWAY_NO_GUARDS' });
    }

    // 2. Load all configured guards with their validators and endpoints
    const guardsRes = await client.query(
      `SELECT g.*, e.name as endpoint_name, e.base_url as endpoint_base_url,
              e.api_key_encrypted, e.provider, e.headers as endpoint_headers,
              e.default_model
       FROM guards g
       LEFT JOIN ai_endpoints e ON g.endpoint_id = e.id AND e.is_active = true
       WHERE g.id = ANY($1::uuid[]) AND g.is_active = true`,
      [guardIds]
    );

    if (guardsRes.rows.length === 0) {
      return res.status(503).json({ error: 'None of the configured guards are active.', code: 'GATEWAY_NO_ACTIVE_GUARDS' });
    }

    // Find the first guard that has a working endpoint
    let activeGuard = null;
    let activeEndpoint = null;
    for (const g of guardsRes.rows) {
      if (g.endpoint_base_url && g.api_key_encrypted) {
        activeGuard = g;
        activeEndpoint = {
          base_url: g.endpoint_base_url.replace(/\/+$/, ''),
          api_key: g.api_key_encrypted,
          provider: g.provider,
          headers: g.endpoint_headers || {},
          default_model: g.default_model,
        };
        break;
      }
    }

    if (!activeEndpoint) {
      return res.status(503).json({ error: 'No active AI endpoint with API key found in gateway guards. Configure an endpoint on each guard.', code: 'GATEWAY_NO_ENDPOINT' });
    }

    // 3. Forward request to AI provider.
    // Always forward in OpenAI format to the endpoint — the gateway accepts
    // both input formats but the upstream endpoint is configured separately.
    const requestModel = req.body.model || activeEndpoint.default_model || 'gpt-4o';
    const targetUrl = `${activeEndpoint.base_url}/chat/completions`;
    const forwardBody = req.body;

    // 4. Forward request to AI provider
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let providerResp;
    try {
      const fwdHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeEndpoint.api_key}`,
      };
      Object.assign(fwdHeaders, activeEndpoint.headers);

      // Always use Bearer auth for OpenAI-compatible forwarding
      // (Anthropic-native endpoints use x-api-key, but gateway always
      // forwards to the endpoint's native protocol)

      providerResp = await fetch(targetUrl, {
        method: 'POST',
        headers: fwdHeaders,
        body: JSON.stringify(forwardBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err?.name === 'AbortError' ? 'Request timed out (60s)' : (err.message || 'Unknown error');
      await client.query(
        `INSERT INTO validation_logs (guard_id, guard_name, input_text, output_text, validation_passed, error_message, llm_model, llm_provider, user_id, created_at)
         VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, NOW())`,
        [activeGuard.id, activeGuard.display_name || activeGuard.name,
         extractInputText(req.body).substring(0, 5000), null,
         errMsg, requestModel, activeEndpoint.provider, req.user?.id]
      );
      return res.status(502).json({ error: 'Upstream request failed', code: 'UPSTREAM_FAILED', message: errMsg });
    }
    clearTimeout(timeout);

    const responseText = await providerResp.text();

    // Handle upstream errors
    if (!providerResp.ok) {
      await client.query(
        `INSERT INTO validation_logs (guard_id, guard_name, input_text, output_text, validation_passed, error_message, llm_model, llm_provider, user_id, created_at)
         VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, NOW())`,
        [activeGuard.id, activeGuard.display_name || activeGuard.name,
         extractInputText(req.body).substring(0, 5000), null,
         `Upstream ${providerResp.status}: ${responseText.substring(0, 1000)}`,
         requestModel, activeEndpoint.provider, req.user?.id]
      );
      try {
        return res.status(providerResp.status).json(JSON.parse(responseText));
      } catch {
        return res.status(providerResp.status).json({ error: 'Upstream API error', status: providerResp.status });
      }
    }

    // 5. Parse and normalize response to OpenAI format
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ error: 'Invalid upstream response', code: 'PARSE_ERROR' });
    }

    // Always use OpenAI response format (upstream endpoint is OpenAI-compatible)
    const openaiResponse = responseBody;

    // 6. Run ALL gateway guards' validators on the response
    const extractedText = extractResponseText(openaiResponse);
    const inputText = extractInputText(req.body);
    const allResults = [];

    for (const guard of guardsRes.rows) {
      const guardValidators = await client.query(
        `SELECT v.* FROM validators v
         JOIN guard_validators gv ON v.id = gv.validator_id
         WHERE gv.guard_id = $1 AND v.is_active = true AND v.is_installed = true`,
        [guard.id]
      );

      const guardResults = [];
      let guardPassed = true;
      for (const v of guardValidators.rows) {
        const r = executeValidator(v, extractedText);
        guardResults.push({
          validator_id: v.id,
          validator_name: v.display_name || v.name,
          passed: r.passed,
          message: r.message,
          issues: r.issues || [],
        });
        if (!r.passed) guardPassed = false;
      }

      allResults.push({
        guard_id: guard.id,
        guard_name: guard.display_name || guard.name,
        passed: guardPassed,
        results: guardResults,
      });

      await client.query(
        `INSERT INTO validation_logs (guard_id, guard_name, input_text, output_text, validation_passed, validator_results, total_checks, checks_passed, checks_failed, llm_model, llm_provider, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [guard.id, guard.display_name || guard.name,
         inputText.substring(0, 5000),
         extractedText.substring(0, 5000),
         guardPassed,
         JSON.stringify(guardResults), guardResults.length,
         guardResults.filter(r => r.passed).length,
         guardResults.filter(r => !r.passed).length,
         requestModel, activeEndpoint.provider, req.user?.id]
      );
    }

    // 7. Check if all guards passed
    const allPassed = allResults.every(g => g.passed);
    const firstFailedGuard = allResults.find(g => !g.passed);

    if (!allPassed) {
      const failGuard = guardsRes.rows.find(g => g.id === firstFailedGuard.guard_id);
      const failAction = failGuard?.on_fail_action || 'filter';

      if (failAction === 'filter' || failAction === 'exception') {
        return res.status(422).json({
          error: 'Gateway validation failed',
          code: 'GATEWAY_BLOCKED',
          guard: firstFailedGuard.guard_name,
          gateway_results: allResults,
        });
      }

      if (failAction === 'redact' || failAction === 'fix') {
        const redacted = redactText(extractedText, allResults.flatMap(g => g.results));
        if (openaiResponse.choices?.length > 0 && openaiResponse.choices[0].message) {
          openaiResponse.choices[0].message.content = redacted;
        }
        return res.json(openaiResponse);
      }
    }

    // All passed — return the AI response
    res.json(openaiResponse);

  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

module.exports = gatewayController;
