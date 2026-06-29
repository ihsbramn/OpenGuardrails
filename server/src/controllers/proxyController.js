const db = require('../config/database');
const { AppError } = require('../utils/errors');

/**
 * OpenGuardrails Proxy Controller
 *
 * Acts as a transparent proxy between AI clients and AI providers.
 * Validates every response through the configured guard before returning.
 *
 * Usage: Point your AI tools to http://guardrails:3000/api/proxy/v1/chat/completions
 *        instead of https://api.openai.com/v1/chat/completions
 */

/**
 * Run all validators attached to a guard against the given text.
 * Returns structured results.
 */
async function runGuardValidators(client, guardId, guard, text) {
  const guardValidators = await client.query(
    `SELECT v.* FROM validators v
     JOIN guard_validators gv ON v.id = gv.validator_id
     WHERE gv.guard_id = $1 AND v.is_active = true AND v.is_installed = true`,
    [guardId]
  );

  const results = [];
  let passed = true;

  for (const v of guardValidators.rows) {
    const result = executeValidator(v, text);
    results.push({
      validator_id: v.id,
      validator_name: v.display_name || v.name,
      passed: result.passed,
      message: result.message,
      score: result.score,
      issues: result.issues || [],
    });
    if (!result.passed) passed = false;
  }

  return { passed, results };
}

/**
 * Execute a single validator against text.
 */
function executeValidator(v, text) {
  try {
    switch (v.validation_type) {
      case 'regex': {
        if (!v.validation_code) return { passed: true, message: 'No pattern configured' };
        const match = v.validation_code.match(/^\/(.+)\/([gimsu]*)$/);
        if (!match) return { passed: true, message: 'Invalid regex format' };
        const re = new RegExp(match[1], match[2]);
        const matches = text.match(re);
        if (matches) {
          return {
            passed: false,
            message: `Matched prohibited pattern: ${match[0]}`,
            score: 0,
            issues: matches.slice(0, 5),
          };
        }
        return { passed: true, message: 'No pattern match', score: 1 };
      }

      case 'keyword': {
        if (!v.validation_code) return { passed: true, message: 'No keywords configured' };
        const keywords = v.validation_code.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const lower = text.toLowerCase();
        const found = keywords.filter(k => lower.includes(k));
        if (found.length) {
          return {
            passed: false,
            message: `Matched keywords: ${found.join(', ')}`,
            score: 0,
            issues: found,
          };
        }
        return { passed: true, message: 'No keyword match', score: 1 };
      }

      case 'length': {
        if (!v.validation_code) return { passed: true, message: 'No length config' };
        const cfg = JSON.parse(v.validation_code);
        if (cfg.min && text.length < cfg.min) {
          return { passed: false, message: `Text too short (${text.length} < ${cfg.min})`, score: 0 };
        }
        if (cfg.max && text.length > cfg.max) {
          return { passed: false, message: `Text too long (${text.length} > ${cfg.max})`, score: 0 };
        }
        return { passed: true, message: `Length OK (${text.length})`, score: 1 };
      }

      case 'script': {
        if (!v.validation_code) return { passed: true, message: 'No script configured' };
        const fn = new Function('text', 'params', v.validation_code);
        return fn(text, v.parameters || {});
      }

      default:
        return { passed: true, message: `Validator type '${v.validation_type}' not implemented in proxy`, score: 1 };
    }
  } catch (err) {
    return {
      passed: false,
      message: `Validator error: ${err.message}`,
      score: 0,
      issues: [err.message],
    };
  }
}

/**
 * Extract text content from an OpenAI-compatible chat completion response.
 */
function extractResponseText(responseBody) {
  if (responseBody.choices && Array.isArray(responseBody.choices)) {
    return responseBody.choices
      .map(c => c.message?.content || c.text || '')
      .join('\n');
  }
  if (typeof responseBody.content === 'string') return responseBody.content;
  if (typeof responseBody.text === 'string') return responseBody.text;
  return JSON.stringify(responseBody);
}

/**
 * Apply redaction to text based on validator results.
 */
function redactText(text, results) {
  let out = text;
  for (const r of results) {
    if (!r.passed && r.issues) {
      for (const issue of r.issues) {
        if (typeof issue === 'string') {
          out = out.replaceAll(issue, '█'.repeat(issue.length));
        }
      }
    }
  }
  return out;
}

