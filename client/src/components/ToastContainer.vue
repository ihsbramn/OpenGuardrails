<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]" @click="removeToast(t.id)">
        <div class="toast-header">
          <span class="toast-icon">{{ icon(t.type) }}</span>
          <strong class="toast-msg">{{ t.message }}</strong>
          <button class="toast-close">&times;</button>
        </div>
        <div v-if="t.details && t.details.length" class="toast-details">
          <div v-for="(d, i) in t.details" :key="i" class="toast-field">
            <span class="toast-field-name">{{ d.field }}</span>
            <span class="toast-field-msg">{{ d.message }}</span>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToasts } from '../utils/toasts';

const { toasts, removeToast } = useToasts();

function icon(type) {
  return type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕';
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 480px;
  width: 100%;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  transition: all 0.2s;
}
.toast-error { border-left: 4px solid var(--color-danger); }
.toast-success { border-left: 4px solid var(--color-success); }
.toast-warning { border-left: 4px solid var(--color-warning); }
.toast-header { display: flex; align-items: center; gap: 10px; }
.toast-icon { font-size: 16px; font-weight: 700; }
.toast-error .toast-icon { color: var(--color-danger); }
.toast-success .toast-icon { color: var(--color-success); }
.toast-msg { flex: 1; font-size: 14px; color: var(--color-text); }
.toast-close {
  background: none; border: none; color: var(--color-text-dim);
  font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;
}
.toast-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.toast-field {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}
.toast-field-name {
  font-family: monospace;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.toast-field-msg {
  color: var(--color-text-dim);
}

/* transitions */
.toast-enter-active { animation: toastIn 0.3s ease-out; }
.toast-leave-active { animation: toastOut 0.2s ease-in forwards; }
@keyframes toastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes toastOut { to { opacity: 0; transform: translateX(100%); } }
</style>
