<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { json, request, type Category } from '../api'
import AppDialog from './AppDialog.vue'
import CategoryBadge from './CategoryBadge.vue'
const props = defineProps<{ categories: Category[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const dialog = ref<InstanceType<typeof AppDialog> | null>(null)
const editing = ref<Category | null>(null), name = ref(''), color = ref('#8b5cf6'), busy = ref(false), error = ref('')
const deleting = ref<Category | null>(null), reassignment = ref(''), pendingEdit = ref<Category | null>(null), discard = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
const dirty = computed(() => name.value !== (editing.value?.name ?? '') || color.value !== (editing.value?.color ?? '#8b5cf6'))
function applyEdit(category: Category | null) { editing.value = category; name.value = category?.name ?? ''; color.value = category?.color ?? '#8b5cf6'; error.value = ''; void nextTick(() => nameInput.value?.focus()) }
function edit(category: Category | null) { if (dirty.value) { pendingEdit.value = category; discard.value = true } else applyEdit(category) }
async function save() {
  if (busy.value) return
  error.value = ''
  if (!name.value.trim()) { error.value = 'Enter a category name.'; nameInput.value?.focus(); return }
  if (name.value.trim().toLocaleLowerCase() === 'uncategorized') { error.value = 'Uncategorized is the fallback. Choose another name.'; return }
  if (props.categories.some(c => c.id !== editing.value?.id && c.name.toLocaleLowerCase() === name.value.trim().toLocaleLowerCase())) { error.value = 'A category with this name already exists.'; return }
  busy.value = true
  try {
    await request(editing.value ? `/api/categories/${editing.value.id}` : '/api/categories', json(editing.value ? 'PUT' : 'POST', { name: name.value.trim(), color: color.value, ...(editing.value ? { expected_version: editing.value.version } : {}) }))
    applyEdit(null); emit('changed')
  } catch (cause) { error.value = (cause as Error).message }
  finally { busy.value = false }
}
async function remove() {
  if (!deleting.value || !reassignment.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    await request(`/api/categories/${deleting.value.id}`, json('DELETE', { reassign_to: reassignment.value === 'uncategorized' ? null : Number(reassignment.value), expected_version: deleting.value.version, expected_activity_count: deleting.value.activity_count }))
    if (editing.value?.id === deleting.value.id) applyEdit(null)
    deleting.value = null; emit('changed')
  } catch (cause) { error.value = (cause as Error).message }
  finally { busy.value = false }
}
</script>
<template>
  <AppDialog ref="dialog" title="Manage categories" :busy="busy" :dirty="dirty" @close="emit('close')">
    <p class="muted dialog-subtitle">Organize your activities with colors and labels.</p>
    <div class="category-list"><div class="category-table-heading"><span>Category</span><span>Activities</span><span>Actions</span></div><div v-for="category in categories" :key="category.id" class="category-row"><CategoryBadge :category="category" /><span class="assigned-count">{{ category.activity_count }} <span class="mobile-label">activities</span></span><div class="category-actions"><button :aria-label="`Edit category: ${category.name}`" :disabled="busy" @click="edit(category)">Edit</button><button class="delete-button" :aria-label="`Delete category: ${category.name}`" :disabled="busy" @click="deleting = category; reassignment = ''; error = ''">Delete</button></div></div><p v-if="!categories.length" class="empty-state">No categories yet. Add one below.</p></div>
    <div v-if="discard" class="discard-warning" role="alert"><p>Discard the unsaved category changes?</p><div class="dialog-actions"><button @click="discard = false">Keep editing</button><button @click="applyEdit(pendingEdit); discard = false">Discard changes</button></div></div>
    <form class="category-form" @submit.prevent="save"><h3>{{ editing ? `Edit ${editing.name}` : 'New category' }}</h3><div class="category-form-fields"><label>Name<input ref="nameInput" v-model="name" maxlength="100" :disabled="busy" aria-describedby="category-error" :aria-invalid="!!error" placeholder="Category name" /></label><label>Color<input v-model="color" type="color" :disabled="busy" /></label><div class="category-actions"><button v-if="editing" type="button" :disabled="busy" @click="edit(null)">Cancel</button><button class="primary" :disabled="busy">{{ busy ? 'Saving…' : editing ? 'Save category' : 'Add category' }}</button></div></div></form>
    <section v-if="deleting" class="delete-confirmation" aria-labelledby="category-delete-heading"><h3 id="category-delete-heading">Delete {{ deleting.name }}?</h3><p>{{ deleting.activity_count }} activities will be reassigned. Activities and recorded time will be kept.</p><label>Move activities to<select v-model="reassignment" :disabled="busy"><option value="" disabled>Choose a destination</option><option value="uncategorized">Uncategorized</option><option v-for="c in categories.filter(c => c.id !== deleting?.id)" :key="c.id" :value="String(c.id)">{{ c.name }}</option></select></label><div class="dialog-actions"><button :disabled="busy" @click="deleting = null">Cancel deletion</button><button class="delete-button" :disabled="busy || !reassignment" @click="remove">Reassign & delete</button></div></section>
    <p id="category-error" role="alert">{{ error }}</p><button v-if="error" :disabled="busy" @click="emit('changed')">Reload categories</button>
    <div class="dialog-actions dialog-footer"><button :disabled="busy" @click="dialog?.close()">Done</button></div>
  </AppDialog>
</template>
