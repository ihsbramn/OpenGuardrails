<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="onClose">
      <div class="modal notification-modal">
        <div class="modal-header">
          <h3>
            <span class="notif-icon">{{ icon }}</span>
            {{ title }}
          </h3>
          <button class="modal-close" @click="onClose">&times;</button>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="onClose" ref="okBtn">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';

const props = defineProps({
  title: { type: String, default: 'Notification' },
  message: { type: String, default: '' },
  type: { type: String, default: 'info' }, // info | success | error | warning
});

const emit = defineEmits(['close']);
const okBtn = ref(null);

const icon = computed(() => {
  switch (props.type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    default: return 'ℹ';
  }
});

function onClose() {
  emit('close');
}

onMounted(() => {
  okBtn.value?.focus();
});
</script>
