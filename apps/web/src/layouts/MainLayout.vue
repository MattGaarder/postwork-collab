<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="home" aria-label="Projects" @click="router.push('/projects')" />
        <q-toolbar-title> Code Collaboration </q-toolbar-title>
        <q-btn flat dense round icon="account_circle" aria-label="Account" @click="router.push('/account')" />
      </q-toolbar>
    </q-header>


    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>
