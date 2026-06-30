<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Server Configuration</h2>
        <div class="page-subtitle">Manage your Guardrails server deployment settings</div>
      </div>
      <button v-if="auth.isAdmin" class="btn btn-primary" @click="showCreate = true">+ New Config</button>
    </div>

    <div class="page-body">
      <!-- Getting Started Guide -->
      <div class="card" style="margin-bottom:24px">
        <div class="guide-header" @click="showGuide = !showGuide" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:15px">🚀 How It Works — Proxy Mode</strong>
            <span style="font-size:12px;color:var(--color-text-dim);margin-left:8px">— click to {{ showGuide ? 'collapse' : 'expand' }}</span>
          </div>
          <span style="font-size:18px;color:var(--color-text-dim);transition:transform 0.2s" :style="{transform: showGuide ? 'rotate(180deg)' : ''}">▼</span>
        </div>
        <div v-if="showGuide" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border)">

          <!-- Concept -->
          <div style="padding:14px;background:var(--color-bg);border-radius:8px;margin-bottom:16px">
            <p style="font-size:14px;color:var(--color-text);margin-bottom:8px;line-height:1.6">
              <strong>OpenGuardrails acts as a transparent proxy</strong> between your AI tools and your AI provider.
              Instead of calling <code>https://api.openai.com/v1</code> directly, your app calls <code>http://guardrails:3000/api/proxy/v1</code>.
              Every response is automatically validated through your guards before reaching the user.
            </p>
            <div style="font-family:monospace;font-size:13px;color:var(--color-text-dim);text-align:center;line-height:1.8">
              Your App &nbsp;&rarr;&nbsp; <span style="color:var(--color-primary)">OpenGuardrails Proxy</span> &nbsp;&rarr;&nbsp; AI Provider (OpenAI/Anthropic/DeepSeek)<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&darr;<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Response validated against <span style="color:var(--color-warning)">Guards &amp; Validators</span>
            </div>
          </div>

          <!-- Step 1 -->
          <div class="guide-step">
            <div class="guide-step-num">1</div>
            <div class="guide-step-body">
              <strong>Add an AI Endpoint</strong>
              <p>Go to <strong>AI Endpoints</strong> → "+ Add Endpoint". This tells OpenGuardrails which AI provider to forward requests to.</p>
              <pre>Base URL: https://api.openai.com/v1    (or https://api.deepseek.com, https://api.anthropic.com, etc.)
Provider: OpenAI
API Key: sk-...</pre>
              <small>Supports OpenAI, Anthropic, DeepSeek, Ollama, and any OpenAI-compatible API. Click <strong>🧪 Test Models</strong> to verify connectivity.</small>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="guide-step">
            <div class="guide-step-num">2</div>
            <div class="guide-step-body">
              <strong>Install &amp; Configure Validators</strong>
              <p>Go to <strong>Validators</strong> → Hub tab → <strong>Install</strong> the validators you want. Click <strong>✏️ Edit</strong> to customize patterns, keywords, or thresholds.</p>
              <pre>Recommended validators:
• profanity_free  — blocks bad language via regex
• detect_pii      — catches emails, phones, SSNs
• competitor_check — redacts competitor names
• prompt_injection — blocks prompt hijack attempts</pre>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="guide-step">
            <div class="guide-step-num">3</div>
            <div class="guide-step-body">
              <strong>Create a Guard (Proxy Route)</strong>
              <p>Go to <strong>Guards</strong> → "+ New Guard". A Guard binds validators to an endpoint and defines what happens on failure.</p>
              <pre>Guard Name: customer_chat_guard
Guard Type: output
On-Fail Action: filter    (choices: filter=block, redact, log, noop)
Endpoint: your AI endpoint
Validators: profanity_free, detect_pii, competitor_check</pre>
              <small>Each guard has a unique ID. You'll use this ID in the proxy URL to apply that guard's rules.</small>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="guide-step">
            <div class="guide-step-num">4</div>
            <div class="guide-step-body">
              <strong>Point Your AI Tools to the Proxy</strong>
              <p>Change your app's AI endpoint URL from the provider's direct URL to the OpenGuardrails proxy:</p>
              <pre># Before (direct to provider):
https://api.openai.com/v1/chat/completions

