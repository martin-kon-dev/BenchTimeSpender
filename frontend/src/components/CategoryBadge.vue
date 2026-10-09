<script setup lang="ts">
import type { Category } from '../api'
defineProps<{ category?: Category; fallback?: string }>()
</script>
<template><span class="category-badge"><span class="category-dot" :style="{ background: category?.color ?? '#94a3b8' }" aria-hidden="true"></span>{{ category?.name ?? fallback ?? 'Uncategorized' }}</span></template>
