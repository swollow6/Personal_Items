import { ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { errorMessage } from '../utils/errors'
export function useAction() {
  const busy = ref(false),
    error = ref('')
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const result = await fn()
      if (success) showToast(success)
      return result
    } catch (e) {
      error.value = errorMessage(e)
      showToast({ message: error.value, duration: 3500 })
      return undefined
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
export async function confirmAction(
  title: string,
  message: string,
  confirmButtonText = '确认'
): Promise<boolean> {
  try {
    await showConfirmDialog({
      title,
      message,
      confirmButtonText,
      cancelButtonText: '取消',
      confirmButtonColor: '#38664d',
    })
    return true
  } catch {
    return false
  }
}
