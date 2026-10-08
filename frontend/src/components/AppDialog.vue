<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const headingId = useId()
function close() {
  if (!props.busy) emit('close')
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :aria-labelledby="headingId" aria-modal="true"
    :aria-busy="busy || undefined" @cancel.prevent="close" @click="$event.target === dialog && close()">
    <div class="dialog-content">
      <h2 :id="headingId">{{ title }}</h2>
      <slot />
    </div>
  </dialog>
</template>
