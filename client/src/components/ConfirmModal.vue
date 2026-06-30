<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="onCancel">
      <div class="modal confirm-modal">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="modal-close" @click="onCancel">&times;</button>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="onCancel">Cancel</button>
          <button class="btn btn-danger" @click="onConfirm" ref="confirmBtn">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  title: { type: String, default: 'Confirm' },
  message: { type: String, default: 'Are you sure?' },
  confirmText: { type: String, default: 'Confirm' },
});

const emit = defineEmits(['confirm', 'cancel']);
const confirmBtn = ref(null);

function onConfirm() {
  emit('confirm');
}

function onCancel() {
  emit('cancel');
}

onMounted(() => {
  confirmBtn.value?.focus();
});
</script>
