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
      <!-- Server Status -->
      <div class="card" style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 class="section-title" style="margin-bottom:4px">Server Status</h3>
            <div style="font-size:13px;color:var(--color-text-dim)">
              {{ status?.running ? `Running on ${status.config?.host}:${status.config?.port}` : 'No active configuration' }}
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

      <!-- Config List -->
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
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const configs = ref([]);
const status = ref(null);
const loading = ref(true);
const saving = ref(false);
const showCreate = ref(false);
const editingConfig = ref(null);

const form = ref({
  name: '', host: '0.0.0.0', port: 8000, log_level: 'info',
  max_request_size_mb: 10, request_timeout_seconds: 30,
  is_ssl: false, enable_cors: false, is_active: false,
});

async function load() {
  loading.value = true;
  try {
    const [cfgRes, statusRes] = await Promise.all([
      api.get('/server-configs'),
      api.get('/server-configs/status'),
    ]);
    configs.value = cfgRes.data;
    status.value = statusRes.data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
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

onMounted(load);
</script>
