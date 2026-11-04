import { computed, ref, shallowRef } from 'vue'
import type { Snapshot } from '../domain/types'
import { observeData, preferencesFrom } from '../services/dataService'
import { deriveItems, getDashboard } from '../services/statsService'
import { errorMessage } from '../utils/errors'
export const snapshot = shallowRef<Snapshot>({
  items: [],
  usageLogs: [],
  categories: [],
  settings: [],
})
export const loading = ref(true),
  loadError = ref('')
export const preferences = computed(() => preferencesFrom(snapshot.value))
export const itemViews = computed(() => deriveItems(snapshot.value))
export const dashboard = computed(() => getDashboard(snapshot.value))
let subscription: ReturnType<typeof observeData> | undefined
export function startData() {
  subscription?.unsubscribe()
  loading.value = true
  loadError.value = ''
  subscription = observeData(
    (s) => {
      snapshot.value = s
      loading.value = false
      loadError.value = ''
    },
    (e) => {
      loading.value = false
      loadError.value = errorMessage(e)
    }
  )
}
