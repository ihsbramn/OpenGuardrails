<template>
  <div class="login-page">
    <div class="login-card slide-up">
      <div class="logo">
        <div class="logo-icon">🛡️</div>
        <div>OpenGuardrails</div>
        <div style="font-size:13px;color:var(--color-text-dim);margin-top:4px;">Management Console</div>
      </div>
      <form @submit.prevent="handleLogin">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input v-model="email" type="email" class="form-input" placeholder="admin@openguardrails.com" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input v-model="password" type="password" class="form-input" placeholder="Enter your password" required />
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
      <div style="text-align:center;margin-top:20px;font-size:12px;color:var(--color-text-dim);">
        Demo: admin@openguardrails.com / admin123
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.error || 'Login failed';
  } finally {
    loading.value = false;
  }
}
</script>