# After (through guardrails proxy):
http://your-guardrails:3000/api/proxy/v1/chat/completions?guard_id=YOUR_GUARD_ID</pre>
              <small>The request body stays exactly the same — OpenGuardrails is API-compatible and transparent.</small>
            </div>
          </div>

          <!-- Full curl example -->
          <div style="margin-top:16px;padding:14px;background:var(--color-bg);border-radius:8px">
            <strong style="font-size:14px">🧪 Test It Yourself</strong>
            <pre style="margin-top:8px;font-size:12px"># Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@openguardrails.com","password":"admin123"}' | jq -r .token)

# Send a chat request through the proxy
# (uses Guard ID from the Guards page)
curl -X POST "http://localhost:3000/api/proxy/v1/chat/completions?guard_id=GUARD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"Hello, how are you?"}]
  }'

# ✅ Pass: Response returned as normal OpenAI response
# ❌ Block: 422 error with details of which validator failed</pre>
          </div>

        </div>
      </div>

      <!-- Server Status -->
      <div class="card" style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 class="section-title" style="margin-bottom:4px">Server Status</h3>
            <div style="font-size:13px;color:var(--color-text-dim)">
              {{ status?.running ? `Running on ${status.host}:${status.port}` : 'Server is stopped' }}
            </div>
          </div>
          <span :class="['badge badge-lg', status?.running ? 'badge-success' : 'badge-default']" style="font-size:14px;padding:8px 20px">
            {{ status?.running ? '● Running' : '○ Stopped' }}
          </span>
        </div>
        <div v-if="status" style="margin-top:12px;font-size:13px;color:var(--color-text-dim)">
          Node.js {{ status.node_version }} | Uptime: {{ Math.round(status.uptime_seconds) }}s
        </div>
      </div>

      <!-- Gateway Settings -->
      <div class="card" style="margin-bottom:24px;border-color:var(--color-primary)">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div style="flex:1">
            <h3 class="section-title" style="margin-bottom:2px">🌐 LLM Gateway</h3>
            <div style="font-size:13px;color:var(--color-text-dim);margin-bottom:8px">
              Single unified endpoint — all AI requests pass through selected guards automatically
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <span :class="['badge badge-sm', gatewayOpenAIEnabled ? 'badge-success' : 'badge-default']" style="font-size:12px;padding:4px 10px">
                {{ gatewayOpenAIEnabled ? '●' : '○' }} OpenAI
              </span>
              <span :class="['badge badge-sm', gatewayAnthropicEnabled ? 'badge-success' : 'badge-default']" style="font-size:12px;padding:4px 10px">
                {{ gatewayAnthropicEnabled ? '●' : '○' }} Anthropic
              </span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" @click="showGatewayConfig = !showGatewayConfig">
            {{ showGatewayConfig ? 'Close' : '⚙️ Configure' }}
          </button>
        </div>

        <!-- Gateway URL (always visible) -->
        <div v-if="gatewayEnabled" style="margin-top:14px;padding:12px;background:var(--color-bg);border-radius:8px">
          <div style="font-size:12px;color:var(--color-text-dim);margin-bottom:4px">Gateway Base URL</div>
          <div style="display:flex;align-items:center;gap:8px">
            <code style="font-size:14px;color:var(--color-primary-hover);font-family:monospace">{{ gatewayUrl }}</code>
            <button class="btn btn-xs btn-primary" @click="copyGatewayUrl" style="flex-shrink:0;padding:4px 10px">📋 Copy</button>
          </div>
          <div style="margin-top:4px;font-size:11px;color:var(--color-text-dim)">
            Set <code style="font-size:11px">base_url</code> to this in your OpenAI / Anthropic SDK
          </div>
        </div>

        <!-- Gateway Quick-Start Guide (visible when enabled) -->
        <div v-if="gatewayEnabled" style="margin-top:16px;padding:14px;background:var(--color-bg);border-radius:8px">
          <div class="gw-guide-header" @click="showGwGuide = !showGwGuide" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:14px">📖 How to Use the Gateway {{ showGwGuide ? '' : '— click to expand' }}</strong>
            <span style="font-size:16px;color:var(--color-text-dim);transition:transform 0.2s" :style="{transform: showGwGuide ? 'rotate(180deg)' : ''}">▼</span>
          </div>
          <div v-if="showGwGuide" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border)">

            <p style="font-size:13px;color:var(--color-text-dim);margin-bottom:12px;line-height:1.5">
              Point any OpenAI-compatible client to this URL. OpenGuardrails forwards the request to the
              configured AI provider, runs all selected guards against the response, and only returns it if every validator passes.
            </p>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
              <div style="padding:10px;background:var(--color-success);color:#fff;border-radius:6px;font-size:12px;text-align:center">
                <strong>✅ All pass</strong> — AI response returned as-is
              </div>
              <div style="padding:10px;background:var(--color-error);color:#fff;border-radius:6px;font-size:12px;text-align:center">
                <strong>❌ Any fail</strong> — 422 blocked with details
              </div>
            </div>

            <div class="gw-example">
              <div class="gw-example-label">curl</div>
              <pre><code>curl -X POST "{{ gatewayUrl }}/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'</code></pre>
            </div>

            <div class="gw-example">
              <div class="gw-example-label">Python (OpenAI SDK)</div>
              <pre><code>from openai import OpenAI

