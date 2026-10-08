<script setup lang="ts">
import { ref } from 'vue'

type HealthResponse = { status: string }

const status = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function checkBackend() {
  loading.value = true
  status.value = null
  error.value = null
  try {
    const response = await fetch('/api/health')
    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`)
    }
    const data: HealthResponse = await response.json()
    status.value = data.status
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not reach the backend'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <h1>BenchTimeSpender</h1>
    <p>Project foundation: Vue talks to FastAPI.</p>
    <button :disabled="loading" @click="checkBackend">
      {{ loading ? 'Checking…' : 'Check backend' }}
    </button>
    <div aria-live="polite">
      <p v-if="status">Backend status: <strong>{{ status }}</strong></p>
      <p v-else-if="error" role="alert">{{ error }}</p>
      <p v-else-if="!loading">Ready to check the connection.</p>
    </div>
  </main>
</template>
