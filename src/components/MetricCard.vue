<script setup lang="ts">
import AppIcon from './AppIcon.vue'
defineProps<{
  label: string
  value: string | number
  note?: string
  icon: string
  accent?: boolean
  to?: string
}>()
</script>
<template>
  <component :is="to ? 'RouterLink' : 'div'" :to="to" class="metric-card" :class="{ accent }"
    ><div class="metric-top">
      <span>{{ label }}</span
      ><AppIcon :name="icon" />
    </div>
    <strong>{{ value }}</strong
    ><small>{{ note || ' ' }}</small></component
  >
</template>
