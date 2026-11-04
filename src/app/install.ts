import { ref, shallowRef } from 'vue'
interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export const installPrompt = shallowRef<InstallPrompt | null>(null)
export const installed = ref(window.matchMedia('(display-mode: standalone)').matches)
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  installPrompt.value = event as InstallPrompt
})
window.addEventListener('appinstalled', () => {
  installed.value = true
  installPrompt.value = null
})
export async function installApp() {
  if (!installPrompt.value) return
  const event = installPrompt.value
  await event.prompt()
  await event.userChoice
  installPrompt.value = null
}
