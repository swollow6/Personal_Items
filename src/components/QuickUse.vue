<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onBeforeUnmount, ref } from 'vue'
import type { Item } from '../domain/types'
import { quickUsage } from '../services/usageService'
import { useAction } from '../composables/useAction'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ item: Item; large?: boolean }>()
const router = useRouter(),
  { busy, run } = useAction()
const coolingDown = ref(false)
let cooldown: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => {
  if (cooldown) clearTimeout(cooldown)
})
async function record() {
  if (coolingDown.value || busy.value) return
  if (props.item.usageMode === 'duration') {
    await router.push(`/items/${props.item.id}/usage/new`)
    return
  }
  coolingDown.value = true
  await run(() => quickUsage(props.item.id), '已记录本次使用')
  cooldown = setTimeout(() => {
    coolingDown.value = false
  }, 400)
}
</script>
<template>
  <button
    :class="large ? 'button primary' : 'quick-button'"
    :disabled="busy || coolingDown || item.status !== 'in_use'"
    :aria-label="`${item.name}：${item.usageMode === 'count' ? '+1' : item.usageMode === 'duration' ? '记录时长' : '标记已使用'}`"
    @click.stop="record"
  >
    <AppIcon
      :name="
        item.usageMode === 'count' ? 'plus' : item.usageMode === 'duration' ? 'clock' : 'check'
      "
      :size="16"
    />{{
      busy
        ? '保存中'
        : item.usageMode === 'count'
          ? large
            ? '记录一次使用'
            : '+1'
          : item.usageMode === 'duration'
            ? '记录时长'
            : '标记使用'
    }}
  </button>
</template>
