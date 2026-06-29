<template>
  <div>
    <div class="page-header">
      <div>
        <h2>AI Endpoints</h2>
        <div class="page-subtitle">Manage OpenAI and Anthropic compatible API endpoints</div>
      </div>
      <button v-if="auth.isAdmin" class="btn btn-primary" @click="showCreate = true">+ Add Endpoint</button>
    </div>

    <div class="page-body">
      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <table class="data-table" v-if="!loading && endpoints.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Base URL</th>
            <th>Default Model</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ep in endpoints" :key="ep.id">
            <td><strong>{{ ep.name }}</strong></td>
            <td>
              <span :class="['badge', ep.provider === 'openai' ? 'badge-info' : 'badge-success']">
                {{ ep.provider }}
              </span>
            </td>
            <td style="font-family:monospace;font-size:13px">{{ ep.base_url }}</td>
            <td>{{ ep.default_model || '-' }}</td>
            <td>
              <span :class="['badge', ep.is_active ? 'badge-success' : 'badge-default']">
                {{ ep.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn-secondary btn-sm" @click="editEndpoint(ep)">Edit</button>
                <button class="btn btn-secondary btn-sm" :disabled="testingEpId === ep.id" @click="testEndpoint(ep)">
                  {{ testingEpId === ep.id ? 'Testing...' : 'Test' }}
                </button>
                <button v-if="auth.isAdmin" class="btn btn-danger btn-sm" @click="deleteEndpoint(ep)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !endpoints.length" class="empty-state">
        <div class="empty-icon">🔌</div>
        <h3>No Endpoints Configured</h3>
        <p>Add an OpenAI or Anthropic compatible endpoint to get started.</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showCreate || editingEndpoint" @click.self="closeModal">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>{{ editingEndpoint ? 'Edit Endpoint' : 'Add New Endpoint' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="saveEndpoint">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input v-model="form.name" class="form-input" placeholder="e.g., Default OpenAI" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Provider *</label>
              <select v-model="form.provider" class="form-select" required>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai_compatible">OpenAI Compatible</option>
                <option value="anthropic_compatible">Anthropic Compatible</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Default Model</label>
              <input v-model="form.default_model" class="form-input" placeholder="e.g., gpt-4o" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Base URL *</label>
            <div style="display:flex;gap:8px">
              <input v-model="form.base_url" class="form-input" placeholder="https://api.openai.com/v1" required style="flex:1" />
              <button type="button" class="btn btn-secondary" @click="testModels" :disabled="testingModels">
                {{ testingModels ? 'Testing...' : '🧪 Test Models' }}
              </button>
            </div>
            <div v-if="testResult !== null" :class="['test-result', testResult.success ? 'test-success' : 'test-error']">
              <div class="test-result-header">
                <strong>{{ testResult.success ? '✅' : '❌' }} {{ testResult.message }}</strong>
                <button class="modal-close" style="font-size:16px" @click="testResult = null">&times;</button>
              </div>
              <div v-if="testResult.models?.length" class="test-models-list">
                <div v-for="m in testResult.models" :key="m.id" class="test-model-item">
                  <span class="model-id" @click="quickSelect(m.id)">{{ m.id }}</span>
                  <span v-if="m.owned_by" class="model-owner">{{ m.owned_by }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input v-model="form.api_key" type="password" class="form-input" :placeholder="editingEndpoint ? '(leave empty to keep current)' : 'sk-...'" />
          </div>
          <div class="form-group">
            <label class="form-label">Available Models (JSON array)</label>
            <input v-model="form.available_models" class="form-input" placeholder='["gpt-4o","gpt-3.5-turbo"]' />
          </div>
          <div class="form-group">
            <label class="form-label">Active</label>
            <label class="toggle">
              <input type="checkbox" v-model="form.is_active" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Endpoint' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <!-- Test Result Modal -->
    <div class="modal-overlay" v-if="listTestResult !== null" @click.self="listTestResult = null">
      <div class="modal slide-up" style="max-width:520px">
        <div class="modal-header">
          <h3>Test: {{ listTestResult.endpoint || listTestResult.base_url }}</h3>
          <button class="modal-close" @click="listTestResult = null">&times;</button>
        </div>
        <div :class="['test-result', listTestResult.success ? 'test-success' : 'test-error']" style="border-radius:0">
          <div class="test-result-header">
            <strong>{{ listTestResult.success ? '✅' : '❌' }} {{ listTestResult.message }}</strong>
            <span v-if="listTestResult.models_count" class="badge" :class="listTestResult.success ? 'badge-success' : 'badge-default'">
              {{ listTestResult.models_count }} model(s)
            </span>
          </div>
          <div v-if="listTestResult.models?.length" class="test-models-list" style="max-height:300px">
            <div v-for="m in listTestResult.models" :key="m.id" class="test-model-item">
              <span class="model-id" style="cursor:default">{{ m.id }}</span>
              <span v-if="m.owned_by" class="model-owner">{{ m.owned_by }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="listTestResult = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const endpoints = ref([]);
const loading = ref(true);
const saving = ref(false);
const showCreate = ref(false);
const editingEndpoint = ref(null);
const testingModels = ref(false);
const testResult = ref(null);
const testingEpId = ref(null);
const listTestResult = ref(null);
const form = ref({ name: '', provider: 'openai', base_url: '', api_key: '', default_model: '', available_models: '[]', is_active: true });

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/endpoints');
    endpoints.value = data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.value = { name: '', provider: 'openai', base_url: '', api_key: '', default_model: '', available_models: '[]', is_active: true };
}

function closeModal() {
  showCreate.value = false;
  editingEndpoint.value = null;
  testResult.value = null;
  resetForm();
}

function editEndpoint(ep) {
  editingEndpoint.value = ep;
  form.value = {
    name: ep.name,
    provider: ep.provider,
    base_url: ep.base_url,
    api_key: '',
    default_model: ep.default_model || '',
    available_models: JSON.stringify(ep.available_models || []),
    is_active: ep.is_active,
  };
}

async function saveEndpoint() {
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      available_models: JSON.parse(form.value.available_models || '[]'),
    };
    if (editingEndpoint.value) {
      await api.put(`/endpoints/${editingEndpoint.value.id}`, payload);
    } else {
      await api.post('/endpoints', payload);
    }
    closeModal();
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed');
  } finally {
    saving.value = false;
  }
}

async function testEndpoint(ep) {
  testingEpId.value = ep.id;
  listTestResult.value = null;
  try {
    const { data } = await api.post(`/endpoints/${ep.id}/test`);
    listTestResult.value = data;
  } catch (err) {
    listTestResult.value = {
      success: false,
      endpoint: ep.name,
      message: err.response?.data?.error || err.message || 'Test failed',
      models: [],
      models_count: 0,
    };
  } finally {
    testingEpId.value = null;
  }
}

async function deleteEndpoint(ep) {
  if (!confirm(`Delete endpoint "${ep.name}"?`)) return;
  try {
    await api.delete(`/endpoints/${ep.id}`);
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Delete failed');
  }
}

async function testModels() {
  if (!form.value.base_url) {
    alert('Enter a Base URL first');
    return;
  }
  testingModels.value = true;
  testResult.value = null;
  try {
    const { data } = await api.post('/endpoints/test-models', {
      base_url: form.value.base_url,
      api_key: form.value.api_key,
    });
    testResult.value = data;
  } catch (err) {
    testResult.value = {
      success: false,
      message: err.response?.data?.error || err.message || 'Test failed',
      models: [],
    };
  } finally {
    testingModels.value = false;
  }
}

function quickSelect(modelId) {
  // Add model to available_models array
  try {
    const models = JSON.parse(form.value.available_models || '[]');
    if (!models.includes(modelId)) {
      models.push(modelId);
      form.value.available_models = JSON.stringify(models);
    }
  } catch {
    form.value.available_models = JSON.stringify([modelId]);
  }
  // Also set as default model if empty
  if (!form.value.default_model) {
    form.value.default_model = modelId;
  }
}

onMounted(load);
</script>
