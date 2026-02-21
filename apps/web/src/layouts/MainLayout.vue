<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="home" aria-label="Projects" @click="router.push('/projects')" />
        <q-toolbar-title> Code Collaboration </q-toolbar-title>
        <q-btn flat dense round icon="account_circle" aria-label="Account" @click="router.push('/account')">
          <q-badge v-if="invitationCount > 0" color="red" floating>
            {{ invitationCount }}
          </q-badge>
        </q-btn>
      </q-toolbar>
    </q-header>


    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../lib/http';

const router = useRouter();
const invitationCount = ref(0);
let interval = null;

async function fetchInvitationCount() {
  try {
    const { data } = await api.get('/invitations');
    invitationCount.value = data.length;
  } catch (error) {
    console.error('Failed to fetch invitations:', error);
  }
}

onMounted(() => {
  fetchInvitationCount();
  // Poll every 30 seconds
  interval = setInterval(fetchInvitationCount, 30000);
});

onBeforeUnmount(() => {
  if (interval) clearInterval(interval);
});
</script>