const proxyController = {
  /**
   * POST /api/proxy/v1/chat/completions
   * OpenAI-compatible chat completions proxy.
   *
   * Query params / Headers:
   *   guard_id    — (required) UUID of the guard to apply
   *   endpoint_id — (optional) UUID of the AI endpoint; defaults to guard.endpoint_id
   */
  async chatCompletions(req, res, next) {
    const client = await db.pool.connect();
    try {
      const guardId = req.query.guard_id || req.headers['x-guard-id'];
      if (!guardId) {
        return res.status(400).json({
          error: 'guard_id is required. Pass via ?guard_id= query parameter or X-Guard-ID header.',
          code: 'MISSING_GUARD_ID',
        });
      }

      // Resolve guard
      const guardRes = await client.query('SELECT * FROM guards WHERE id = $1 AND is_active = true', [guardId]);
      if (guardRes.rows.length === 0) {
        return res.status(404).json({ error: 'Guard not found or inactive', code: 'GUARD_NOT_FOUND' });
      }
      const guard = guardRes.rows[0];

      // Resolve endpoint
      const endpointId = req.query.endpoint_id || guard.endpoint_id;
      if (!endpointId) {
        return res.status(400).json({
          error: 'No AI endpoint configured for this guard. Set endpoint_id on the guard or pass ?endpoint_id=.',
          code: 'NO_ENDPOINT',
        });
      }

      const epRes = await client.query('SELECT * FROM ai_endpoints WHERE id = $1 AND is_active = true', [endpointId]);
      if (epRes.rows.length === 0) {
        return res.status(404).json({ error: 'Endpoint not found or inactive', code: 'ENDPOINT_NOT_FOUND' });
      }
      const endpoint = epRes.rows[0];

      // Build the target URL
      const normalizedBase = endpoint.base_url.replace(/\/+$/, '');
      const targetUrl = `${normalizedBase}/chat/completions`;

      // Forward the request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      let providerResp;
      try {
        const forwardHeaders = {
          'Content-Type': 'application/json',
        };
        if (endpoint.api_key_encrypted) {
          forwardHeaders['Authorization'] = `Bearer ${endpoint.api_key_encrypted}`;
        }
        // Pass through custom headers stored on the endpoint
        const endpointHeaders = endpoint.headers || {};
        Object.assign(forwardHeaders, endpointHeaders);

        providerResp = await fetch(targetUrl, {
          method: 'POST',
          headers: forwardHeaders,
          body: JSON.stringify(req.body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      // Read the response
      const responseText = await providerResp.text();

      // If the AI provider returned an error, pass it through
      if (!providerResp.ok) {
        // Log the failed proxy attempt
        await client.query(
          `INSERT INTO validation_logs (guard_id, input_text, validation_passed, validator_results, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [guardId, JSON.stringify(req.body).substring(0, 5000), false,
           JSON.stringify([]),
           `Upstream API returned HTTP ${providerResp.status}: ${responseText.substring(0, 1000)}`]
        );

        // Try to parse as JSON; return as-is if possible
        try {
          const errJson = JSON.parse(responseText);
          return res.status(providerResp.status).json(errJson);
        } catch {
          return res.status(providerResp.status).json({
            error: 'Upstream API error',
            status: providerResp.status,
            detail: responseText.substring(0, 1000),
          });
        }
      }

      // Parse successful response
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        return res.status(502).json({
          error: 'Invalid response from AI provider (not JSON)',
          code: 'PROXY_PARSE_ERROR',
        });
      }

      // Extract text content from the response
      const extractedText = extractResponseText(responseBody);

      // Run validators
      const { passed, results } = await runGuardValidators(client, guardId, guard, extractedText);

      // Log the validation
      await client.query(
        `INSERT INTO validation_logs (guard_id, input_text, validation_passed, validator_results, total_checks, checks_passed, checks_failed, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [guardId, extractedText.substring(0, 5000),
         passed,
         JSON.stringify(results),
         results.length,
         results.filter(r => r.passed).length,
         results.filter(r => !r.passed).length,
         req.user.id]
      );

      // Handle fail actions
      if (!passed) {
        switch (guard.on_fail_action) {
          case 'exception':
          case 'filter':
            return res.status(422).json({
              error: 'Guard validation failed',
              code: 'GUARD_FAILED',
              guard: guard.display_name || guard.name,
              action: guard.on_fail_action,
              results,
            });

          case 'redact':
          case 'fix': {
            const redacted = redactText(extractedText, results);
            // Reconstruct response with redacted text
            if (responseBody.choices && Array.isArray(responseBody.choices)) {
              const redactedBody = { ...responseBody };
              redactedBody.choices = responseBody.choices.map((c, i) => {
                const lines = extractedText.split('\n');
                const choiceText = c.message?.content || c.text || '';
                // Redact the specific choice text
                const redactedChoice = redactText(choiceText, results);
                if (c.message) {
                  return { ...c, message: { ...c.message, content: redactedChoice } };
                }
                return { ...c, text: redactedChoice };
              });
              return res.json(redactedBody);
            }
            return res.json(responseBody);
          }

          case 'noop':
          case 'log':
            // Pass through with a warning header
            res.set('X-Guardrails-Warning', `Validation issues found: ${results.filter(r => !r.passed).map(r => r.message).join('; ')}`);
            return res.json(responseBody);

          default:
            return res.json(responseBody);
        }
      }

      // Passed — return the AI response as-is
      res.json(responseBody);

    } catch (err) {
      // Log proxy failure
      try {
        await client.query(
          `INSERT INTO validation_logs (guard_id, input_text, validation_passed, error_message, created_at)
           VALUES ($1, $2, false, $3, NOW())`,
          [req.query.guard_id || 'unknown', JSON.stringify(req.body).substring(0, 5000),
           err.message]
        );
      } catch { /* best-effort logging */ }
      next(err);
    } finally {
      client.release();
    }
  },
};

module.exports = proxyController;
