<template>
  <Transition name="modal-fade">
    <NotificationModal
      v-if="state.notif.show"
      :title="state.notif.title"
      :message="state.notif.message"
      :type="state.notif.type"
      @close="resolveNotif"
    />
  </Transition>
  <Transition name="modal-fade">
    <ConfirmModal
      v-if="state.confirm.show"
      :title="state.confirm.title"
      :message="state.confirm.message"
      :confirmText="state.confirm.confirmText"
      @confirm="resolveConfirm(true)"
      @cancel="resolveConfirm(false)"
    />
  </Transition>
</template>

<script setup>
import NotificationModal from './NotificationModal.vue';
import ConfirmModal from './ConfirmModal.vue';
import { useModal } from '../utils/modals';

const { state, _resolveNotif, _resolveConfirm } = useModal();

function resolveNotif() {
  _resolveNotif();
}

function resolveConfirm(result) {
  _resolveConfirm(result);
}
</script>

<style>
/* ── Modal entry/leave transitions ── */
.modal-fade-enter-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-active .modal {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}
.modal-fade-leave-active .modal {
  transition: opacity 0.15s ease, transform 0.18s ease-in;
}

.modal-fade-enter-from {
  opacity: 0;
}
.modal-fade-enter-from .modal {
  opacity: 0;
  transform: scale(0.92) translateY(16px);
}

.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-leave-to .modal {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
