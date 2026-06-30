<template>
  <div>
    <div class="page-header">
      <div>
        <h2>API Keys</h2>
        <div class="page-subtitle">Manage programmatic access keys for the Guardrails API</div>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">+ Generate Key</button>
    </div>

    <div class="page-body">
      <div v-if="newKey" class="alert alert-success" style="margin-bottom:16px">
        <strong>🔑 New API Key Created!</strong> Copy it now — you won't see it again.
        <div class="code-block" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
          <code>{{ newKey.api_key }}</code>
          <button class="btn btn-primary btn-sm" @click="copyKey">Copy</button>
        </div>
      </div>

      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <table class="data-table" v-if="!loading && keys.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Permissions</th>
            <th>Status</th>
            <th>Last Used</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in keys" :key="key.id">
            <td><strong>{{ key.name }}</strong></td>
            <td style="font-family:monospace;font-size:12px">{{ key.key_prefix }}</td>
            <td>
              <span class="tag" v-for="p in (typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions)" :key="p">{{ p }}</span>
            </td>
            <td>
              <span :class="['badge', key.is_active ? 'badge-success' : 'badge-default']">
                {{ key.is_active ? 'Active' : 'Revoked' }}
              </span>
            </td>
            <td style="font-size:12px;color:var(--color-text-dim)">{{ formatDate(key.last_used_at) || 'Never' }}</td>
            <td style="font-size:12px;color:var(--color-text-dim)">
              {{ key.expires_at ? formatDate(key.expires_at) : 'Never' }}
            </td>
            <td>
              <button v-if="key.is_active" class="btn btn-danger btn-sm" @click="revokeKey(key)">Revoke</button>
              <button v-else class="btn btn-danger btn-sm" @click="deleteKey(key)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !keys.length" class="empty-state">
        <div class="empty-icon">🔑</div>
        <h3>No API Keys</h3>
        <p>Generate an API key for programmatic access.</p>
      </div>
    </div>

    <!-- Generate Key Modal -->
    <div class="modal-overlay" v-if="showCreate" @click.self="showCreate = false">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>Generate New API Key</h3>
          <button class="modal-close" @click="showCreate = false">&times;</button>
        </div>
        <form @submit.prevent="generateKey">
          <div class="form-group">
            <label class="form-label">Key Name *</label>
            <input v-model="form.name" class="form-input" placeholder="e.g., Production Key" required />
          </div>
          <div class="form-group">
            <label class="form-label">Permissions</label>
            <div style="display:flex;gap:8px">
              <label style="display:flex;align-items:center;gap:4px;font-size:14px">
                <input type="checkbox" value="read" v-model="form.permissions" checked /> Read
              </label>
              <label style="display:flex;align-items:center;gap:4px;font-size:14px">
                <input type="checkbox" value="write" v-model="form.permissions" /> Write
              </label>
              <label style="display:flex;align-items:center;gap:4px;font-size:14px">
                <input type="checkbox" value="admin" v-model="form.permissions" /> Admin
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showCreate = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Generating...' : 'Generate Key' }}
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
import { useModal } from '../utils/modals';

const { showNotification, showConfirm } = useModal();

const keys = ref([]);
const loading = ref(true);
const saving = ref(false);
const showCreate = ref(false);
const newKey = ref(null);
const form = ref({ name: '', permissions: ['read'] });

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/api-keys');
    keys.value = data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function generateKey() {
  saving.value = true;
  try {
    const { data } = await api.post('/api-keys', {
      name: form.value.name,
      permissions: form.value.permissions,
    });
    newKey.value = data;
    showCreate.value = false;
    form.value = { name: '', permissions: ['read'] };
    await load();
  } catch (err) {
    await showNotification('Generation Failed', err.response?.data?.error || 'Generation failed', 'error');
  } finally {
    saving.value = false;
  }
}

async function revokeKey(key) {
  const ok = await showConfirm('Revoke API Key', `Revoke API key "${key.name}"? This action can be undone by generating a new key.`, 'Revoke');
  if (!ok) return;
  try {
    await api.post(`/api-keys/${key.id}/revoke`);
    await load();
    await showNotification('Key Revoked', `API key "${key.name}" has been revoked.`, 'success');
  } catch (err) {
    await showNotification('Revoke Failed', err.response?.data?.error || 'Revoke failed', 'error');
  }
}

async function deleteKey(key) {
  const ok = await showConfirm('Delete API Key', `Permanently delete revoked key "${key.name}"? This cannot be undone.`, 'Delete');
  if (!ok) return;
  try {
    await api.delete(`/api-keys/${key.id}`);
    await load();
  } catch (err) {
    await showNotification('Delete Failed', err.response?.data?.help || err.response?.data?.error || 'Delete failed', 'error');
  }
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value.api_key).then(() => {
    showNotification('Copied', 'API key copied to clipboard!', 'success');
  });
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

onMounted(load);
</script>
