<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Validation Logs</h2>
        <div class="page-subtitle">Detailed input/output and validator results for every validation</div>
      </div>
      <button class="btn btn-secondary" @click="load">🔄 Refresh</button>
    </div>

    <div class="page-body">
      <!-- Stats -->
      <div class="stat-grid" v-if="logStats">
        <div class="card stat-card stat-blue">
          <div class="stat-value">{{ logStats.overall?.total_validations || 0 }}</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="card stat-card stat-green">
          <div class="stat-value">{{ logStats.overall?.failed || 0 }}</div>
          <div class="stat-label">Threats Blocked</div>
        </div>
        <div class="card stat-card stat-neutral">
          <div class="stat-value">{{ logStats.overall?.passed || 0 }}</div>
          <div class="stat-label">Allowed Through</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ logStats.overall?.avg_latency_ms || 0 }}ms</div>
          <div class="stat-label">Avg Latency</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <select v-model="filterPassed" class="form-select" @change="load">
          <option value="">All Requests</option>
          <option value="false">Blocked (threats detected)</option>
          <option value="true">Allowed (clean)</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <!-- Log rows -->
      <div v-if="!loading && logs.length" class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-row" :class="{ 'log-expanded': expandedId === log.id }">
          <!-- Summary row -->
          <div class="log-summary" @click="expandedId = expandedId === log.id ? null : log.id">
            <div class="log-summary-left">
              <span class="log-chevron">{{ expandedId === log.id ? '▼' : '▶' }}</span>
              <span :class="['badge', !log.validation_passed ? 'badge-blocked' : 'badge-allowed']" style="font-size:11px">
                {{ log.validation_passed ? 'ALLOWED' : 'BLOCKED' }}
              </span>
              <strong style="margin-left:8px">{{ log.guard_name || '—' }}</strong>
              <span v-if="log.llm_model" class="badge-bare">{{ log.llm_provider }}/{{ log.llm_model }}</span>
            </div>
            <div class="log-summary-right">
              <span v-if="!log.validation_passed && log.error_message" class="log-error-badge" :title="log.error_message">⚠️ Error</span>
              <span style="font-size:12px;color:var(--color-text-dim)">{{ log.total_checks - log.checks_passed }}/{{ log.total_checks }} blocked</span>
              <span style="font-size:12px;color:var(--color-text-dim);margin-left:12px">{{ log.latency_ms }}ms</span>
              <span style="font-size:11px;color:var(--color-text-dim);margin-left:12px">{{ log.user_name || 'System' }}</span>
              <span style="font-size:11px;color:var(--color-text-dim);margin-left:12px">{{ formatDate(log.created_at) }}</span>
            </div>
          </div>

          <!-- Expanded detail -->
          <div v-if="expandedId === log.id" class="log-detail">
            <!-- Input -->
            <div v-if="log.input_text" class="log-section">
              <div class="log-section-label">📥 Input (User Prompt)</div>
              <pre class="log-code">{{ log.input_text }}</pre>
            </div>

            <!-- Output -->
            <div v-if="log.output_text" class="log-section">
              <div class="log-section-label">
                📤 Output (AI Response)
                <span v-if="!log.validation_passed" style="color:var(--color-success);font-size:11px;margin-left:8px">— guardrail blocked response</span>
              </div>
              <pre class="log-code">{{ log.output_text }}</pre>
            </div>

            <!-- Error message -->
            <div v-if="log.error_message" class="log-section log-section-error">
              <div class="log-section-label">⚠️ Error</div>
              <pre class="log-code log-code-error">{{ log.error_message }}</pre>
            </div>

            <!-- Validator results -->
            <div v-if="log.validator_results && log.validator_results.length" class="log-section">
              <div class="log-section-label">🔍 Validator Results ({{ log.total_checks - log.checks_passed }}/{{ log.total_checks }} triggered)</div>
              <div class="validator-results-grid">
                <div v-for="vr in (Array.isArray(log.validator_results) ? log.validator_results : [])" :key="vr.validator_name"
                     :class="['validator-card', vr.passed ? 'vr-clean' : 'vr-blocked']">
                  <div class="vr-header">
                    <span :class="['badge', !vr.passed ? 'badge-blocked' : 'badge-allowed']" style="font-size:10px">
                      {{ vr.passed ? 'CLEAN' : 'BLOCKED' }}
                    </span>
                    <strong style="font-size:13px;margin-left:6px">{{ vr.validator_name }}</strong>
                  </div>
                  <div v-if="vr.message" style="font-size:12px;color:var(--color-text-dim);margin-top:4px">{{ vr.message }}</div>
                  <div v-if="vr.issues && vr.issues.length" class="vr-issues">
                    <div class="vr-issues-label">Detected:</div>
                    <code v-for="(issue, i) in vr.issues" :key="i" class="vr-issue-badge">{{ issue }}</code>
                  </div>
                </div>
              </div>
            </div>

            <!-- Metadata -->
            <div class="log-section" style="display:flex;gap:24px;font-size:12px;color:var(--color-text-dim);padding-top:12px;border-top:1px solid var(--color-border)">
              <div><strong>Model:</strong> {{ log.llm_provider || '—' }} / {{ log.llm_model || '—' }}</div>
              <div><strong>Latency:</strong> {{ log.latency_ms || '—' }}ms</div>
              <div><strong>Guard ID:</strong> <code style="font-size:11px">{{ log.guard_id }}</code></div>
              <div><strong>Log ID:</strong> <code style="font-size:11px">{{ log.id }}</code></div>
              <div><strong>User:</strong> {{ log.user_name || 'System' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && !logs.length" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No Validation Logs</h3>
        <p>Run validations through your guards to see results here.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api';

const logs = ref([]);
const logStats = ref(null);
const loading = ref(true);
const filterPassed = ref('');
const expandedId = ref(null);

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '100' });
    if (filterPassed.value) params.set('passed', filterPassed.value);
    const { data } = await api.get(`/logs?${params.toString()}`);
    const items = data.data || data;
    // Parse validator_results JSON if it's a string
    logs.value = items.map(l => ({
      ...l,
      validator_results: typeof l.validator_results === 'string' ? safeParse(l.validator_results) : l.validator_results,
    }));
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const { data } = await api.get('/logs/stats');
    logStats.value = data;
  } catch (err) {
    console.error(err);
  }
}