client = OpenAI(
    base_url="{{ gatewayUrl }}",
    api_key="YOUR_API_KEY"
)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role":"user","content":"Hello"}]
)
print(response.choices[0].message.content)</code></pre>
            </div>

            <div class="gw-example">
              <div class="gw-example-label">JavaScript (OpenAI SDK)</div>
              <pre><code>import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "{{ gatewayUrl }}",
  apiKey: "YOUR_API_KEY",
});
const resp = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});</code></pre>
            </div>

            <div class="gw-example">
              <div class="gw-example-label">Blocked Response (HTTP 422)</div>
              <pre><code>{
  "error": "Gateway validation failed",
  "code": "GATEWAY_BLOCKED",
  "guard": "Block Hello Guard",
  "gateway_results": [
    {
      "guard_name": "Block Hello Guard",
      "passed": false,
      "results": [
        { "validator_name": "Block Hello", "passed": false, "message": "Matched: hello" }
      ]
    }
  ]
}</code></pre>
            </div>

          </div>
        </div>

        <!-- Gateway Config Panel (expandable) -->
        <div v-if="showGatewayConfig" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px">
            <!-- OpenAI Toggle -->
            <div style="padding:16px;background:var(--color-bg);border-radius:8px;border:1px solid var(--color-border)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:600;font-size:14px">🔵 OpenAI Compatible</div>
                  <div style="font-size:11px;color:var(--color-text-dim);margin-top:2px">/v1/chat/completions</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" v-model="gatewayOpenAIEnabled" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <!-- Anthropic Toggle -->
            <div style="padding:16px;background:var(--color-bg);border-radius:8px;border:1px solid var(--color-border)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:600;font-size:14px">🟠 Anthropic Compatible</div>
                  <div style="font-size:11px;color:var(--color-text-dim);margin-top:2px">/v1/messages</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" v-model="gatewayAnthropicEnabled" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Select Guards (all responses pass through these)</label>
            <select v-model="selectedGuards" class="form-select" multiple style="min-height:140px" :disabled="!gatewayAnyEnabled">
              <option v-for="g in allGuards" :key="g.id" :value="g.id" :disabled="!g.endpoint_id">
                {{ g.display_name || g.name }}
                <template v-if="!g.endpoint_id">— no endpoint configured</template>
                <template v-else>— {{ g.endpoint_name }} ({{ g.guard_type }})</template>
              </option>
            </select>
            <small style="color:var(--color-text-dim);font-size:11px;line-height:1.5">
              Hold Ctrl/Cmd to select multiple. Guards without an AI endpoint are disabled. All selected guards run in parallel — if any blocks, the response is blocked.
            </small>
          </div>
          <div v-if="savingGateway" style="font-size:12px;color:var(--color-text-dim);margin-top:8px">Saving...</div>
          <button class="btn btn-primary" style="margin-top:16px" @click="saveGatewaySettings" :disabled="savingGateway">
            {{ savingGateway ? 'Saving...' : '💾 Save Gateway Configuration' }}
          </button>
        </div>
      </div>
      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <div v-if="!loading && configs.length">
        <div class="grid-2">
          <div v-for="cfg in configs" :key="cfg.id" class="card" :style="{ borderColor: cfg.is_active ? 'var(--color-primary)' : 'var(--color-border)' }">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
              <div>
                <strong>{{ cfg.name }}</strong>
                <div style="font-size:12px;color:var(--color-text-dim);font-family:monospace">{{ cfg.host }}:{{ cfg.port }}</div>
              </div>
              <span :class="['badge', cfg.is_active ? 'badge-success' : 'badge-default']">
                {{ cfg.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
              <div><span style="color:var(--color-text-dim)">SSL:</span> {{ cfg.is_ssl ? 'Yes' : 'No' }}</div>
              <div><span style="color:var(--color-text-dim)">Log Level:</span> {{ cfg.log_level }}</div>
              <div><span style="color:var(--color-text-dim)">Max Request Size:</span> {{ cfg.max_request_size_mb }}MB</div>
              <div><span style="color:var(--color-text-dim)">Timeout:</span> {{ cfg.request_timeout_seconds }}s</div>
              <div><span style="color:var(--color-text-dim)">CORS:</span> {{ cfg.enable_cors ? 'Enabled' : 'Disabled' }}</div>
              <div><span style="color:var(--color-text-dim)">Created:</span> {{ formatDate(cfg.created_at) }}</div>
            </div>
            <div v-if="auth.isAdmin" class="btn-group" style="margin-top:12px">
              <button class="btn btn-primary btn-sm" @click="editConfig(cfg)">Edit</button>
              <button v-if="!cfg.is_active" class="btn btn-danger btn-sm" @click="deleteConfig(cfg)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && !configs.length" class="empty-state">
        <div class="empty-icon">⚙️</div>
        <h3>No Server Configurations</h3>
        <p>Create a server configuration to define how Guardrails will serve requests.</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showCreate || editingConfig" @click.self="closeModal">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>{{ editingConfig ? 'Edit Config' : 'New Server Config' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input v-model="form.name" class="form-input" placeholder="Production Server" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Host</label>
              <input v-model="form.host" class="form-input" placeholder="0.0.0.0" />
            </div>
            <div class="form-group">
              <label class="form-label">Port</label>
              <input v-model.number="form.port" type="number" class="form-input" placeholder="8000" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Log Level</label>
              <select v-model="form.log_level" class="form-select">
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Max Request Size (MB)</label>
              <input v-model.number="form.max_request_size_mb" type="number" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Request Timeout (seconds)</label>
              <input v-model.number="form.request_timeout_seconds" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">SSL</label>
              <label class="toggle" style="display:block;margin-top:8px">
                <input type="checkbox" v-model="form.is_ssl" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Enable CORS</label>
              <label class="toggle" style="display:block;margin-top:8px">
                <input type="checkbox" v-model="form.enable_cors" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Set as Active</label>
              <label class="toggle" style="display:block;margin-top:8px">
                <input type="checkbox" v-model="form.is_active" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Config' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../utils/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const configs = ref([]);
const status = ref(null);
const loading = ref(true);
const saving = ref(false);
const showCreate = ref(false);
const editingConfig = ref(null);
const showGuide = ref(false);
const showGatewayConfig = ref(false);
const showGwGuide = ref(false);
const gatewayOpenAIEnabled = ref(false);
const gatewayAnthropicEnabled = ref(false);
const selectedGuards = ref([]);
const allGuards = ref([]);
const savingGateway = ref(false);
const activeConfigId = ref(null);

const gatewayUrl = ref('http://localhost:3000/v1');

// Derived: gateway is "enabled" if any mode is on
const gatewayEnabled = computed(() => gatewayOpenAIEnabled.value || gatewayAnthropicEnabled.value);
const gatewayAnyEnabled = computed(() => gatewayOpenAIEnabled.value || gatewayAnthropicEnabled.value);

const form = ref({
  name: '', host: '0.0.0.0', port: 8000, log_level: 'info',
  max_request_size_mb: 10, request_timeout_seconds: 30,
  is_ssl: false, enable_cors: false, is_active: false,
});

async function load() {
  loading.value = true;
  try {
    const [cfgRes, statusRes, guardsRes] = await Promise.all([
      api.get('/server-configs'),
      api.get('/server-configs/status'),
      api.get('/guards?limit=500'),
    ]);
    configs.value = cfgRes.data;
    status.value = statusRes.data;
    allGuards.value = Array.isArray(guardsRes.data) ? guardsRes.data : guardsRes.data?.data || [];

    // Sync gateway state from active config
    const active = statusRes.data?.active_config;
    if (active) {
      activeConfigId.value = active.id;
      gatewayOpenAIEnabled.value = active.gateway_openai_enabled || false;
      gatewayAnthropicEnabled.value = active.gateway_anthropic_enabled || false;
      selectedGuards.value = active.gateway_guard_ids || [];
    }

    // Build gateway URL
    const host = window.location.hostname;
    const port = statusRes.data?.port || 3000;
    statusDataPort = port;
    gatewayUrl.value = buildGatewayUrl(host, port);
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function saveGatewaySettings() {
  if (!activeConfigId.value) {
    alert('No active server configuration. Create one first.');
    return;
  }
  savingGateway.value = true;
  try {
    await api.put(`/server-configs/${activeConfigId.value}`, {
      gateway_openai_enabled: gatewayOpenAIEnabled.value,
      gateway_anthropic_enabled: gatewayAnthropicEnabled.value,
      gateway_guard_ids: selectedGuards.value,
    });
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to save gateway settings');
    // Revert
    const { data } = await api.get('/server-configs/status');
    const a = data.active_config;
    if (a) {
      gatewayOpenAIEnabled.value = a.gateway_openai_enabled || false;
      gatewayAnthropicEnabled.value = a.gateway_anthropic_enabled || false;
      selectedGuards.value = a.gateway_guard_ids || [];
    }
  } finally {
    savingGateway.value = false;
  }
}

function copyGatewayUrl() {
  navigator.clipboard.writeText(gatewayUrl.value).then(() => alert('Gateway URL copied!'));
}

function resetForm() {
  form.value = {
    name: '', host: '0.0.0.0', port: 8000, log_level: 'info',
    max_request_size_mb: 10, request_timeout_seconds: 30,
    is_ssl: false, enable_cors: false, is_active: false,
  };
}

function closeModal() {
  showCreate.value = false;
  editingConfig.value = null;
  resetForm();
}

function editConfig(cfg) {
  editingConfig.value = cfg;
  form.value = {
    name: cfg.name, host: cfg.host, port: cfg.port, log_level: cfg.log_level,
    max_request_size_mb: cfg.max_request_size_mb,
    request_timeout_seconds: cfg.request_timeout_seconds,
    is_ssl: cfg.is_ssl, enable_cors: cfg.enable_cors, is_active: cfg.is_active,
  };
}

async function saveConfig() {
  saving.value = true;
  try {
    if (editingConfig.value) {
      await api.put(`/server-configs/${editingConfig.value.id}`, form.value);
    } else {
      await api.post('/server-configs', form.value);
    }
    closeModal();
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed');
  } finally {
    saving.value = false;
  }
}

async function deleteConfig(cfg) {
  if (!confirm(`Delete config "${cfg.name}"?`)) return;
  try {
    await api.delete(`/server-configs/${cfg.id}`);
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Delete failed');
  }
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

function buildGatewayUrl(host, port) {
  return `http://${host}:${port}/v1`;
}

let statusDataPort = 3000;

onMounted(load);
</script>

<style scoped>
.guide-header { padding: 4px 0; user-select: none; }
.guide-header:hover strong { color: var(--color-primary-hover); }

.guide-step {
  display: flex;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}
.guide-step:last-of-type { border-bottom: none; }
.guide-step-num {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.guide-step-body { flex: 1; }
.guide-step-body strong { font-size: 14px; }
.guide-step-body p {
  font-size: 13px;
  color: var(--color-text-dim);
  margin: 4px 0 8px;
  line-height: 1.5;
}
.guide-step-body pre {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 4px;
}
.guide-step-body small {
  font-size: 11px;
  color: var(--color-text-dim);
  line-height: 1.5;
}

/* Gateway guide */
.gw-guide-header { padding: 2px 0; user-select: none; }
.gw-guide-header:hover strong { color: var(--color-primary-hover); }
.gw-example { margin-bottom: 12px; }
.gw-example-label {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.gw-example pre {
  background: #1a1a2e;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.gw-example code {
  color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
</style>
