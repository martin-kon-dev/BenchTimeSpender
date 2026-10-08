<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TimeTracking from './components/TimeTracking.vue'
import { formatDuration, weeklySeconds, type TimeEntry } from './time'

type HealthResponse = { status: string; message: string }

type Activity = {
  id: number
  title: string
  category: string
  description: string
  completion_percentage: number
}

const activities = ref<Activity[]>([])
const activitiesLoading = ref(true)
const activitiesError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const showForm = ref(false)
const title = ref('')
const category = ref('Learning')
const description = ref('')
const completion = ref(0)
const activeCount = computed(() => activities.value.filter(a => a.completion_percentage < 100).length)
const completedCount = computed(() => activities.value.filter(a => a.completion_percentage === 100).length)
const colors = ['#2da44e', '#527cff', '#a855f7']
const entries = ref<TimeEntry[] | null>(null)
const weeklyTime = computed(() => entries.value === null ? '—' : `${(weeklySeconds(entries.value) / 3600).toFixed(1)}h`)
function activityTime(id: number) {
  return entries.value === null ? '—' : formatDuration(entries.value.filter(entry => entry.activity_id === id)
    .reduce((total, entry) => total + entry.duration_seconds, 0))
}

async function loadActivities() {
  activitiesLoading.value = true
  activitiesError.value = null
  try {
    const response = await fetch('/api/activities')
    if (!response.ok) throw new Error(`Could not load activities (HTTP ${response.status}).`)
    activities.value = await response.json()
  } catch (cause) {
    activitiesError.value = cause instanceof Error ? cause.message : 'Could not load activities.'
  } finally {
    activitiesLoading.value = false
  }
}

async function createActivity() {
  if (!title.value.trim() || !category.value.trim()) {
    saveError.value = 'Title and category are required.'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.value.trim(), category: category.value.trim(),
        description: description.value.trim(), completion_percentage: completion.value,
      }),
    })
    if (!response.ok) throw new Error(`Could not save activity (HTTP ${response.status}). Check the fields and retry.`)
    const activity: Activity = await response.json()
    activities.value.push(activity)
    title.value = ''
    description.value = ''
    completion.value = 0
    showForm.value = false
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : 'Could not save activity.'
  } finally {
    saving.value = false
  }
}

onMounted(loadActivities)

const status = ref<string | null>(null)
const message = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function checkBackend() {
  loading.value = true
  status.value = null
  message.value = null
  error.value = null
  try {
    const response = await fetch('/api/health')
    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`)
    }
    const data: HealthResponse = await response.json()
    status.value = data.status
    message.value = data.message
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

    <dl class="metrics" aria-label="Productivity summary">
      <div><dt>This week</dt><dd title="Saved time since Monday in your local timezone">{{ weeklyTime }}</dd></div>
      <div><dt>Active</dt><dd>{{ activitiesLoading || activitiesError ? '—' : activeCount }}</dd></div>
      <div><dt>Completed</dt><dd class="completed">{{ activitiesLoading || activitiesError ? '—' : completedCount }}</dd></div>
    </dl>

    <section aria-labelledby="activities-heading">
      <div class="section-heading">
        <h2 id="activities-heading">Current activities</h2>
        <button class="connection-button" :disabled="activitiesLoading || !!activitiesError || saving" @click="showForm = !showForm">{{ showForm ? 'Close form' : 'New activity' }}</button>
      </div>
      <form v-if="showForm" class="activity-form" @submit.prevent="createActivity">
        <label>Title<input v-model="title" name="title" required maxlength="200" :disabled="saving" /></label>
        <label>Category<input v-model="category" name="category" required maxlength="100" :disabled="saving" /></label>
        <label>Description<textarea v-model="description" name="description" maxlength="2000" rows="2" :disabled="saving"></textarea></label>
        <label>Completion (%)<input v-model.number="completion" name="completion" type="number" min="0" max="100" step="1" required :disabled="saving" /></label>
        <p v-if="saveError" role="alert">{{ saveError }}</p>
        <button class="save-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save activity' }}</button>
      </form>
      <p v-if="activitiesLoading" class="muted" role="status">Loading activities…</p>
      <div v-else-if="activitiesError" class="load-error">
        <p role="alert">{{ activitiesError }}</p>
        <button class="connection-button" @click="loadActivities">Retry loading</button>
      </div>
      <p v-else-if="!activities.length" class="empty-state">No activities yet. Create your first activity to get started.</p>
      <ul v-else class="activity-list">
        <li v-for="activity in activities" :key="activity.id" class="activity-card">
          <div class="activity-details">
            <div>
              <h3>{{ activity.title }}</h3>
              <p class="muted">{{ activity.category }}</p>
              <p class="muted">{{ activityTime(activity.id) }} recorded</p>
              <p v-if="activity.description" class="activity-description">{{ activity.description }}</p>
            </div>
            <span class="percentage">{{ activity.completion_percentage }}%</span>
          </div>
          <div class="progress-track" role="progressbar" :aria-label="activity.title + ' completion'"
            :aria-valuenow="activity.completion_percentage" :aria-valuemin="0" :aria-valuemax="100">
            <div class="progress-fill" :style="{ width: activity.completion_percentage + '%', backgroundColor: colors[(activity.id - 1) % colors.length] }"></div>
          </div>
        </li>
      </ul>
    </section>

    <TimeTracking :activities="activities" @entries-changed="entries = $event" />

    <footer>
      <p class="muted">Activities and time entries are saved locally. Running timers resume after refresh.</p>
      <div class="backend-check">
        <button class="connection-button" data-testid="backend-check" :disabled="loading" @click="checkBackend">
          {{ loading ? 'Checking…' : 'Check backend' }}
        </button>
        <div class="muted" aria-live="polite">
          <div v-if="status">
            <p>Backend status: <strong>{{ status }}</strong></p>
            <p>{{ message }}</p>
          </div>
          <p v-else-if="error" role="alert">{{ error }}</p>
          <p v-else-if="!loading">Ready to check the connection.</p>
        </div>
      </div>
    </footer>
  </main>
</template>
