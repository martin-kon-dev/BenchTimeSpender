<script setup lang="ts">
import { ref } from 'vue'

type HealthResponse = { status: string }

const activities = [
  { id: 1, title: 'Learn Python / FastAPI', category: 'Learning', time: '14h 30m', progress: 65, color: '#2da44e' },
  { id: 2, title: 'Build personal portfolio', category: 'Personal project', time: '8h 15m', progress: 40, color: '#527cff' },
  { id: 3, title: 'Azure certification', category: 'Certification', time: '12h 00m', progress: 25, color: '#a855f7' },
]

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
  <main class="dashboard">
    <header class="dashboard-header">
      <div class="brand">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" />
        </svg>
        <h1>BenchTime</h1>
      </div>
      <span class="badge">Dashboard</span>
    </header>
    <p class="subtitle">Your personal bench productivity dashboard</p>

    <dl class="metrics" aria-label="Example productivity summary">
      <div><dt>This week</dt><dd>24.5h</dd></div>
      <div><dt>Active</dt><dd>4</dd></div>
      <div><dt>Completed</dt><dd class="completed">3</dd></div>
    </dl>

    <section aria-labelledby="activities-heading">
      <div class="section-heading">
        <h2 id="activities-heading">Current activities</h2>
        <span class="muted">Example data</span>
      </div>
      <ul class="activity-list">
        <li v-for="activity in activities" :key="activity.id" class="activity-card">
          <div class="activity-details">
            <div>
              <h3>{{ activity.title }}</h3>
              <p class="muted">{{ activity.category }} · {{ activity.time }} spent</p>
            </div>
            <span class="percentage">{{ activity.progress }}%</span>
          </div>
          <div class="progress-track" role="progressbar" :aria-label="activity.title + ' completion'"
            :aria-valuenow="activity.progress" :aria-valuemin="0" :aria-valuemax="100">
            <div class="progress-fill" :style="{ width: activity.progress + '%', backgroundColor: activity.color }"></div>
          </div>
        </li>
      </ul>
    </section>

    <section class="tracking" aria-labelledby="tracking-heading">
      <div class="tracking-heading">
        <div>
          <h2 id="tracking-heading">Currently tracking</h2>
          <p class="muted">Learn Python / FastAPI</p>
        </div>
        <div class="timer" aria-label="Example elapsed time: 1 hour 24 minutes 35 seconds">
          <svg class="icon timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="14" r="7" /><path d="M9 3h6M12 7V5m0 6v4" />
          </svg>
          <span>01:24:35</span>
        </div>
      </div>
      <div class="tracking-actions">
        <button class="timer-button" disabled title="Timer functionality is coming in a later milestone">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" />
          </svg>
          Build timer
        </button>
        <button class="manual-button" disabled title="Manual entries are coming in a later milestone">Manual entry</button>
      </div>
    </section>

    <footer>
      <p class="muted">Dashboard preview · example data. Tracking controls are coming next.</p>
      <div class="backend-check">
        <button class="connection-button" data-testid="backend-check" :disabled="loading" @click="checkBackend">
          {{ loading ? 'Checking…' : 'Check backend' }}
        </button>
        <div class="muted" aria-live="polite">
          <p v-if="status">Backend status: <strong>{{ status }}</strong></p>
          <p v-else-if="error" role="alert">{{ error }}</p>
          <p v-else-if="!loading">Ready to check the connection.</p>
        </div>
      </div>
    </footer>
  </main>
</template>
