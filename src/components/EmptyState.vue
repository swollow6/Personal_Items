<script setup lang="ts">
import AppIcon from './AppIcon.vue'
withDefaults(
  defineProps<{ title: string; description?: string; icon?: string; compact?: boolean }>(),
  { icon: 'box' }
)
</script>
<template>
  <div class="empty-state" :class="{ compact }">
    <div class="empty-art">
      <AppIcon :name="icon" :size="compact ? 28 : 42" /><span class="art-dot" />
    </div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>
