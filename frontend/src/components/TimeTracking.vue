<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { formatDuration, type TimeEntry } from '../time'

const props = defineProps<{ activities: { id: number; title: string }[] }>()
const emit = defineEmits<{ entriesChanged: [entries: TimeEntry[]] }>()
type Timer = { id: string; activity_id: number; started_at: number }
const timer = ref<Timer | null>(null)
const entries = ref<TimeEntry[]>([])
const selected = ref<number | null>(null)
const ready = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const notice = ref('')
const now = ref(Date.now())
const showManual = ref(false)
const manualActivity = ref<number | null>(null)
const manualStart = ref('')
const hours = ref(0)
const minutes = ref(30)
const elapsed = computed(() => timer.value ? Math.max(0, Math.floor(now.value / 1000) - timer.value.started_at) : 0)
let interval: ReturnType<typeof setInterval> | undefined

watch(() => props.activities, (activities) => {
  if (!activities.some(activity => activity.id === selected.value)) selected.value = activities[0]?.id ?? null
}, { immediate: true, deep: true })

function activityTitle(id: number) {
  return props.activities.find(activity => activity.id === id)?.title ?? `Activity ${id}`
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (HTTP ${response.status}).`)
  }
  return response.json()
}

async function refresh() {
  ready.value = false
  const [savedTimer, savedEntries] = await Promise.all([
    request<Timer | null>('/api/timer'), request<TimeEntry[]>('/api/time-entries'),
  ])
  timer.value = savedTimer
  entries.value = savedEntries
  now.value = Date.now()
  emit('entriesChanged', savedEntries)
  ready.value = true
}

async function reload() {
  busy.value = true
  error.value = null
  try { await refresh() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load tracking.' }
  finally { busy.value = false }
}

async function toggleTimer() {
  busy.value = true
  error.value = null
  notice.value = ''
  try {
    if (timer.value) {
      await request<TimeEntry>(`/api/timer/${timer.value.id}/stop`, { method: 'POST' })
      notice.value = 'Timer stopped. Time saved.'
    } else {
      await request<Timer>('/api/timer/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: selected.value }),
      })
      notice.value = 'Timer started.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Timer request failed.'
  } finally {
    // Reconcile with the server even when a response is lost or another tab changes the timer.
    try { await refresh() }
    catch { error.value = 'Could not confirm timer state. Retry loading before continuing.' }
    busy.value = false
  }
}

function openManual() {
  showManual.value = !showManual.value
  manualActivity.value = selected.value
  error.value = null
  notice.value = ''
}

async function saveManual() {
  const start = new Date(manualStart.value)
  const duration = hours.value * 3600 + minutes.value * 60
  if (!manualActivity.value || !Number.isFinite(start.getTime()) || !Number.isInteger(duration)
    || duration < 60 || duration > 86400 || start.getTime() + duration * 1000 > Date.now()) {
    error.value = 'Choose an activity and a past start time. Duration must be 1 minute to 24 hours and finish in the past.'
    return
  }
  busy.value = true
  error.value = null
  notice.value = ''
  try {
    await request<TimeEntry>('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: manualActivity.value, started_at: start.toISOString(), duration_seconds: duration }),
    })
    showManual.value = false
    manualStart.value = ''
    hours.value = 0
    minutes.value = 30
    notice.value = 'Manual entry saved.'
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not save manual entry.'
  } finally { busy.value = false }
}

onMounted(() => {
  void reload()
  interval = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => { if (interval !== undefined) clearInterval(interval) })
</script>

<template>
  <section class="tracking" aria-labelledby="tracking-heading">
    <div class="tracking-heading">
      <div>
        <h2 id="tracking-heading">{{ timer ? 'Currently tracking' : 'Time tracking' }}</h2>
        <p class="muted">{{ timer ? activityTitle(timer.activity_id) : 'Choose an activity to record time' }}</p>
      </div>
      <div class="timer" aria-label="Elapsed time">{{ formatDuration(elapsed) }}</div>
    </div>
    <label class="tracking-select">Activity
      <select v-model="selected" :disabled="busy || !!timer || !ready">
        <option v-if="!activities.length" :value="null">Create an activity first</option>
        <option v-for="activity in activities" :key="activity.id" :value="activity.id">{{ activity.title }}</option>
      </select>
    </label>
    <div class="tracking-actions">
      <button class="timer-button" data-testid="timer-toggle" :disabled="busy || !ready || (!timer && !selected)" @click="toggleTimer">
        {{ busy ? 'Working…' : timer ? 'Stop & save' : 'Build timer' }}
      </button>
      <button class="manual-button" :disabled="busy || !ready || !activities.length" @click="openManual">{{ showManual ? 'Close entry' : 'Manual entry' }}</button>
    </div>
    <p v-if="!ready && !error" class="muted">Loading tracking…</p>
    <div v-if="error" class="tracking-error">
      <p role="alert">{{ error }}</p>
      <button v-if="!ready" class="connection-button" :disabled="busy" @click="reload">Retry tracking</button>
    </div>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <form v-if="showManual" class="activity-form manual-form" @submit.prevent="saveManual">
      <label>Activity<select v-model="manualActivity" :disabled="busy" required>
        <option v-for="activity in activities" :key="activity.id" :value="activity.id">{{ activity.title }}</option>
      </select></label>
      <label>Start date and time<input v-model="manualStart" name="started_at" type="datetime-local" required :disabled="busy" /></label>
      <div class="duration-fields">
        <label>Hours<input v-model.number="hours" name="hours" type="number" min="0" max="24" step="1" required :disabled="busy" /></label>
        <label>Minutes<input v-model.number="minutes" name="minutes" type="number" min="0" max="59" step="1" required :disabled="busy" /></label>
      </div>
      <button class="save-button" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save time entry' }}</button>
    </form>
    <div v-if="entries.length" class="recent-entries">
      <h3>Recent time entries</h3>
      <ul>
        <li v-for="entry in entries.slice(0, 5)" :key="entry.id">
          <span>{{ activityTitle(entry.activity_id) }}<small>{{ new Date(entry.started_at * 1000).toLocaleString() }} · {{ entry.source }}</small></span>
          <strong>{{ formatDuration(entry.duration_seconds) }}</strong>
        </li>
      </ul>
    </div>
  </section>
</template>
