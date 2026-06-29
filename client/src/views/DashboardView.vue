<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <div class="page-subtitle">Overview of your Guardrails deployment</div>
      </div>
      <button class="btn btn-primary" @click="refresh">🔄 Refresh</button>
    </div>

    <div class="page-body">
      <!-- Stats Grid -->
      <div class="stat-grid">
        <div class="card stat-card stat-blue">
          <div class="stat-icon">🛡️</div>
          <div class="stat-value">{{ data.stats?.active_guards || 0 }}</div>
          <div class="stat-label">Active Guards</div>
        </div>
        <div class="card stat-card stat-green">
          <div class="stat-icon">✅</div>
          <div class="stat-value">{{ data.stats?.pass_rate || 0 }}%</div>
          <div class="stat-label">Validation Pass Rate</div>
        </div>
        <div class="card stat-card stat-yellow">
          <div class="stat-icon">🔌</div>
          <div class="stat-value">{{ data.stats?.active_endpoints || 0 }}</div>
          <div class="stat-label">Active Endpoints</div>
        </div>
        <div class="card stat-card stat-red">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">{{ data.stats?.failed_validations || 0 }}</div>
          <div class="stat-label">Failed Validations</div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom:24px">
        <div class="card">
          <div class="stat-value" style="font-size:20px">{{ data.stats?.validations_24h || 0 }}</div>
          <div class="stat-label">Validations (last 24h)</div>
        </div>
        <div class="card">
          <div class="stat-value" style="font-size:20px">{{ data.stats?.total_validators || 0 }}</div>
          <div class="stat-label">Total Validators</div>
        </div>
      </div>

      <!-- Top Guards -->
      <div class="card" style="margin-bottom:24px">
        <h3 class="section-title">Top Guards by Usage</h3>
        <table class="data-table" v-if="data.top_guards?.length">
          <thead>
            <tr><th>Guard Name</th><th>Total Validations</th><th>Failures</th><th>Success Rate</th></tr>
          </thead>
          <tbody>
            <tr v-for="g in data.top_guards" :key="g.name">
              <td><strong>{{ g.name }}</strong></td>
              <td>{{ g.validation_count }}</td>
              <td><span class="badge badge-danger">{{ g.failures }}</span></td>
              <td>
                <span :class="['badge', g.validation_count > 0 && ((g.validation_count - g.failures) / g.validation_count * 100) > 90 ? 'badge-success' : 'badge-warning']">
                  {{ g.validation_count > 0 ? Math.round((g.validation_count - g.failures) / g.validation_count * 100) : 0 }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state"><p>No validation data yet</p></div>
      </div>

      <!-- Endpoint Health -->
      <div class="card" style="margin-bottom:24px">
        <h3 class="section-title">Endpoint Health</h3>
        <table class="data-table" v-if="data.endpoint_health?.length">
          <thead>
            <tr><th>Endpoint</th><th>Provider</th><th>Status</th><th>24h Calls</th></tr>
          </thead>
          <tbody>
            <tr v-for="ep in data.endpoint_health" :key="ep.name">
              <td><strong>{{ ep.name }}</strong></td>
              <td>{{ ep.provider }}</td>
              <td>
                <span :class="['badge', ep.is_active ? 'badge-success' : 'badge-default']">
                  {{ ep.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>{{ ep.recent_calls || 0 }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state"><p>No endpoints configured</p></div>
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <h3 class="section-title">Recent Activity</h3>
        <table class="data-table" v-if="data.recent_activity?.length">
          <thead>
            <tr><th>User</th><th>Action</th><th>Resource</th><th>Time</th></tr>
          </thead>
          <tbody>
            <tr v-for="act in data.recent_activity" :key="act.id">
              <td>{{ act.user_name || 'System' }}</td>
              <td><span class="badge badge-info">{{ act.action }}</span></td>
              <td>{{ act.resource_type }} {{ act.resource_id ? '(' + act.resource_id.substring(0,8) + '...)' : '' }}</td>
              <td style="color:var(--color-text-dim)">{{ formatDate(act.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state"><p>No recent activity</p></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../utils/api';

const data = ref({ stats: {}, top_guards: [], recent_activity: [], endpoint_health: [] });

async function refresh() {
  try {
    const { data: d } = await api.get('/dashboard');
    data.value = d;
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString();
}

onMounted(refresh);
</script>