function safeParse(v) {
  try { return JSON.parse(v); } catch { return []; }
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

onMounted(async () => {
  await Promise.all([load(), loadStats()]);
});
</script>

<style scoped>
.log-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.log-row {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  overflow: hidden;
}
.log-row.log-expanded {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}
.log-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.log-summary:hover { background: var(--color-bg); }
.log-summary-left, .log-summary-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.log-chevron {
  font-size: 10px;
  color: var(--color-text-dim);
  width: 14px;
  text-align: center;
}
.badge-bare {
  font-size: 11px;
  color: var(--color-text-dim);
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: monospace;
}
.log-error-badge {
  font-size: 11px;
  background: rgba(255, 180, 50, 0.15);
  color: #ffb432;
  padding: 2px 8px;
  border-radius: 4px;
}
.log-detail {
  padding: 14px 18px 18px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.log-section { }
.log-section-error {
  background: rgba(255, 80, 80, 0.08);
  border: 1px solid rgba(255, 80, 80, 0.2);
  border-radius: 6px;
  padding: 12px;
}
.log-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.log-code {
  background: #1a1a2e;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.5;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #e0e0e0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}
.log-code-error {
  color: #ff8080;
  border-color: rgba(255, 80, 80, 0.3);
}
.validator-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}
.validator-card {
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid;
}
.vr-clean {
  background: rgba(128, 128, 128, 0.04);
  border-color: rgba(128, 128, 128, 0.15);
}
.vr-blocked {
  background: rgba(52, 199, 89, 0.06);
  border-color: rgba(52, 199, 89, 0.25);
}
.vr-header {
  display: flex;
  align-items: center;
}
.vr-issues {
  margin-top: 8px;
}
.vr-issues-label {
  font-size: 11px;
  color: var(--color-error);
  margin-bottom: 4px;
}
.vr-issue-badge {
  display: inline-block;
  background: rgba(255, 69, 58, 0.12);
  color: var(--color-error);
  font-size: 11px;
  font-family: monospace;
  padding: 2px 8px;
  border-radius: 4px;
  margin: 2px 4px 2px 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
