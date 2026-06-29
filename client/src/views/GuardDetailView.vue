<template>
  <div>
    <div class="page-header">
      <div>
        <router-link to="/guards" style="font-size:13px;color:var(--color-text-dim)">← Back to Guards</router-link>
        <h2>{{ guard.name }}</h2>
        <div class="page-subtitle" v-if="guard.description">{{ guard.description }}</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" @click="showValidate = true">🧪 Validate Text</button>
        <router-link to="/guards" class="btn btn-secondary">Edit Guard</router-link>
      </div>
    </div>

    <div class="page-body">
      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <div v-if="!loading && guard.id">
        <!-- Guard Info -->
        <div class="grid-2" style="margin-bottom:24px">
          <div class="card">
            <h3 class="section-title">Guard Configuration</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
              <div><span style="color:var(--color-text-dim)">Type:</span> <span :class="['badge', guard.guard_type === 'input' ? 'badge-info' : 'badge-success']">{{ guard.guard_type }}</span></div>
              <div><span style="color:var(--color-text-dim)">Status:</span> <span :class="['badge', guard.is_active ? 'badge-success' : 'badge-default']">{{ guard.is_active ? 'Active' : 'Inactive' }}</span></div>
              <div><span style="color:var(--color-text-dim)">On Fail:</span> <span class="badge badge-warning">{{ guard.on_fail_action }}</span></div>
              <div><span style="color:var(--color-text-dim)">Model:</span> {{ guard.model || 'Default' }}</div>
              <div><span style="color:var(--color-text-dim)">Endpoint:</span> {{ guard.endpoint_name || 'Not configured' }}</div>
              <div><span style="color:var(--color-text-dim)">Created:</span> {{ formatDate(guard.created_at) }}</div>
            </div>
          </div>

          <div class="card">
            <h3 class="section-title">API Usage</h3>
            <div style="margin-bottom:12px;font-size:13px;color:var(--color-text-dim)">
              Route your OpenAI SDK to this guard:
            </div>
            <div class="code-block">
              <div># Python Client</div>
              <div style="color:var(--color-primary-hover)">from</div> openai <span style="color:var(--color-primary-hover)">import</span> OpenAI
              <br/>
              client = OpenAI(
              <br/>&nbsp;&nbsp;base_url=<span style="color:var(--color-success)">"http://localhost:8000/guards/{{ guard.name }}/openai/v1/"</span>
              <br/>)
              <button class="copy-btn" style="float:right" @click="copyCode">Copy</button>
            </div>
          </div>
        </div>

        <!-- Validators -->
        <div class="card" style="margin-bottom:24px">
          <h3 class="section-title">Validators ({{ guard.validators?.length || 0 }})</h3>
          <table class="data-table" v-if="guard.validators?.length">
            <thead>
              <tr><th>#</th><th>Validator</th><th>Hub URI</th><th>Category</th><th>On Fail</th></tr>
            </thead>
            <tbody>
              <tr v-for="(v, i) in guard.validators" :key="v.id">
                <td>{{ v.priority }}</td>
                <td><strong>{{ v.display_name }}</strong></td>
                <td style="font-family:monospace;font-size:12px">{{ v.hub_uri }}</td>
                <td><span class="tag" v-if="v.category_name">{{ v.category_name }}</span></td>
                <td><span class="badge badge-default">{{ v.on_fail_action }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state"><p>No validators assigned to this guard.</p></div>
        </div>

        <!-- Validation Results -->
        <div class="card">
          <h3 class="section-title">Recent Validations</h3>
          <div v-if="validationResult" style="margin-bottom:16px">
            <div :class="['alert', validationResult.validation_passed ? 'alert-success' : 'alert-error']">
              {{ validationResult.validation_passed ? '✅ Validation PASSED' : '❌ Validation FAILED' }}
              ({{ validationResult.checks_passed }}/{{ validationResult.total_checks }} checks passed)
            </div>
            <div v-for="r in validationResult.results" :key="r.validator_id" style="padding:8px 0;border-bottom:1px solid var(--color-border)">
              <span :class="['badge', r.passed ? 'badge-success' : 'badge-danger']">{{ r.passed ? 'PASS' : 'FAIL' }}</span>
              <strong style="margin-left:8px">{{ r.name }}</strong>
              <span style="color:var(--color-text-dim);margin-left:8px;font-size:12px">{{ r.message }}</span>
              <span style="float:right;font-size:12px">Score: {{ Math.round(r.score) }}%</span>
            </div>
          </div>
          <div v-else style="font-size:13px;color:var(--color-text-dim)">No validations run yet. Use "Validate Text" to test this guard.</div>
        </div>
      </div>
    </div>

    <!-- Validate Modal -->
    <div class="modal-overlay" v-if="showValidate" @click.self="showValidate = false">
      <div class="modal slide-up">
        <div class="modal-header">
          <h3>Validate Text with {{ guard.name }}</h3>
          <button class="modal-close" @click="showValidate = false">&times;</button>
        </div>
        <form @submit.prevent="runValidation">
          <div class="form-group">
            <label class="form-label">Input Text</label>
            <textarea v-model="validateText" class="form-textarea" placeholder="Enter text to validate..." rows="4" required></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showValidate = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="validating">
              {{ validating ? 'Validating...' : 'Run Validation' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../utils/api';

const route = useRoute();
const guard = ref({ validators: [] });
const loading = ref(true);
const showValidate = ref(false);
const validateText = ref('');
const validating = ref(false);
const validationResult = ref(null);

async function loadGuard() {
  loading.value = true;
  try {
    const { data } = await api.get(`/guards/${route.params.id}`);
    guard.value = data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function runValidation() {
  validating.value = true;
  try {
    const { data } = await api.post(`/guards/${guard.value.id}/validate`, {
      text: validateText.value,
    });
    validationResult.value = data;
    showValidate.value = false;
  } catch (err) {
    alert(err.response?.data?.error || 'Validation failed');
  } finally {
    validating.value = false;
  }
}

function copyCode() {
  const code = `client = OpenAI(\n  base_url="http://localhost:8000/guards/${guard.value.name}/openai/v1/"\n)`;
  navigator.clipboard.writeText(code);
  alert('Copied to clipboard!');
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

onMounted(loadGuard);
</script>
