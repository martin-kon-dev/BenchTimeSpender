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
  <button class="theme-toggle" type="button" role="switch" aria-label="Dark mode"
    :aria-checked="theme === 'dark'" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggle">
    {{ theme === 'dark' ? 'Dark' : 'Light' }}
  </button>
</template>
