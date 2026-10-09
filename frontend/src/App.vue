<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { json, matchesActivity, request, type Activity, type Category } from './api'
import { formatDuration, formatSavedTime, timeTotals, weeklySeconds } from './time'
import { useTracker } from './useTracker'
import ActivityCard from './components/ActivityCard.vue'
import AppDialog from './components/AppDialog.vue'
import CategoryDialog from './components/CategoryDialog.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const activities = ref<Activity[]>([]), categories = ref<Category[]>([]), loading = ref(true), error = ref('')
const search = ref(''), category = ref('all'), completed = ref(false), expanded = ref<number | null>(null)
const tracker = useTracker()
const showCategories = ref(false), showCreate = ref(false), saving = ref(false), saveError = ref('')
const title = ref(''), description = ref(''), newCategory = ref<number | null>(null), completion = ref(0)
const createDialog = ref<InstanceType<typeof AppDialog> | null>(null)
const deleteTarget = ref<Activity | null>(null), deleting = ref(false), deleteError = ref(''), notice = ref('')
const switchTarget = ref<Activity | null>(null)
const cards = ref<Record<number, InstanceType<typeof ActivityCard>>>({})
const activeCount = computed(() => activities.value.filter(a => a.completion_percentage < 100).length)
const completedCount = computed(() => activities.value.length - activeCount.value)
const matches = (a: Activity) => matchesActivity(a, search.value, category.value, completed.value)
const visibleCount = computed(() => activities.value.filter(matches).length)
const runningActivity = computed(() => activities.value.find(a => a.id === tracker.state.timer?.activity_id))
const elapsed = computed(() => tracker.state.timer ? Math.max(0, Math.floor(tracker.state.now / 1000) - tracker.state.timer.started_at) : 0)
// "Saved this week" retains its saved-only definition; card totals include live elapsed time.
const week = computed(() => tracker.state.ready ? formatSavedTime(weeklySeconds(tracker.state.entries, new Date(tracker.state.now))) : '—')
const liveWeek = computed(() => timeTotals(tracker.state.entries, tracker.state.timer, new Date(tracker.state.now)).week)
async function load() {
  error.value = ''
  try {
    const [nextActivities, nextCategories] = await Promise.all([request<Activity[]>('/api/activities'), request<Category[]>('/api/categories')])
    activities.value = nextActivities; categories.value = nextCategories
    if (category.value !== 'all' && category.value !== 'uncategorized' && !nextCategories.some(c => c.id === Number(category.value))) category.value = 'all'
  } catch (cause) { error.value = (cause as Error).message }
  finally { loading.value = false }
}
function reset() { search.value = ''; category.value = 'all' }
function revealTimer() { reset(); completed.value = false; expanded.value = runningActivity.value?.id ?? null }
function start(activity: Activity) { if (tracker.state.timer) switchTarget.value = activity; else void tracker.start(activity.id) }
async function switchTimer() {
  const target = switchTarget.value
  if (target && await tracker.stop()) { switchTarget.value = null; await tracker.start(target.id) }
}
async function create() {
  if (saving.value) return
  saving.value = true; saveError.value = ''
  try {
    const activity = await request<Activity>('/api/activities', json('POST', { title: title.value.trim(), description: description.value.trim(), category_id: newCategory.value, completion_percentage: completion.value }))
    showCreate.value = false; title.value = ''; description.value = ''; completion.value = 0; newCategory.value = null
    reset(); completed.value = activity.completion_percentage === 100; expanded.value = activity.id; await load()
  } catch (cause) { saveError.value = (cause as Error).message }
  finally { saving.value = false }
}
async function remove() {
  const target = deleteTarget.value
  if (!target || deleting.value) return
  deleting.value = true; deleteError.value = ''
  try {
    await request(`/api/activities/${target.id}`, { method: 'DELETE' })
    deleteTarget.value = null; notice.value = `Deleted “${target.title}” and its recorded time.`
    await Promise.all([load(), tracker.reload()])
  } catch (cause) { deleteError.value = (cause as Error).message }
  finally { deleting.value = false }
}
onMounted(load)
</script>

