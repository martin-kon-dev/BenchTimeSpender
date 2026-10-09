<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

type Theme = 'light' | 'dark'
const storageKey = 'benchtime-theme'
const preference = window.matchMedia?.('(prefers-color-scheme: dark)')
const systemTheme = ref<Theme>(preference?.matches ? 'dark' : 'light')
const selected = ref<Theme | null>(null)
try {
  const saved = localStorage.getItem(storageKey)
  if (saved === 'light' || saved === 'dark') selected.value = saved
} catch { /* Theme switching still works when browser storage is unavailable. */ }

const theme = computed(() => selected.value ?? systemTheme.value)
watchEffect(() => { document.documentElement.style.colorScheme = theme.value })

function toggle() {
  selected.value = theme.value === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(storageKey, selected.value) }
  catch { /* Keep the selection for this session. */ }
}
function updateSystemTheme(event: MediaQueryListEvent) {
  systemTheme.value = event.matches ? 'dark' : 'light'
}
onMounted(() => preference?.addEventListener('change', updateSystemTheme))
onUnmounted(() => preference?.removeEventListener('change', updateSystemTheme))
</script>

<template>
  <button class="theme-toggle" type="button" role="switch" :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    :aria-checked="theme === 'dark'" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggle">
    <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" /></svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
  </button>
</template>
