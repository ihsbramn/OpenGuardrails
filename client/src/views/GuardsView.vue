<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Guards</h2>
        <div class="page-subtitle">Create and manage validation guards combining multiple validators</div>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">+ Create Guard</button>
    </div>

    <div class="page-body">
      <!-- Stats -->
      <div class="stat-grid" style="margin-bottom:16px" v-if="stats">
        <div class="card stat-card stat-blue">
          <div class="stat-value">{{ stats.total_guards }}</div>
          <div class="stat-label">Total Guards</div>
        </div>
        <div class="card stat-card stat-green">
          <div class="stat-value">{{ stats.active_guards }}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ stats.input_guards }}</div>
          <div class="stat-label">Input Guards</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ stats.output_guards }}</div>
          <div class="stat-label">Output Guards</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="form-input" placeholder="Search guards..." @input="debouncedLoad" />
        </div>
        <select v-model="typeFilter" class="form-select" @change="load">
          <option value="">All Types</option>
          <option value="input">Input</option>
          <option value="output">Output</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <div v-if="!loading && guards.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Validators</th>
              <th>On Fail</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in guards" :key="g.id">
              <td>
                <strong>{{ g.display_name || g.name }}</strong>
                <div v-if="g.description" style="font-size:12px;color:var(--color-text-dim)">{{ g.description.substring(0,80) }}{{ g.description.length > 80 ? '...' : '' }}</div>
              </td>
              <td>
                <span :class="['badge', g.guard_type === 'input' ? 'badge-info' : g.guard_type === 'output' ? 'badge-success' : 'badge-warning']">
                  {{ g.guard_type }}
                </span>
              </td>
              <td>{{ g.validator_count || 0 }}</td>
              <td><span class="badge badge-default">{{ g.on_fail_action }}</span></td>
              <td>{{ g.endpoint_name || '-' }}</td>
              <td>
                <span :class="['badge', g.is_active ? 'badge-success' : 'badge-default']">
                  {{ g.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <div class="btn-group">
                  <router-link :to="`/guards/${g.id}`" class="btn btn-primary btn-sm" style="text-decoration:none">View</router-link>
                  <button class="btn btn-secondary btn-sm" @click="editGuard(g)">Edit</button>
                  <button class="btn btn-danger btn-sm" @click="deleteGuard(g)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && !guards.length" class="empty-state">
        <div class="empty-icon">🛡️</div>
        <h3>No Guards Created</h3>
        <p>Create your first guard to start validating LLM inputs and outputs.</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showCreate || editingGuard" @click.self="closeModal">
      <div class="modal slide-up" style="max-width:720px">
        <div class="modal-header">
          <h3>{{ editingGuard ? 'Edit Guard' : 'Create New Guard' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="saveGuard">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Guard Name *</label>
              <input v-model="form.name" class="form-input" placeholder="e.g., toxicity-guard" required />
            </div>
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input v-model="form.display_name" class="form-input" placeholder="Toxicity Guard" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="form.description" class="form-textarea" placeholder="What does this guard validate?"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Guard Type</label>
              <select v-model="form.guard_type" class="form-select">
                <option value="input">Input</option>
                <option value="output">Output</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">On Fail Action</label>
              <select v-model="form.on_fail_action" class="form-select">
                <option value="exception">Exception</option>
                <option value="fix">Fix</option>
                <option value="filter">Filter</option>
                <option value="reask">Reask</option>
                <option value="noop">No-op</option>
                <option value="log">Log Only</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">AI Endpoint</label>
              <select v-model="form.endpoint_id" class="form-select">
                <option value="">None</option>
                <option v-for="ep in endpoints" :key="ep.id" :value="ep.id">{{ ep.name }} ({{ ep.provider }})</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <input v-model="form.model" class="form-input" placeholder="e.g., gpt-4o" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Active</label>
            <label class="toggle">
              <input type="checkbox" v-model="form.is_active" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Select Validators (hold Ctrl/Cmd to select multiple)</label>
            <select v-model="form.validator_ids" class="form-select" multiple style="min-height:150px">
              <option v-for="v in allValidators" :key="v.id" :value="v.id">
                {{ v.display_name }} — {{ v.hub_uri }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Guard' }}
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
const guards = ref([]);
const stats = ref(null);
const endpoints = ref([]);
const allValidators = ref([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const typeFilter = ref('');
const showCreate = ref(false);
const editingGuard = ref(null);

const form = ref({
  name: '', display_name: '', description: '', guard_type: 'output',
  on_fail_action: 'exception', endpoint_id: '', model: '',
  is_active: true, validator_ids: [],
});

let debounceTimer;

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value) params.set('search', search.value);
    if (typeFilter.value) params.set('type', typeFilter.value);
    const { data } = await api.get(`/guards?${params.toString()}`);
    guards.value = data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadMeta() {
  try {
    const [statsRes, epRes, valRes] = await Promise.all([
      api.get('/guards/stats'),
      api.get('/endpoints'),
      api.get('/validators'),
    ]);
    stats.value = statsRes.data;
    endpoints.value = epRes.data;
    allValidators.value = valRes.data;
  } catch (err) {
    console.error(err);
  }
}

function resetForm() {
  form.value = {
    name: '', display_name: '', description: '', guard_type: 'output',
    on_fail_action: 'exception', endpoint_id: '', model: '',
    is_active: true, validator_ids: [],
  };
}

function closeModal() {
  showCreate.value = false;
  editingGuard.value = null;
  resetForm();
}

async function editGuard(g) {
  editingGuard.value = g;
  // Load full guard with validators
  try {
    const { data } = await api.get(`/guards/${g.id}`);
    form.value = {
      name: data.name,
      display_name: data.display_name || '',
      description: data.description || '',
      guard_type: data.guard_type,
      on_fail_action: data.on_fail_action,
      endpoint_id: data.endpoint_id || '',
      model: data.model || '',
      is_active: data.is_active,
      validator_ids: (data.validators || []).map(v => v.validator_id),
    };
  } catch (err) {
    console.error(err);
  }
}

async function saveGuard() {
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      validators: form.value.validator_ids.map(id => ({
        validator_id: id,
        on_fail_action: form.value.on_fail_action,
      })),
      validator_ids: undefined,
    };

    if (editingGuard.value) {
      await api.put(`/guards/${editingGuard.value.id}`, payload);
    } else {
      await api.post('/guards', payload);
    }
    closeModal();
    await Promise.all([load(), loadMeta()]);
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed');
  } finally {
    saving.value = false;
  }
}

async function deleteGuard(g) {
  if (!confirm(`Delete guard "${g.name}"?`)) return;
  try {
    await api.delete(`/guards/${g.id}`);
    await Promise.all([load(), loadMeta()]);
  } catch (err) {
    alert(err.response?.data?.error || 'Delete failed');
  }
}

onMounted(async () => {
  await Promise.all([load(), loadMeta()]);
});
</script>
