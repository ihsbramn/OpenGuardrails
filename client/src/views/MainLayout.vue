<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">🛡️</div>
        <h1>OpenGuardrails</h1>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Main</div>
          <router-link to="/" class="nav-item">
            <span class="icon">📊</span> Dashboard
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Configuration</div>
          <router-link to="/endpoints" class="nav-item">
            <span class="icon">🔌</span> AI Endpoints
          </router-link>
          <router-link to="/validators" class="nav-item">
            <span class="icon">✅</span> Validators
          </router-link>
          <router-link to="/guards" class="nav-item">
            <span class="icon">🛡️</span> Guards
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Monitoring</div>
          <router-link to="/logs" class="nav-item">
            <span class="icon">📋</span> Validation Logs
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Settings</div>
          <router-link to="/server" class="nav-item">
            <span class="icon">⚙️</span> Server Config
          </router-link>
          <router-link to="/api-keys" class="nav-item">
            <span class="icon">🔑</span> API Keys
          </router-link>
          <router-link v-if="auth.isAdmin" to="/users" class="nav-item">
            <span class="icon">👥</span> Users
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ auth.user?.full_name?.charAt(0) || 'U' }}</div>
          <div>
            <div class="user-name">{{ auth.user?.full_name }}</div>
            <div class="user-role">{{ auth.user?.role }}</div>
          </div>
        </div>
        <button class="logout-btn" @click="handleLogout">Sign Out</button>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>
