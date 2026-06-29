import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function useToasts() {
  function addToast({ type = 'error', message, details = [], duration = 8000 }) {
    const id = ++toastId;
    toasts.value.push({ id, type, message, details, duration });
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  function showError(err) {
    const message = err?.friendlyMessage || err?.response?.data?.error || err?.message || 'An unexpected error occurred.';
    const details = err?.fieldErrors || err?.response?.data?.details || [];

    // For network errors, show a simpler message
    if (err?.code === 'NETWORK_ERROR' || err?.code === 'ERR_NETWORK') {
      return addToast({
        type: 'error',
        message: 'Cannot connect to the server. Is it running?',
        details: [{ field: 'connection', message: 'Check that the backend server is up and reachable.' }],
        duration: 10000,
      });
    }

    return addToast({ type: 'error', message, details });
  }

  function showSuccess(message) {
    return addToast({ type: 'success', message, duration: 4000 });
  }

  return { toasts, addToast, removeToast, showError, showSuccess };
}
