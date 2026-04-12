<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, sans-serif;
  background: #f5f5f3;
  color: #44403c;
  padding: 2rem;
  overflow-x: hidden;
}
@media (max-width: 768px) {
  body { padding: 1rem 0.75rem; }
}
</style>
