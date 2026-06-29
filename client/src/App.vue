<template>
  <router-view />
  <ToastContainer />
</template>

<script setup>
import { useAuthStore } from './stores/auth';
import { onMounted } from 'vue';
import ToastContainer from './components/ToastContainer.vue';

const auth = useAuthStore();

onMounted(async () => {
  if (auth.token) {
    await auth.fetchUser();
  }
});
</script>
