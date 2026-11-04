import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmAction } from './useAction'
import { ref } from 'vue'
export const hasUnsavedChanges = ref(false)
export function useUnsaved(serialized: Ref<string>) {
  const baseline = ref(serialized.value),
    saved = ref(false)
  const dirty = computed(() => !saved.value && serialized.value !== baseline.value)
  watch(
    dirty,
    (value) => {
      hasUnsavedChanges.value = value
    },
    { immediate: true, flush: 'sync' }
  )
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (dirty.value && hasUnsavedChanges.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeRouteLeave(
    async () =>
      !dirty.value ||
      (await confirmAction(
        '放弃未保存的修改？',
        '当前输入尚未保存。返回后这些修改将丢失。',
        '放弃修改'
      ))
  )
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnload)
    hasUnsavedChanges.value = false
  })
  return {
    reset: () => {
      baseline.value = serialized.value
    },
    markSaved: () => {
      saved.value = true
    },
    dirty,
  }
}
