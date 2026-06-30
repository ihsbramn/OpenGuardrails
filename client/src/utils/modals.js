// Global modal system — replaces browser alert() / confirm() with
// proper Vue modal pop-ups. Provides a singleton reactive state so
// any component can show modals via useModal().
import { reactive } from 'vue';

const state = reactive({
  // Notification modal
  notif: { show: false, title: '', message: '', type: 'info' },
  notifResolve: null,

  // Confirmation modal
  confirm: { show: false, title: '', message: '', confirmText: 'Confirm' },
  confirmResolve: null,
});

/**
 * Show a notification modal. Returns a promise that resolves
 * when the user dismisses it.
 *
 * Usage:
 *   const { showNotification } = useModal();
 *   await showNotification('Success', 'API key copied!', 'success');
 */
function showNotification(title, message, type = 'info') {
  return new Promise((resolve) => {
    state.notifResolve = resolve;
    Object.assign(state.notif, { show: true, title, message, type });
  });
}

/**
 * Show a confirmation modal. Returns true if user confirms, false if
 * they cancel or close.
 *
 * Usage:
 *   const { showConfirm } = useModal();
 *   const ok = await showConfirm('Delete User', 'Are you sure?', 'Delete');
 *   if (ok) { ... }
 */
function showConfirm(title, message, confirmText = 'Confirm') {
  return new Promise((resolve) => {
    state.confirmResolve = resolve;
    Object.assign(state.confirm, { show: true, title, message, confirmText });
  });
}

/** Internal: called by modal components to close */
function _resolveNotif() {
  if (state.notifResolve) {
    state.notifResolve();
    state.notifResolve = null;
  }
  state.notif.show = false;
}

function _resolveConfirm(result) {
  if (state.confirmResolve) {
    state.confirmResolve(result);
    state.confirmResolve = null;
  }
  state.confirm.show = false;
}

export function useModal() {
  return { state, showNotification, showConfirm, _resolveNotif, _resolveConfirm };
}
