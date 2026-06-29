<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Validation Logs</h2>
        <div class="page-subtitle">Monitor all validation activity across your guards</div>
      </div>
      <button class="btn btn-secondary" @click="load">🔄 Refresh</button>
    </div>

    <div class="page-body">
      <!-- Stats -->
      <div class="stat-grid" v-if="logStats">
        <div class="card stat-card stat-blue">
          <div class="stat-value">{{ logStats.overall?.total_validations || 0 }}</div>
          <div class="stat-label">Total Validations</div>
        </div>
        <div class="card stat-card stat-green">
          <div class="stat-value">{{ logStats.overall?.passed || 0 }}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="card stat-card stat-red">
          <div class="stat-value">{{ logStats.overall?.failed || 0 }}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ logStats.overall?.avg_latency_ms || 0 }}ms</div>
          <div class="stat-label">Avg Latency</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <select v-model="filterPassed" class="form-select" @change="load">
          <option value="">All Results</option>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state"><p>Loading...</p></div>

      <table class="data-table" v-if="!loading && logs.length">
        <thead>
          <tr>
            <th>Guard</th>
            <th>Result</th>
            <th>Checks</th>
            <th>Latency</th>
            <th>User</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>
              <strong>{{ log.guard_name }}</strong>
              <div v-if="log.input_text" style="font-size:12px;color:var(--color-text-dim);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ log.input_text.substring(0, 80) }}
              </div>
            </td>
            <td>
              <span :class="['badge', log.validation_passed ? 'badge-success' : 'badge-danger']">
                {{ log.validation_passed ? 'PASS' : 'FAIL' }}
              </span>
            </td>
            <td>{{ log.checks_passed }}/{{ log.total_checks }}</td>
            <td>{{ log.latency_ms }}ms</td>
            <td>{{ log.user_name || 'System' }}</td>
            <td style="color:var(--color-text-dim);font-size:12px">{{ formatDate(log.created_at) }}</td>
          </tr>
        </tbody>
      </table>

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

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '100' });
    if (filterPassed.value) params.set('passed', filterPassed.value);
    const { data } = await api.get(`/logs?${params.toString()}`);
    logs.value = data.data || data;
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

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '';
}

onMounted(async () => {
  await Promise.all([load(), loadStats()]);
});
</script>
