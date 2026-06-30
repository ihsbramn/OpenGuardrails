<template>
  <NotificationModal
    v-if="state.notif.show"
    :title="state.notif.title"
    :message="state.notif.message"
    :type="state.notif.type"
    @close="resolveNotif"
  />
  <ConfirmModal
    v-if="state.confirm.show"
    :title="state.confirm.title"
    :message="state.confirm.message"
    :confirmText="state.confirm.confirmText"
    @confirm="resolveConfirm(true)"
    @cancel="resolveConfirm(false)"
  />
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
