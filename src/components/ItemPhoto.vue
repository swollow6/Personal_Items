<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { firstPhoto } from '../services/itemService'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ itemId: string; category?: string; updatedAt?: string }>()
const url = ref('')
let generation = 0
const icon = () =>
  ({
    数码设备: 'laptop',
    家用电器: 'box',
    衣物配饰: 'clothes',
    运动户外: 'sport',
    家具: 'furniture',
    生活用品: 'daily',
  })[props.category ?? ''] ?? 'box'
watch(
  () => [props.itemId, props.updatedAt],
  async () => {
    const token = ++generation
    try {
      const photo = await firstPhoto(props.itemId)
      if (token !== generation) return
      if (url.value) URL.revokeObjectURL(url.value)
      url.value = photo ? URL.createObjectURL(photo.blob) : ''
    } catch {
      if (token === generation) url.value = ''
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  generation++
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>
<template>
  <div class="item-image">
    <img v-if="url" :src="url" alt="物品照片" loading="lazy" /><AppIcon
      v-else
      :name="icon()"
      :size="36"
    />
  </div>
</template>
