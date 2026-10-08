<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppDialog from './components/AppDialog.vue'
import TimeTracking from './components/TimeTracking.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import { formatDuration, weeklySeconds, type TimeEntry } from './time'

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
const entries = ref<TimeEntry[] | null>(null)
const tracking = ref<InstanceType<typeof TimeTracking> | null>(null)
const runningActivity = ref<number | null>(null)
const deleting = ref(false)
const deleteTarget = ref<Activity | null>(null)
const deleteError = ref<string | null>(null)
const notice = ref('')
const activeCount = computed(() => activities.value.filter(a => a.completion_percentage < 100).length)
const completedCount = computed(() => activities.value.filter(a => a.completion_percentage === 100).length)
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
  } finally { activitiesLoading.value = false }
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.value.trim(), category: category.value.trim(),
        description: description.value.trim(), completion_percentage: completion.value }),
    })
    if (!response.ok) throw new Error(`Could not save activity (HTTP ${response.status}). Check the fields and retry.`)
    activities.value.push(await response.json())
    title.value = ''
    description.value = ''
    completion.value = 0
    showForm.value = false
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : 'Could not save activity.'
  } finally { saving.value = false }
}

function confirmDelete(activity: Activity) {
  deleteError.value = null
  deleteTarget.value = activity
  notice.value = ''
}

async function deleteActivity() {
  if (!deleteTarget.value || deleting.value) return
  const activity = deleteTarget.value
  deleting.value = true
  deleteError.value = null
  try {
    const response = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' })
    // Another tab may already have deleted it; reconcile the local list in either case.
    if (!response.ok && response.status !== 404) {
      const body = await response.json().catch(() => null)
      throw new Error(typeof body?.detail === 'string' ? body.detail : `Could not delete activity (HTTP ${response.status}).`)
    }
    activities.value = activities.value.filter(item => item.id !== activity.id)
    if (entries.value) entries.value = entries.value.filter(entry => entry.activity_id !== activity.id)
    deleteTarget.value = null
    notice.value = `Deleted “${activity.title}” and its recorded time.`
    await tracking.value?.reload()
  } catch (cause) {
    deleteError.value = cause instanceof Error ? cause.message : 'Could not delete activity.'
  } finally { deleting.value = false }
}

onMounted(loadActivities)
</script>

<template>
  <main class="dashboard">
    <header class="dashboard-header">
      <div>
        <div class="brand">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" />
          </svg>
          <h1>BenchTime</h1>
        </div>
        <p class="subtitle">Make your bench time count.</p>
      </div>
      <div class="header-actions">
      <ThemeToggle />
      <button class="connection-button" :disabled="activitiesLoading || !!activitiesError || saving || deleting"
        @click="saveError = null; showForm = true">New activity</button>
      </div>
    </header>

    <dl class="metrics" aria-label="Productivity summary">
      <div><dt>This week</dt><dd title="Saved time since Monday in your local timezone">{{ weeklyTime }}</dd></div>
      <div><dt>Active</dt><dd>{{ activitiesLoading || activitiesError ? '—' : activeCount }}</dd></div>
      <div><dt>Completed</dt><dd>{{ activitiesLoading || activitiesError ? '—' : completedCount }}</dd></div>
    </dl>

    <TimeTracking ref="tracking" :activities="activities" @entries-changed="entries = $event"
      @timer-changed="runningActivity = $event" />

    <section aria-labelledby="activities-heading">
      <div class="section-heading"><h2 id="activities-heading">Ongoing activities</h2></div>
      <p v-if="activitiesLoading" class="muted" role="status">Loading activities…</p>
      <div v-else-if="activitiesError" class="load-error">
        <p role="alert">{{ activitiesError }}</p>
        <button class="connection-button" @click="loadActivities">Retry loading</button>
      </div>
      <p v-else-if="!activities.length" class="empty-state">No activities yet. Create your first activity to get started.</p>
      <ul v-else class="activity-list">
        <li v-for="activity in activities" :key="activity.id" class="activity-card">
          <div class="activity-details">
            <div class="activity-copy">
              <h3>{{ activity.title }}</h3>
              <p class="muted">{{ activity.category }} · {{ activityTime(activity.id) }} recorded</p>
            </div>
            <div class="activity-actions">
              <span class="percentage">{{ activity.completion_percentage }}%</span>
              <button class="delete-button" :aria-label="'Delete activity: ' + activity.title"
                :disabled="deleting || runningActivity === activity.id"
                :title="runningActivity === activity.id ? 'Stop and save the timer before deleting this activity.' : undefined"
                @click="confirmDelete(activity)">Delete</button>
            </div>
          </div>
          <div class="progress-track" role="progressbar" :aria-label="activity.title + ' completion'"
            :aria-valuenow="activity.completion_percentage" :aria-valuemin="0" :aria-valuemax="100">
            <div class="progress-fill" :style="{ width: activity.completion_percentage + '%' }"></div>
          </div>
          <details v-if="activity.description" class="activity-description"><summary>Notes</summary><p>{{ activity.description }}</p></details>
        </li>
      </ul>
      <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    </section>

    <details v-if="entries?.length" class="recent-entries">
      <summary>Recent time entries</summary>
      <ul><li v-for="entry in entries.slice(0, 5)" :key="entry.id">
        <span>{{ activities.find(activity => activity.id === entry.activity_id)?.title ?? 'Activity unavailable' }}
          <small>{{ new Date(entry.started_at * 1000).toLocaleString() }} · {{ entry.source }}</small></span>
        <strong>{{ formatDuration(entry.duration_seconds) }}</strong>
      </li></ul>
    </details>

    <AppDialog v-if="showForm" title="New activity" :busy="saving" @close="showForm = false">
      <form class="activity-form" @submit.prevent="createActivity">
        <label>Title<input v-model="title" name="title" required maxlength="200" :disabled="saving" /></label>
        <label>Category<input v-model="category" name="category" required maxlength="100" :disabled="saving" /></label>
        <label>Description<textarea v-model="description" name="description" maxlength="2000" rows="2" :disabled="saving"></textarea></label>
        <label>Completion (%)<input v-model.number="completion" name="completion" type="number" min="0" max="100" step="1" required :disabled="saving" /></label>
        <p v-if="saveError" role="alert">{{ saveError }}</p>
        <div class="dialog-actions"><button class="connection-button" type="button" :disabled="saving" @click="showForm = false">Cancel</button>
          <button class="save-button" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save activity' }}</button></div>
      </form>
    </AppDialog>
    <AppDialog v-if="deleteTarget" title="Delete activity?" :busy="deleting" @close="deleteTarget = null">
      <p class="delete-warning">Delete “{{ deleteTarget.title }}” and all its recorded time? This cannot be undone.</p>
      <p v-if="deleteError" role="alert">{{ deleteError }}</p>
      <div class="dialog-actions"><button class="connection-button" :disabled="deleting" @click="deleteTarget = null">Cancel</button>
        <button class="delete-button" data-testid="confirm-delete" :disabled="deleting" @click="deleteActivity">{{ deleting ? 'Deleting…' : 'Delete activity' }}</button></div>
    </AppDialog>
  </main>
</template>