<template>
  <header class="site-header"><div class="header-inner"><div class="brand"><h1>BenchTime</h1><p class="muted">Your time, at a glance</p></div><ThemeToggle /></div></header>
  <main class="dashboard">
    <div class="page-heading"><div><h2>Activities</h2><p class="muted">Make room for what matters.</p></div><button class="primary" :disabled="loading || !!error" @click="showCreate = true; saveError = ''"><span aria-hidden="true">＋</span> New activity</button></div>
    <dl class="metrics" aria-label="Productivity summary"><div><span class="metric-icon violet" aria-hidden="true">◷</span><div><dt>Saved this week</dt><dd>{{ week }}</dd></div></div><div><span class="metric-icon green" aria-hidden="true">▷</span><div><dt>Active</dt><dd>{{ loading || error ? '—' : activeCount }}</dd></div></div><div><span class="metric-icon blue" aria-hidden="true">✓</span><div><dt>Completed</dt><dd>{{ loading || error ? '—' : completedCount }}</dd></div></div></dl>
    <div class="toolbar">
      <label class="search-field"><span class="sr-only">Search activities</span><input v-model="search" type="search" placeholder="Search activities" /></label>
      <label class="category-filter"><span class="sr-only">Filter by category</span>
        <select v-model="category" aria-label="Filter by category">
          <option value="all">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)" :style="{ '--category-color': c.color }">{{ c.name }}</option>
          <option value="uncategorized">Uncategorized</option>
        </select>
      </label>
      <button :disabled="loading || !!error" @click="showCategories = true">Manage categories</button>
    </div>
    <nav class="view-tabs" aria-label="Activity status"><button :class="{ selected: !completed }" :aria-pressed="!completed" @click="completed = false">Active <span>{{ activeCount }}</span></button><button :class="{ selected: completed }" :aria-pressed="completed" @click="completed = true">Completed <span>{{ completedCount }}</span></button><button v-if="search || category !== 'all'" class="reset-button" @click="reset">Reset filters</button></nav>
    <div v-if="runningActivity" class="running-banner"><div><span class="live-dot" aria-hidden="true"></span><strong>{{ runningActivity.title }}</strong><span class="muted">{{ formatDuration(elapsed) }}</span></div><div class="banner-actions"><button @click="revealTimer">Show timer</button><button :disabled="tracker.state.busy || !tracker.state.ready" @click="tracker.stop">Stop & save</button></div></div>
    <p v-if="tracker.state.timer" class="sr-only">This week including the running session: {{ formatSavedTime(liveWeek) }}. Activity totals include running time.</p>
    <div v-if="tracker.state.error" class="error-state"><p role="alert">{{ tracker.state.error }}</p><button :disabled="tracker.state.busy" @click="tracker.reload">Reload tracking</button></div>
    <p v-if="tracker.state.notice" class="notice" role="status">{{ tracker.state.notice }}</p>
    <p v-if="loading" class="empty-state" role="status">Loading activities…</p>
    <div v-else-if="error" class="empty-state"><p role="alert">{{ error }}</p><button @click="load">Retry loading</button></div>
    <section v-show="!loading && !error" aria-label="Activities">
      <div v-if="!loading && !error && !activities.length" class="empty-state">
        <h3>Your next focus starts here</h3><p>Create your first activity, then start a timer or add time manually.</p>
      </div>
      <div v-else-if="!loading && !error && !visibleCount" class="empty-state">
        <h3>{{ search || category !== 'all' ? 'No matching activities' : completed ? 'No completed activities yet' : 'No active activities' }}</h3>
        <p>{{ search || category !== 'all' ? 'Try another search or category.' : 'Activities will appear here as their status changes.' }}</p>
        <button v-if="search || category !== 'all'" @click="reset">Reset filters</button>
      </div>
      <ul class="activity-list"><ActivityCard v-for="a in activities" v-show="matches(a)" :key="a.id" :ref="el => { if (el) cards[a.id] = el as InstanceType<typeof ActivityCard> }" :activity="a" :categories="categories" :expanded="expanded === a.id" :tracker="tracker" @expand="expanded = expanded === a.id ? null : a.id" @start="start(a)" @changed="load" @delete="deleteTarget = a; deleteError = ''" /></ul>
    </section>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p class="page-footnote">Activity totals include running time. Weeks start on Monday in your local timezone.</p>
    <CategoryDialog v-if="showCategories" :categories="categories" @close="showCategories = false" @changed="load" />
    <AppDialog v-if="showCreate" ref="createDialog" title="New activity" :busy="saving" :dirty="!!title || !!description || newCategory !== null || completion !== 0" @close="showCreate = false; title = ''; description = ''; newCategory = null; completion = 0"><form class="activity-form" @submit.prevent="create"><label>Title<input v-model="title" required maxlength="200" :disabled="saving" /></label><label>Category<select v-model="newCategory" :disabled="saving"><option :value="null">Uncategorized</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label><label>Description <span class="muted">(optional)</span><textarea v-model="description" maxlength="2000" rows="3" :disabled="saving"></textarea></label><label>Completion (%)<input v-model.number="completion" type="number" min="0" max="100" step="1" required :disabled="saving" /></label><p v-if="saveError" role="alert">{{ saveError }}</p><div class="dialog-actions"><button type="button" :disabled="saving" @click="createDialog?.close()">Cancel</button><button class="primary" :disabled="saving">{{ saving ? 'Saving…' : 'Create activity' }}</button></div></form></AppDialog>
    <AppDialog v-if="deleteTarget" title="Delete activity?" :busy="deleting" @close="deleteTarget = null"><p class="delete-warning">Delete “{{ deleteTarget.title }}” and all its recorded time? This cannot be undone.</p><p v-if="cards[deleteTarget.id]?.hasDraft()" class="delete-warning">This also discards its unsaved manual entry or activity edits.</p><p v-if="deleteError" role="alert">{{ deleteError }}</p><div class="dialog-actions"><button :disabled="deleting" @click="deleteTarget = null">Cancel</button><button class="delete-button" data-testid="confirm-delete" :disabled="deleting" @click="remove">Delete activity</button></div></AppDialog>
    <AppDialog v-if="switchTarget" title="Switch timer?" :busy="tracker.state.busy" @close="switchTarget = null"><p class="delete-warning">Stop and save the session for “{{ runningActivity?.title }}” before starting “{{ switchTarget.title }}”?</p><p v-if="tracker.state.error" role="alert">{{ tracker.state.error }}</p><div class="dialog-actions"><button :disabled="tracker.state.busy" @click="switchTarget = null">Keep current timer</button><button class="primary" :disabled="tracker.state.busy || !tracker.state.ready" @click="switchTimer">Save & switch</button></div></AppDialog>
  </main>
</template>
