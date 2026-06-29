<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Validators</h2>
        <div class="page-subtitle">Browse Guardrails Hub validators or create your own custom checks</div>
      </div>
      <button class="btn btn-primary" @click="openCustomCreate">+ Create Custom</button>
    </div>

    <div class="page-body">
      <!-- Stats -->
      <div class="stat-grid" style="margin-bottom:16px" v-if="stats">
        <div class="card stat-card stat-blue">
          <div class="stat-value">{{ stats.hub_count }}</div>
          <div class="stat-label">Hub Validators</div>
        </div>
        <div class="card stat-card" style="border-left-color:var(--color-warning)">
          <div class="stat-value">{{ stats.custom_count }}</div>
          <div class="stat-label">Custom Validators</div>
        </div>
        <div class="card stat-card stat-green">
          <div class="stat-value">{{ stats.installed }}</div>
          <div class="stat-label">Installed</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ stats.active }}</div>
          <div class="stat-label">Active</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', tab === 'hub' ? 'tab-active' : '']" @click="switchTab('hub')">
          🛡️ Guardrails Hub
          <span class="tab-count">{{ stats?.hub_count || 0 }}</span>
        </button>
        <button :class="['tab', tab === 'custom' ? 'tab-active' : '']" @click="switchTab('custom')">
          ✏️ Custom Validators
          <span class="tab-count">{{ stats?.custom_count || 0 }}</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="form-input" placeholder="Search validators..." @input="debouncedLoad" />
        </div>
        <select v-model="categoryFilter" class="form-select" @change="load">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }} ({{ cat.validator_count }})</option>
        </select>
        <select v-model="installedFilter" class="form-select" @change="load">
          <option value="">All Status</option>
          <option value="true">Installed</option>
          <option value="false">Not Installed</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <!-- === HUB TAB === -->
      <div v-if="tab === 'hub' && !loading">
        <div v-if="!validators.length" class="empty-state">
          <div class="empty-icon">🛡️</div>
          <h3>No Hub Validators Found</h3>
          <p>No validators match your filters.</p>
        </div>

        <div class="grid-2">
          <div v-for="v in validators" :key="v.id" class="card validator-card">
            <div class="val-header">
              <div class="val-title">
                <strong>{{ v.display_name }}</strong>
                <span class="val-uri">{{ v.hub_uri }}</span>
              </div>
              <span :class="['badge', v.is_installed ? 'badge-success' : 'badge-default']">
                {{ v.is_installed ? '✓ Installed' : 'Available' }}
              </span>
            </div>
            <p class="val-desc">{{ v.description || 'No description' }}</p>
            <div class="val-meta">
              <span class="tag" v-if="v.category_name">{{ v.category_name }}</span>
              <span class="tag tag-dim" v-for="tag in parseTags(v.tags)" :key="tag">{{ tag }}</span>
              <span class="val-params" v-if="v.parameters && parseJson(v.parameters).length">
                {{ parseJson(v.parameters).length }} param(s)
              </span>
            </div>
            <div class="val-footer">
              <button class="btn btn-ghost btn-sm" @click="showDetail(v)">Details</button>
              <button v-if="!v.is_installed" class="btn btn-primary btn-sm" @click="installValidator(v)">
                Install
              </button>
              <template v-else>
                <button v-if="v.custom_copy_id" class="btn btn-primary btn-sm" @click="editInstalledValidator(v)">
                  ✏️ Edit
                </button>
                <button class="btn btn-ghost btn-sm" @click="installValidator(v)">
                  Reinstall
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- === CUSTOM TAB === -->
      <div v-if="tab === 'custom' && !loading">
        <!-- Guide Card -->
        <div class="card" style="margin-bottom:20px">
          <div class="guide-header" @click="showGuide = !showGuide" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="font-size:15px">📖 How to Create Custom Validators</strong>
              <span style="font-size:12px;color:var(--color-text-dim);margin-left:8px">— click to {{ showGuide ? 'collapse' : 'expand' }}</span>
            </div>
            <span style="font-size:18px;color:var(--color-text-dim);transition:transform 0.2s" :style="{transform: showGuide ? 'rotate(180deg)' : ''}">▼</span>
          </div>
          <div v-if="showGuide" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border)">
            <p style="font-size:13px;color:var(--color-text-dim);margin-bottom:16px;line-height:1.6">
              Custom validators let you define your own safety, quality, and formatting checks. Choose a validation type below, fill in the fields, and click <strong>Create</strong>. After creation, add the validator to a <strong>Guard</strong> to enforce it on AI outputs.
            </p>

            <div class="guide-types">
              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-info">regex</span>
                  <strong>Regex Pattern Match</strong>
                </div>
                <div class="guide-type-body">
                  <p>Match (or reject) text against a regular expression. Use for pattern-based checks.</p>
                  <pre>/badword|curse|slur/i</pre>
                  <small>Matches any text containing "badword", "curse", or "slur" (case-insensitive).</small>
                </div>
              </div>

              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-warning">keyword</span>
                  <strong>Keyword Match</strong>
                </div>
                <div class="guide-type-body">
                  <p>Check for the presence (or absence) of specific keywords. Great for blacklists and whitelists.</p>
                  <pre>competitor_name, secret_project, internal_only</pre>
                  <small>Comma-separated list. The validator checks if any keyword appears in the output.</small>
                </div>
              </div>

              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-success">length</span>
                  <strong>Length Check</strong>
                </div>
                <div class="guide-type-body">
                  <p>Enforce minimum and/or maximum character/word/token limits on AI output.</p>
                  <pre>{"min": 50, "max": 2000, "unit": "characters"}</pre>
                  <small>JSON config. Supported units: <code>characters</code>, <code>words</code>, <code>tokens</code>.</small>
                </div>
              </div>

              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-danger">json_schema</span>
                  <strong>JSON Schema</strong>
                </div>
                <div class="guide-type-body">
                  <p>Validate that the AI output is valid JSON matching a specific schema. Ideal for structured outputs.</p>
                  <pre>{"type":"object","required":["name","email"],"properties":{"name":{"type":"string"},"email":{"type":"string","format":"email"}}}</pre>
                  <small>Standard JSON Schema draft-07. The output must parse as JSON and pass schema validation.</small>
                </div>
              </div>

              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-default">llm</span>
                  <strong>LLM-Based Check</strong>
                </div>
                <div class="guide-type-body">
                  <p>Use another LLM call to evaluate the output. Describe what to check in natural language.</p>
                  <pre>The output must not contain any personal identifiable information (PII) such as names, addresses, phone numbers, or email addresses.</pre>
                  <small>The system sends the AI output + your rule description to an LLM for evaluation. <em>Requires a configured AI endpoint.</em></small>
                </div>
              </div>

              <div class="guide-type">
                <div class="guide-type-header">
                  <span class="badge badge-default">script</span>
                  <strong>Custom Script</strong>
                </div>
                <div class="guide-type-body">
                  <p>Write a JavaScript function for fully custom logic. Receives the output text and parameters.</p>
                  <pre>function validate(text, params) {
  const containsLink = /https?:\/\/[^\s]+/i.test(text);
  return {
    passed: params.allowLinks ? true : !containsLink,
    message: containsLink ? "Output contains a URL" : "OK",
    score: containsLink ? 0 : 1
  };
}</pre>
                  <small>Function signature: <code>validate(text, params) → {{ passed, message, score }}</code>. Params come from the Parameters JSON array.</small>
                </div>
              </div>
            </div>

            <div style="margin-top:16px;padding:12px;background:var(--color-bg);border-radius:8px;font-size:13px;color:var(--color-text-dim);line-height:1.6">
              <strong>💡 Next step:</strong> After creating your validator, go to <strong>Guards</strong> → create a Guard → add your validator to enforce it on AI outputs. Configure <em>on-fail actions</em> like <code>block</code>, <code>warn</code>, or <code>redact</code> to control what happens when validation fails.
            </div>
          </div>
        </div>

        <div v-if="!validators.length" class="empty-state">
          <div class="empty-icon">✏️</div>
          <h3>No Custom Validators Yet</h3>
          <p>Create your own validation rules — regex patterns, keywords, length checks, and more.</p>
          <button class="btn btn-primary" style="margin-top:16px" @click="openCustomCreate">Create Your First Validator</button>
        </div>

        <div class="grid-2">
          <div v-for="v in validators" :key="v.id" class="card validator-card validator-card-custom">
            <div class="val-header">
              <div class="val-title">
                <strong>{{ v.display_name }}</strong>
                <span class="badge badge-warning" style="margin-left:8px">{{ v.validation_type || 'regex' }}</span>
                <span v-if="v.created_by_name" style="font-size:11px;color:var(--color-text-dim);margin-left:8px">
                  by {{ v.created_by_name }}
                </span>
              </div>
              <span :class="['badge', v.is_active ? 'badge-success' : 'badge-default']">
                {{ v.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p class="val-desc">{{ v.description || 'No description' }}</p>
            <div v-if="v.validation_code" class="val-code">
              <code>{{ truncate(v.validation_code, 120) }}</code>
            </div>
            <div class="val-meta">
              <span class="tag" v-if="v.category_name">{{ v.category_name }}</span>
              <span class="tag tag-dim" v-for="tag in parseTags(v.tags)" :key="tag">{{ tag }}</span>
            </div>
            <div class="val-footer">
              <button class="btn btn-ghost btn-sm" @click="editCustomValidator(v)">Edit</button>
              <button v-if="auth.isAdmin" class="btn btn-ghost btn-sm" style="color:var(--color-danger)" @click="deleteValidator(v)">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== HUB DETAIL MODAL ===== -->
    <div class="modal-overlay" v-if="detailValidator" @click.self="detailValidator = null">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>{{ detailValidator.display_name }}</h3>
          <button class="modal-close" @click="detailValidator = null">&times;</button>
        </div>
        <div v-if="detailValidator.description" style="margin-bottom:16px;font-size:14px;color:var(--color-text-dim)">
          {{ detailValidator.description }}
        </div>
        <table class="kv-table">
          <tr><td>Hub URI</td><td style="font-family:monospace;font-size:12px">{{ detailValidator.hub_uri }}</td></tr>
          <tr><td>Category</td><td>{{ detailValidator.category_name || 'Uncategorized' }}</td></tr>
          <tr><td>Version</td><td>{{ detailValidator.version || 'latest' }}</td></tr>
          <tr><td>Status</td><td>{{ detailValidator.is_installed ? 'Installed' : 'Not installed' }}</td></tr>
          <tr><td>Tags</td><td>
            <span class="tag" v-for="tag in parseTags(detailValidator.tags)" :key="tag" style="margin-right:4px">{{ tag }}</span>
            <span v-if="!parseTags(detailValidator.tags).length">—</span>
          </td></tr>
          <tr v-if="detailValidator.source_url"><td>Source</td><td><a :href="detailValidator.source_url" target="_blank" style="color:var(--color-primary)">{{ detailValidator.source_url }}</a></td></tr>
          <tr v-if="detailValidator.docs_url"><td>Docs</td><td><a :href="detailValidator.docs_url" target="_blank" style="color:var(--color-primary)">{{ detailValidator.docs_url }}</a></td></tr>
        </table>
        <div v-if="detailValidator.parameters && parseJson(detailValidator.parameters).length" style="margin-top:16px">
          <h4 style="margin-bottom:8px;font-size:14px">Parameters</h4>
          <table class="data-table">
            <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
            <tbody>
              <tr v-for="p in parseJson(detailValidator.parameters)" :key="p.name">
                <td><strong>{{ p.name }}</strong></td>
                <td><span class="badge badge-info">{{ p.type }}</span></td>
                <td>{{ p.required ? 'Yes' : 'No' }}</td>
                <td style="font-family:monospace;font-size:12px">{{ JSON.stringify(p.default) }}</td>
                <td style="font-size:13px">{{ p.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="detailValidator = null">Close</button>
          <button v-if="!detailValidator.is_installed" class="btn btn-primary" @click="installValidator(detailValidator); detailValidator = null">
            Install Validator
          </button>
        </div>
      </div>
    </div>

    <!-- ===== CUSTOM CREATE/EDIT MODAL ===== -->
    <div class="modal-overlay" v-if="showCustomForm" @click.self="closeCustomForm">
      <div class="modal slide-up" style="max-width:700px">
        <div class="modal-header">
          <h3>{{ editingValidator ? 'Edit Custom Validator' : 'Create Custom Validator' }}</h3>
          <button class="modal-close" @click="closeCustomForm">&times;</button>
        </div>
        <form @submit.prevent="saveCustomValidator">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input v-model="form.name" class="form-input" placeholder="e.g., my_custom_check" required />
              <span class="form-hint">Unique identifier, lowercase, no spaces</span>
            </div>
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input v-model="form.display_name" class="form-input" placeholder="My Custom Check" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="form.description" class="form-textarea" placeholder="What does this validator check for?" rows="2"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Validation Type</label>
              <select v-model="form.validation_type" class="form-select">
                <option value="regex">Regex</option>
                <option value="keyword">Keyword Match</option>
                <option value="length">Length Check</option>
                <option value="llm">LLM-based</option>
                <option value="script">Custom Script</option>
                <option value="json_schema">JSON Schema</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <div style="display:flex;gap:8px">
                <select v-model="form.category_id" class="form-select" style="flex:1">
                  <option value="">— None / New —</option>
                  <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                </select>
                <input v-if="!form.category_id" v-model="form.new_category_name" class="form-input" placeholder="New category..." style="flex:1" />
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Validation Code / Pattern</label>
            <textarea
              v-model="form.validation_code"
              class="form-textarea"
              :placeholder="codePlaceholder"
              rows="4"
              style="font-family:monospace;font-size:12px"
            ></textarea>
            <span class="form-hint">{{ codeHint }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Parameters (JSON array)</label>
            <textarea v-model="form.parameters_str" class="form-textarea" placeholder='[{"name":"threshold","type":"number","default":0.5,"required":false,"description":"Score threshold"}]' rows="3" style="font-family:monospace;font-size:12px"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tags (comma-separated)</label>
              <input v-model="form.tags_str" class="form-input" placeholder="quality, safety, custom" />
            </div>
            <div class="form-group">
              <label class="form-label">Active</label>
              <label class="toggle" style="display:block;margin-top:8px">
                <input type="checkbox" v-model="form.is_active" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeCustomForm">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : editingValidator ? 'Update Validator' : 'Create Validator' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '../utils/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const tab = ref('hub');
const validators = ref([]);
const categories = ref([]);
const stats = ref(null);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const categoryFilter = ref('');
const installedFilter = ref('');
const showGuide = ref(false);

// Hub detail
const detailValidator = ref(null);

// Custom create/edit
const showCustomForm = ref(false);
const editingValidator = ref(null);

const form = ref({
  name: '', display_name: '', description: '', category_id: '',
  new_category_name: '', validation_type: 'regex', validation_code: '',
  parameters_str: '[]', tags_str: '', is_active: true,
});

const codePlaceholder = computed(() => {
  switch (form.value.validation_type) {
    case 'regex': return '/pattern/flags';
    case 'keyword': return 'keyword1, keyword2, keyword3';
    case 'length': return '{"min": 10, "max": 500}';
    case 'llm': return 'Describe what the LLM should check for...';
    case 'script': return '// JavaScript validation function';
    case 'json_schema': return '{"type": "object", "properties": {...}}';
    default: return '';
  }
});

const codeHint = computed(() => {
  switch (form.value.validation_type) {
    case 'regex': return 'Enter a regex pattern, e.g. /^[a-zA-Z]+$/';
    case 'keyword': return 'Comma-separated list of keywords to match/blacklist';
    case 'length': return 'JSON with min/max character length constraints';
    case 'llm': return 'A natural language description of the validation rule for the LLM';
    case 'script': return 'A JavaScript function(body, params) that returns { passed, message, score }';
    case 'json_schema': return 'A JSON Schema object to validate the output against';
    default: return '';
  }
});

let debounceTimer;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
}

function switchTab(t) {
  tab.value = t;
  installedFilter.value = '';
  load();
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ source: tab.value });
    if (search.value) params.set('search', search.value);
    if (categoryFilter.value) params.set('category', categoryFilter.value);
    if (installedFilter.value) params.set('installed', installedFilter.value);
    const { data } = await api.get(`/validators?${params.toString()}`);
    validators.value = data.data || data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadMeta() {
  try {
    const [statsRes] = await Promise.all([
      api.get('/validators/stats'),
      (async () => {
        const { data } = await api.get('/validators/categories');
        categories.value = data;
      })(),
    ]);
    stats.value = statsRes.data;
  } catch (err) {
    console.error(err);
  }
}

function showDetail(v) {
  // Load full validator with all fields
  api.get(`/validators/${v.id}`).then(({ data }) => {
    detailValidator.value = data;
  }).catch(console.error);
}

function openCustomCreate() {
  resetForm();
  editingValidator.value = null;
  showCustomForm.value = true;
}

function editCustomValidator(v) {
  editingValidator.value = v;
  form.value = {
    name: v.name,
    display_name: v.display_name,
    description: v.description || '',
    category_id: v.category_id || '',
    new_category_name: '',
    validation_type: v.validation_type || 'regex',
    validation_code: v.validation_code || '',
    parameters_str: JSON.stringify(parseJson(v.parameters), null, 2),
    tags_str: parseTags(v.tags).join(', '),
    is_active: v.is_active,
  };
  showCustomForm.value = true;
}

function resetForm() {
  form.value = {
    name: '', display_name: '', description: '', category_id: '',
    new_category_name: '', validation_type: 'regex', validation_code: '',
    parameters_str: '[]', tags_str: '', is_active: true,
  };
}

function closeCustomForm() {
  showCustomForm.value = false;
  editingValidator.value = null;
  resetForm();
}

async function saveCustomValidator() {
  saving.value = true;
  try {
    let parameters;
    try { parameters = JSON.parse(form.value.parameters_str || '[]'); } catch { parameters = []; }

    const payload = {
      name: form.value.name,
      display_name: form.value.display_name || form.value.name,
      description: form.value.description,
      category_id: form.value.category_id || null,
      new_category_name: form.value.new_category_name || null,
      validation_type: form.value.validation_type,
      validation_code: form.value.validation_code || null,
      parameters,
      tags: form.value.tags_str.split(',').map(t => t.trim()).filter(Boolean),
      is_active: form.value.is_active,
    };

    if (editingValidator.value) {
      // Don't send new_category_name on edit
      delete payload.new_category_name;
      await api.put(`/validators/${editingValidator.value.id}`, payload);
    } else {
      await api.post('/validators', payload);
    }
    closeCustomForm();
    await Promise.all([load(), loadMeta()]);
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed');
  } finally {
    saving.value = false;
  }
}

async function installValidator(v) {
  try {
    const { data } = await api.post(`/validators/${v.id}/install`);
    // Show message with custom copy info
    alert(data.message || `Validator "${v.display_name}" installed!`);
    // Reload to get updated is_installed and custom_copy_id
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Install failed');
  }
}

async function editInstalledValidator(v) {
  // v.custom_copy_id is the editable custom copy — fetch it and open the edit form
  if (!v.custom_copy_id) return;
  try {
    const { data } = await api.get(`/validators/${v.custom_copy_id}`);
    editingValidator.value = data;
    form.value = {
      name: data.name,
      display_name: data.display_name,
      description: data.description || '',
      category_id: data.category_id || '',
      new_category_name: '',
      validation_type: data.validation_type || 'regex',
      validation_code: data.validation_code || '',
      parameters_str: JSON.stringify(parseJson(data.parameters), null, 2),
      tags_str: parseTags(data.tags).join(', '),
      is_active: data.is_active,
    };
    showCustomForm.value = true;
  } catch (err) {
    console.error(err);
  }
}

async function deleteValidator(v) {
  if (!confirm(`Delete validator "${v.display_name}"?`)) return;
  try {
    await api.delete(`/validators/${v.id}`);
    await Promise.all([load(), loadMeta()]);
  } catch (err) {
    alert(err.response?.data?.error || 'Delete failed');
  }
}

// Helpers
function parseTags(tags) {
  if (!tags) return [];
  return typeof tags === 'string' ? JSON.parse(tags) : tags;
}
function parseJson(val) {
  if (!val) return [];
  return typeof val === 'string' ? JSON.parse(val) : val;
}
function truncate(s, len) { return s && s.length > len ? s.substring(0, len) + '...' : s || ''; }

onMounted(async () => {
  await Promise.all([load(), loadMeta()]);
});
</script>

<style scoped>
.validator-card {
  padding: 16px;
}
.validator-card-custom {
  border-left: 3px solid var(--color-warning);
}
.val-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.val-title strong {
  font-size: 15px;
}
.val-uri {
  display: block;
  font-size: 11px;
  color: var(--color-text-dim);
  font-family: monospace;
  margin-top: 2px;
}
.val-desc {
  font-size: 13px;
  color: var(--color-text-dim);
  margin-bottom: 10px;
  line-height: 1.5;
}
.val-code {
  background: var(--color-surface-hover);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 11px;
  overflow-x: auto;
}
.val-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
  margin-bottom: 10px;
}
.val-params {
  font-size: 11px;
  color: var(--color-text-dim);
  margin-left: auto;
}
.val-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 0;
}
.tab {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-dim);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tab:hover { color: var(--color-text); }
.tab-active {
  color: var(--color-primary) !important;
  border-bottom-color: var(--color-primary);
}
.tab-count {
  background: var(--color-surface-hover);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
}
.tab-active .tab-count {
  background: var(--color-primary);
  color: #fff;
}

.kv-table {
  width: 100%;
  border-collapse: collapse;
}
.kv-table td {
  padding: 6px 12px 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.kv-table td:first-child {
  font-weight: 600;
  color: var(--color-text-dim);
  width: 120px;
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-dim);
  margin-top: 4px;
  display: block;
}

.tag-dim {
  opacity: 0.6;
}

.guide-header { padding: 4px 0; user-select: none; }
.guide-header:hover strong { color: var(--color-primary-hover); }
.guide-types { display: flex; flex-direction: column; gap: 12px; }
.guide-type {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.guide-type-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-surface-hover);
  font-size: 14px;
}
.guide-type-body {
  padding: 12px 14px;
}
.guide-type-body p {
  font-size: 13px;
  color: var(--color-text-dim);
  margin-bottom: 8px;
  line-height: 1.5;
}
.guide-type-body pre {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 6px;
}
.guide-type-body small {
  font-size: 11px;
  color: var(--color-text-dim);
  line-height: 1.5;
}
</style>
