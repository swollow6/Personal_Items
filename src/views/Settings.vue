<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { preferences } from '../composables/useData'
import { useAction } from '../composables/useAction'
import { useUnsaved } from '../composables/useUnsaved'
import { savePreferences } from '../services/dataService'
import { installApp, installed, installPrompt } from '../app/install'
import AppIcon from '../components/AppIcon.vue'
const form = reactive({ ...preferences.value }),
  { busy, error, run } = useAction(),
  storage = ref<StorageEstimate>(),
  persisted = ref(false),
  supported = ref(false),
  storageNote = ref('')
const { reset } = useUnsaved(computed(() => JSON.stringify(form)))
onMounted(async () => {
  try {
    storage.value = await navigator.storage?.estimate?.()
    supported.value = !!navigator.storage?.persist
    persisted.value = (await navigator.storage?.persisted?.()) ?? false
  } catch {
    storageNote.value = '浏览器未提供存储估算'
  }
})
async function save() {
  await run(async () => {
    await savePreferences({
      ...form,
      idleThreshold: Number(form.idleThreshold),
      backupReminderDays: Number(form.backupReminderDays),
    })
    reset()
  }, '偏好设置已保存')
}
async function persist() {
  await run(async () => {
    persisted.value = await navigator.storage.persist()
    storageNote.value = persisted.value
      ? '持久化请求已获准，仍建议定期备份。'
      : '浏览器暂未批准持久化，正常使用不受影响，请定期备份。'
  })
}
function bytes(value: number | undefined) {
  return value === undefined
    ? '暂不可用'
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">YOUR SPACE, YOUR WAY</p>
      <h1>我的设置</h1>
      <p class="page-subtitle">让记录更贴合你的生活。</p>
    </div>
    <span class="version-pill">V1.0.0</span>
  </div>
  <div class="settings-grid">
    <div>
      <form class="panel form-section" @submit.prevent="save">
        <h2>记录偏好</h2>
        <div class="field">
          <label for="currency">展示货币</label>
          <select id="currency" v-model="form.currency">
            <option value="CNY">人民币 CNY</option>
            <option value="USD">美元 USD</option>
            <option value="EUR">欧元 EUR</option>
            <option value="JPY">日元 JPY</option>
          </select>
          <span class="field-hint">仅切换展示符号，不进行汇率换算；所有记录应使用同一种币种。</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="idle-threshold">闲置提醒阈值（天）</label>
            <input
              id="idle-threshold"
              v-model="form.idleThreshold"
              type="number"
              min="7"
              max="730"
              step="1"
              required
            />
            <span class="field-hint">7～730 天，默认 90 天</span>
          </div>
          <div class="field">
            <label for="backup-days">备份提醒周期（天）</label>
            <input
              id="backup-days"
              v-model="form.backupReminderDays"
              type="number"
              min="1"
              max="365"
              step="1"
              required
            />
            <span class="field-hint">在首页提醒，默认 7 天</span>
          </div>
        </div>
        <p v-if="error" class="field-error">{{ error }}</p>
        <button class="button primary" type="submit" :disabled="busy">
          {{ busy ? '正在保存…' : '保存设置' }}
        </button>
      </form>
      <section class="panel settings-links">
        <RouterLink to="/categories">
          <span class="round-icon"><AppIcon name="tag" /></span>
          <div>
            <strong>分类管理</strong>
            <p>按照生活习惯整理物品</p>
          </div>
          <AppIcon name="next" />
        </RouterLink>
        <RouterLink to="/settings/backup">
          <span class="round-icon"><AppIcon name="download" /></span>
          <div>
            <strong>备份与迁移</strong>
            <p>完整 ZIP 备份、恢复与 CSV 导出</p>
          </div>
          <AppIcon name="next" />
        </RouterLink>
        <RouterLink to="/recycle">
          <span class="round-icon"><AppIcon name="archive" /></span>
          <div>
            <strong>回收站</strong>
            <p>恢复物品或永久删除</p>
          </div>
          <AppIcon name="next" />
        </RouterLink>
      </section>
    </div>
    <div>
      <section class="panel form-section">
        <div class="section-heading">
          <h2>本地存储</h2>
          <AppIcon name="storage" />
        </div>
        <div class="storage-number">
          {{ bytes(storage?.usage) }}
          <small>已使用 / 配额 {{ bytes(storage?.quota) }}</small>
        </div>
        <div v-if="storage?.quota" class="storage-meter">
          <span
            :style="{
              width: `${Math.max(1, Math.min(100, ((storage.usage ?? 0) / storage.quota) * 100))}%`,
            }"
          />
        </div>
        <dl class="detail-list">
          <div>
            <dt>持久化存储</dt>
            <dd>{{ persisted ? '已获准' : supported ? '尚未获准' : '浏览器不支持' }}</dd>
          </div>
          <div>
            <dt>最近确认备份</dt>
            <dd>
              {{
                preferences.lastBackupAt
                  ? new Date(preferences.lastBackupAt).toLocaleString('zh-CN')
                  : '还没有备份'
              }}
            </dd>
          </div>
        </dl>
        <button
          v-if="supported && !persisted"
          class="button full-width"
          :disabled="busy"
          @click="persist"
        >
          申请持久化存储
        </button>
        <p class="field-hint">
          {{ storageNote || '持久化不等于备份。清理站点数据仍会删除本地记录。' }}
        </p>
      </section>
      <section class="panel form-section">
        <h2>把物有所值放在手边</h2>
        <p class="field-hint">
          {{
            installed
              ? '已在独立应用模式中运行。'
              : '安装到桌面，随时打开。首次联网缓存后可离线记录。'
          }}
        </p>
        <button v-if="installPrompt" class="button full-width" @click="installApp">安装应用</button>
        <p v-else-if="!installed" class="small muted">
          手机 Safari：分享 → 添加到主屏幕。Chrome / Edge：浏览器菜单 → 安装应用。需通过 HTTPS
          或本机 localhost 访问。
        </p>
      </section>
      <div class="privacy-note">
        <AppIcon name="shield" />
        <div>
          <strong>你的记录，留在你的设备</strong>
          <p>
            无需账号，没有自动同步。不同手机、电脑或浏览器的数据相互独立；换设备请使用完整备份迁移。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
