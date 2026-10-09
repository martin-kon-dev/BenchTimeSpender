<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { formatDuration, formatSavedTime, type TimeEntry } from '../time'
import AppDialog from './AppDialog.vue'

const props = defineProps<{ activities: { id: number; title: string }[] }>()
const emit = defineEmits<{ entriesChanged: [entries: TimeEntry[]]; timerChanged: [activityId: number | null] }>()
type Timer = { id: string; activity_id: number; started_at: number }
const timer = ref<Timer | null>(null)
const selected = ref<number | null>(null)
const ready = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const notice = ref('')
const now = ref(Date.now())
const showManual = ref(false)
const manualError = ref<string | null>(null)
const activityError = ref<string | null>(null)
const startError = ref<string | null>(null)
const durationError = ref<string | null>(null)
const activityInput = ref<HTMLSelectElement | null>(null)
const startInput = ref<HTMLInputElement | null>(null)
const hoursInput = ref<HTMLInputElement | null>(null)
const minutesInput = ref<HTMLInputElement | null>(null)
const manualActivity = ref<number | null>(null)
const manualStart = ref('')
const hours = ref(0)
const minutes = ref(30)
const elapsed = computed(() => timer.value ? Math.max(0, Math.floor(now.value / 1000) - timer.value.started_at) : 0)
let interval: ReturnType<typeof setInterval> | undefined

watch(() => props.activities, (activities) => {
  if (!activities.some(activity => activity.id === selected.value)) selected.value = activities[0]?.id ?? null
  if (!activities.some(activity => activity.id === manualActivity.value)) manualActivity.value = selected.value
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
  if (savedTimer) selected.value = savedTimer.activity_id
  now.value = Date.now()
  emit('entriesChanged', savedEntries)
  emit('timerChanged', savedTimer?.activity_id ?? null)
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
      const entry = await request<TimeEntry>(`/api/timer/${timer.value.id}/stop`, { method: 'POST' })
      notice.value = `Saved ${formatSavedTime(entry.duration_seconds)} to ${activityTitle(entry.activity_id)}.`
    } else {
      await request<Timer>('/api/timer/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: selected.value }),
      })
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
  showManual.value = true
  if (!manualStart.value) {
    manualActivity.value = timer.value?.activity_id ?? selected.value
    const start = new Date(Date.now() - 30 * 60 * 1000)
    manualStart.value = new Date(start.getTime() - start.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16)
  }
  manualError.value = null
  activityError.value = null
  startError.value = null
  durationError.value = null
  notice.value = ''
}

async function saveManual() {
  manualError.value = null
  activityError.value = null
  startError.value = null
  durationError.value = null
  const start = new Date(manualStart.value)
  const duration = hours.value * 3600 + minutes.value * 60
  if (!props.activities.some(activity => activity.id === manualActivity.value)) activityError.value = 'Choose an activity.'
  if (!Number.isInteger(hours.value) || hours.value < 0 || hours.value > 24
    || !Number.isInteger(minutes.value) || minutes.value < 0 || minutes.value > 59
    || duration < 60 || duration > 86400) durationError.value = 'Use a duration between 1 minute and 24 hours, with minutes from 0 to 59.'
  if (!Number.isFinite(start.getTime())) startError.value = 'Enter a start date and time.'
  else if (!durationError.value && start.getTime() + duration * 1000 > Date.now()) startError.value = 'Choose an earlier start: this session would finish in the future.'
  if (activityError.value || durationError.value || startError.value) {
    await nextTick()
    if (activityError.value) activityInput.value?.focus()
    else if (startError.value) startInput.value?.focus()
    else if (!Number.isInteger(minutes.value) || minutes.value < 0 || minutes.value > 59) minutesInput.value?.focus()
    else hoursInput.value?.focus()
    return
  }
  busy.value = true
  manualError.value = null
  notice.value = ''
  try {
    const entry = await request<TimeEntry>('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: manualActivity.value, started_at: start.toISOString(), duration_seconds: duration }),
    })
    showManual.value = false
    manualStart.value = ''
    hours.value = 0
    minutes.value = 30
    notice.value = `Saved ${formatSavedTime(entry.duration_seconds)} to ${activityTitle(entry.activity_id)}.`
    try { await refresh() }
    catch { error.value = 'Entry saved, but could not reload tracking. Retry loading before continuing.' }
  } catch (cause) {
    manualError.value = cause instanceof Error ? cause.message : 'Could not save manual entry.'
  } finally { busy.value = false }
}

