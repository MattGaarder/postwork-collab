<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuth } from './stores/auth';

const auth = useAuth();
onMounted(() => {
  auth.initialize();
});
</script>
