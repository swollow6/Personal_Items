<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import AppIcon from './components/AppIcon.vue'
import { startData, loading, loadError } from './composables/useData'
import { seedDatabase } from './db/seed'
import { errorMessage } from './utils/errors'
import { hasUnsavedChanges } from './composables/useUnsaved'
import { confirmAction } from './composables/useAction'
const route = useRoute(),
  router = useRouter(),
  online = ref(navigator.onLine),
  initError = ref('')
const nav = [
  { to: '/', name: '生活总览', mobile: '首页', icon: 'home' },
  { to: '/items', name: '我的物品', mobile: '物品', icon: 'items' },
  { to: '/stats', name: '使用与价值', mobile: '统计', icon: 'stats' },
  { to: '/settings', name: '我的设置', mobile: '我的', icon: 'settings' },
]
const dateText = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date())
const current = computed(() =>
  route.path.startsWith('/items') || route.path.startsWith('/usage')
    ? '/items'
    : route.path === '/stats'
      ? '/stats'
      : route.path === '/'
        ? '/'
        : '/settings'
)
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()
async function initialize() {
  try {
    initError.value = ''
    await seedDatabase()
    startData()
  } catch (e) {
    initError.value = errorMessage(e)
  }
}
async function update() {
  if (
    hasUnsavedChanges.value &&
    !(await confirmAction(
      '当前内容尚未保存',
      '请先取消更新并保存表单；继续更新将放弃输入。',
      '放弃输入并更新'
    ))
  )
    return
  hasUnsavedChanges.value = false
  await updateServiceWorker(true)
}
function syncOnline() {
  online.value = navigator.onLine
}
function back() {
  if (window.history.state?.back) router.back()
  else void router.push('/items')
}
onMounted(() => {
  void initialize()
  window.addEventListener('online', syncOnline)
  window.addEventListener('offline', syncOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', syncOnline)
  window.removeEventListener('offline', syncOnline)
})
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"
        ><span class="brand-logo"><AppIcon name="items" :size="25" /></span
        ><span>物有所值<small>记录拥有，珍惜使用</small></span></RouterLink
      >
      <div class="sidebar-label">我的生活档案</div>
      <nav aria-label="主导航">
        <RouterLink v-for="n in nav" :key="n.to" :to="n.to" :class="{ active: current === n.to }"
          ><AppIcon :name="n.icon" />{{ n.name }}<span v-if="current === n.to" class="nav-dot"
        /></RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="local-card">
          <AppIcon name="shield" /><strong>安心留在本地</strong>
          <p>无需账号，数据只保存在当前设备。记得定期备份。</p>
          <RouterLink to="/settings/backup"
            >管理我的备份 <AppIcon name="next" :size="14"
          /></RouterLink>
        </div>
        <span class="version">物有所值 / V1.0</span>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <button v-if="!route.meta.main" class="icon-button" aria-label="返回" @click="back">
            <AppIcon name="back" /></button
          ><span>{{ route.meta.title }}</span>
        </div>
        <div class="topbar-right">
          <span class="date-label">{{ dateText }}</span
          ><span class="connection"
            ><span :class="['status-dot', { offline: !online }]" />{{
              online ? '本地存储' : '离线可用'
            }}</span
          >
        </div>
      </header>
      <div v-if="needRefresh" class="update-banner" role="status">
        有新版本，保存当前编辑内容后更新。<button class="text-button" @click="update">
          立即更新</button
        ><button class="icon-button" aria-label="稍后更新" @click="needRefresh = false">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <div v-else-if="offlineReady" class="update-banner" role="status">
        应用已缓存，现在可以离线使用。<button class="text-button" @click="offlineReady = false">
          知道了
        </button>
      </div>
      <main id="main" :class="{ 'has-bottom-nav': route.meta.main }">
        <div v-if="initError || loadError" class="error-box" role="alert">
          {{ initError || loadError }}<button class="button" @click="initialize">重试加载</button>
        </div>
        <div v-else-if="loading" class="loading-state">正在打开你的生活档案…</div>
        <RouterView v-else v-slot="{ Component }"
          ><component :is="Component" :key="route.path"
        /></RouterView>
      </main>
    </div>
    <nav v-if="route.meta.main" class="bottom-nav" aria-label="手机导航">
      <RouterLink v-for="n in nav" :key="n.to" :to="n.to" :class="{ active: current === n.to }"
        ><AppIcon :name="n.icon" /><span>{{ n.mobile }}</span></RouterLink
      >
    </nav>
  </div>
</template>