onMounted(() => {
  void reload()
  interval = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => { if (interval !== undefined) clearInterval(interval) })
defineExpose({ reload })
</script>

<template>
  <section class="tracking" aria-labelledby="tracking-heading">
    <div class="tracking-heading">
      <div>
        <h2 id="tracking-heading">{{ timer ? 'Currently tracking' : 'Your next focus session' }}</h2>
      </div>
      <button class="manual-button quiet-button" :disabled="busy || !ready || !activities.length" @click="openManual">Add time manually</button>
    </div>
    <div class="tracking-actions">
      <div class="session-field">
      <label v-if="!timer" for="timer-activity">Activity</label>
      <select v-show="!timer" id="timer-activity" v-model="selected" aria-label="Activity to track" :disabled="busy || !!timer || !ready">
        <option v-if="!activities.length" :value="null">Create an activity first</option>
        <option v-for="activity in activities" :key="activity.id" :value="activity.id">{{ activity.title }}</option>
      </select>
      <p v-if="timer" class="running-title">{{ activityTitle(timer.activity_id) }}</p>
      </div>
      <div class="timer" role="timer" aria-label="Elapsed time">{{ formatDuration(elapsed) }}</div>
      <button class="timer-button" data-testid="timer-toggle" :disabled="busy || !ready || (!timer && !selected)" @click="toggleTimer">
        {{ busy ? 'Working…' : timer ? 'Stop & save' : 'Start timer' }}
      </button>
    </div>
    <p v-if="!ready && !error" class="muted">Loading tracking…</p>
    <div v-if="error" class="tracking-error">
      <p role="alert">{{ error }}</p>
      <button v-if="!ready" class="connection-button" :disabled="busy" @click="reload">Retry tracking</button>
    </div>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <AppDialog v-if="showManual" title="Add time manually" :busy="busy" @close="showManual = false">
    <form class="activity-form" novalidate @submit.prevent="saveManual">
      <label>Activity<select ref="activityInput" v-model="manualActivity" :disabled="busy" required
        :aria-invalid="activityError ? true : undefined" :aria-describedby="activityError ? 'manual-activity-error' : undefined">
        <option v-for="activity in activities" :key="activity.id" :value="activity.id">{{ activity.title }}</option>
      </select></label>
      <p v-if="activityError" id="manual-activity-error" role="alert">{{ activityError }}</p>
      <label>Start date and time<input ref="startInput" v-model="manualStart" name="started_at" type="datetime-local" required :disabled="busy"
        :aria-invalid="startError ? true : undefined" :aria-describedby="startError ? 'manual-time-hint manual-start-error' : 'manual-time-hint'" /></label>
      <p id="manual-time-hint" class="muted">Use your local time. The session must have finished.</p>
      <p v-if="startError" id="manual-start-error" role="alert">{{ startError }}</p>
      <div class="duration-fields">
        <label>Hours<input ref="hoursInput" v-model.number="hours" name="hours" type="number" min="0" max="24" step="1" required :disabled="busy"
          :aria-invalid="durationError ? true : undefined" :aria-describedby="durationError ? 'manual-duration-error' : undefined" /></label>
        <label>Minutes<input ref="minutesInput" v-model.number="minutes" name="minutes" type="number" min="0" max="59" step="1" required :disabled="busy"
          :aria-invalid="durationError ? true : undefined" :aria-describedby="durationError ? 'manual-duration-error' : undefined" /></label>
      </div>
      <p v-if="durationError" id="manual-duration-error" role="alert">{{ durationError }}</p>
      <p v-if="manualError" role="alert">{{ manualError }}</p>
      <div class="dialog-actions"><button class="connection-button" type="button" :disabled="busy" @click="showManual = false">Cancel</button>
        <button class="save-button" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save time' }}</button></div>
    </form>
    </AppDialog>
  </section>
</template>
