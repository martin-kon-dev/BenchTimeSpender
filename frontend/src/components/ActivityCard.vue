<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { json, request, type Activity, type Category } from '../api'
import { formatDuration, formatSavedTime, timeTotals } from '../time'
import type { Tracker } from '../useTracker'
import CategoryBadge from './CategoryBadge.vue'

const props = defineProps<{ activity: Activity; categories: Category[]; expanded: boolean; tracker: Tracker }>()
const emit = defineEmits<{ expand: []; changed: []; delete: []; start: [] }>()
const running = computed(() => props.tracker.state.timer?.activity_id === props.activity.id)
const totals = computed(() => timeTotals(props.tracker.state.entries.filter(e => e.activity_id === props.activity.id), running.value ? props.tracker.state.timer : null, new Date(props.tracker.state.now)))
const elapsed = computed(() => running.value ? Math.max(0, Math.floor(props.tracker.state.now / 1000) - props.tracker.state.timer!.started_at) : 0)
const start = ref(''), hours = ref(0), minutes = ref(30), note = ref(''), manualError = ref(''), editing = ref(false), saving = ref(false), error = ref('')
const editTitle = ref(''), editDescription = ref(''), editCategory = ref<number | null>(null), editCompletion = ref(0)
const editDirty = computed(() => editTitle.value !== props.activity.title || editDescription.value !== props.activity.description || editCategory.value !== props.activity.category_id || editCompletion.value !== props.activity.completion_percentage)
const discardEdit = ref(false)
const manualForm = ref<HTMLFormElement | null>(null), manualErrorField = ref<'start' | 'duration'>('start')
function beginEdit() { if (editing.value) return; editing.value = true; error.value = ''; editTitle.value = props.activity.title; editDescription.value = props.activity.description; editCategory.value = props.activity.category_id; editCompletion.value = props.activity.completion_percentage }
function cancelEdit() { if (editDirty.value) discardEdit.value = true; else editing.value = false }
async function update(body: object) {
  if (saving.value) return
  saving.value = true; error.value = ''
  try { await request(`/api/activities/${props.activity.id}`, json('PATCH', body)); editing.value = false; emit('changed') }
  catch (cause) { error.value = (cause as Error).message }
  finally { saving.value = false }
}
function defaultStart() {
  if (start.value) return
  const date = new Date(Date.now() - 1800000)
  start.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
async function saveManual() {
  if (props.tracker.state.busy || !props.tracker.state.ready) return
  manualError.value = ''
  const date = new Date(start.value), duration = hours.value * 3600 + minutes.value * 60
  manualErrorField.value = 'start'
  if (!Number.isInteger(hours.value) || !Number.isInteger(minutes.value) || hours.value < 0 || hours.value > 24 || minutes.value < 0 || minutes.value > 59 || duration < 60 || duration > 86400) { manualError.value = 'Enter 1 minute to 24 hours; minutes must be between 0 and 59.'; manualErrorField.value = 'duration' }
  else if (!Number.isFinite(date.getTime())) manualError.value = 'Enter a valid start date and time.'
  else if (date.getTime() + duration * 1000 > Date.now()) manualError.value = 'The entry must finish in the past. Choose an earlier start.'
  if (manualError.value) { await nextTick(); manualForm.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(); return }
  if (await props.tracker.manual({ activity_id: props.activity.id, started_at: date.toISOString(), duration_seconds: duration, note: note.value.trim() })) { start.value = ''; note.value = ''; hours.value = 0; minutes.value = 30 }
}
defineExpose({ hasDraft: () => !!(note.value || start.value || (editing.value && editDirty.value)) })
</script>

<template>
  <li class="activity-card" :class="{ expanded, running }">
    <div class="card-summary">
      <button class="disclosure" :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${activity.title}`" :aria-expanded="expanded" :aria-controls="`details-${activity.id}`" @click="emit('expand'); defaultStart()"><span aria-hidden="true">{{ expanded ? '⌄' : '›' }}</span></button>
      <div class="activity-copy"><h3>{{ activity.title }}</h3><div class="card-meta"><CategoryBadge :category="categories.find(c => c.id === activity.category_id)" /><span class="state-label">{{ running ? 'Tracking' : activity.completion_percentage === 100 ? 'Completed' : `${activity.completion_percentage}% complete` }}</span></div></div>
      <dl class="card-totals"><div><dt>Today</dt><dd>{{ tracker.state.ready ? formatSavedTime(totals.today) : '—' }}</dd></div><div><dt>This week</dt><dd>{{ tracker.state.ready ? formatSavedTime(totals.week) : '—' }}</dd></div><div><dt>Overall</dt><dd>{{ tracker.state.ready ? formatSavedTime(totals.overall) : '—' }}</dd></div></dl>
    </div>
    <div v-show="expanded" :id="`details-${activity.id}`" class="card-expanded">
      <p v-if="activity.description" class="description">{{ activity.description }}</p>
      <div class="inline-tracking">
        <section class="timer-panel" :aria-label="`Timer for ${activity.title}`"><h4>{{ running ? 'Running timer' : 'Focus session' }}</h4><div class="timer" role="timer" aria-label="Elapsed time">{{ formatDuration(elapsed) }}</div><button class="primary" :class="{ 'stop-button': running }" :disabled="tracker.state.busy || !tracker.state.ready || activity.completion_percentage === 100" @click="running ? tracker.stop() : emit('start')">{{ running ? 'Stop & save' : 'Start timer' }}</button></section>
        <form ref="manualForm" class="manual-form" novalidate @submit.prevent="saveManual">
          <h4>Add manual entry</h4>
          <label>Start date and time
            <input v-model="start" type="datetime-local" required :disabled="tracker.state.busy"
              :aria-invalid="!!manualError && manualErrorField === 'start'"
              :aria-describedby="`manual-hint-${activity.id} manual-error-${activity.id}`" @focus="defaultStart" />
          </label>
          <div class="duration-fields">
            <label>Hours<input v-model.number="hours" type="number" min="0" max="24" required :disabled="tracker.state.busy"
              :aria-invalid="!!manualError && manualErrorField === 'duration'" :aria-describedby="`manual-error-${activity.id}`" /></label>
            <label>Minutes<input v-model.number="minutes" type="number" min="0" max="59" required :disabled="tracker.state.busy"
              :aria-invalid="!!manualError && manualErrorField === 'duration'" :aria-describedby="`manual-error-${activity.id}`" /></label>
          </div>
          <label><span>Note <span class="muted">(optional)</span></span>
            <input v-model="note" maxlength="2000" :disabled="tracker.state.busy" placeholder="What did you work on?" />
          </label>
          <p :id="`manual-hint-${activity.id}`" class="muted">Local time · e.g. 0 hours, 30 minutes. The session must have finished.</p>
          <p :id="`manual-error-${activity.id}`" role="alert">{{ manualError }}</p>
          <button class="primary" :disabled="tracker.state.busy || !tracker.state.ready">{{ tracker.state.busy ? 'Working…' : 'Add entry' }}</button>
        </form>
      </div>
      <div class="card-actions"><button :disabled="saving || editing" @click="beginEdit">Edit activity</button><button :disabled="saving || running || editing" @click="update({ completion_percentage: activity.completion_percentage === 100 ? 0 : 100 })">{{ activity.completion_percentage === 100 ? 'Reopen activity' : 'Mark completed' }}</button><button class="delete-button" :aria-label="`Delete activity: ${activity.title}`" :disabled="running || saving" @click="emit('delete')">Delete activity</button></div>
      <p v-if="running" class="muted">Stop and save before completing or deleting this activity.</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <form v-if="editing" class="activity-form edit-form" @submit.prevent="update({ title: editTitle.trim(), description: editDescription.trim(), category_id: editCategory, completion_percentage: editCompletion })"><h4>Edit activity</h4><label>Title<input v-model="editTitle" required maxlength="200" :disabled="saving" /></label><label>Category<select v-model="editCategory" :disabled="saving"><option :value="null">Uncategorized</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label><label>Description<textarea v-model="editDescription" maxlength="2000" :disabled="saving"></textarea></label><label>Completion (%)<input v-model.number="editCompletion" type="number" min="0" max="100" step="1" required :disabled="saving" /></label><div v-if="discardEdit" role="alert"><p>Discard your activity edits?</p><button type="button" @click="discardEdit = false">Keep editing</button><button type="button" @click="editing = false; discardEdit = false">Discard changes</button></div><div class="dialog-actions"><button type="button" :disabled="saving" @click="cancelEdit">Cancel</button><button class="primary" :disabled="saving">Save changes</button></div></form>
    </div>
  </li>
</template>
