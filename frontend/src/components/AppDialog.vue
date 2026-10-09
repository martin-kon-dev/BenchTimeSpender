<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps<{ title: string; busy?: boolean; dirty?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const headingId = useId()
const discarding = ref(false)
let trigger: HTMLElement | null = null
function close() {
  if (props.busy) return
  if (props.dirty) { discarding.value = true; void nextTick(() => dialog.value?.querySelector<HTMLButtonElement>('.discard-warning button')?.focus()) }
  else emit('close')
}
onMounted(() => { trigger = document.activeElement as HTMLElement; dialog.value?.showModal() })
onBeforeUnmount(() => { dialog.value?.close(); trigger?.focus() })
defineExpose({ close })
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]'))
    .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :aria-labelledby="headingId" aria-modal="true"
    :aria-busy="busy || undefined" @keydown="trapFocus" @cancel.prevent="close" @click="$event.target === dialog && close()">
    <div class="dialog-content">
      <div class="dialog-heading"><h2 :id="headingId">{{ title }}</h2><button type="button" aria-label="Close dialog" :disabled="busy" @click="close">×</button></div>
      <div v-if="discarding" class="discard-warning" role="alert">
        <p>Discard your unsaved changes?</p>
        <div class="dialog-actions"><button @click="discarding = false">Keep editing</button><button class="delete-button" @click="emit('close')">Discard changes</button></div>
      </div>
      <slot v-else />
    </div>
  </dialog>
</template>
