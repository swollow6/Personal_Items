<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAction, confirmAction } from '../composables/useAction'
import { snapshot, preferences } from '../composables/useData'
import { downloadBackup, markBackupCreated } from '../backup/export'
import { inspectBackup, restoreBackup, type BackupPreview } from '../backup/import'
import { exportCsv } from '../services/csvService'
import AppIcon from '../components/AppIcon.vue'
const router = useRouter(),
  { busy, error, run } = useAction(),
  preview = shallowRef<BackupPreview | null>(null),
  fileName = ref(''),
  safetyReady = ref(false),
  skipSafety = ref(false),
  stage = ref('')
async function exportZip(safety = false) {
  await run(async () => {
    stage.value = '正在生成完整备份…'
    await downloadBackup()
    const saved = await confirmAction(
      '请检查备份文件是否已保存',
      '浏览器无法确定下载是否被取消。请确认 ZIP 文件已保存在下载目录，再标记完成。',
      '已确认文件保存'
    )
    if (saved) {
      await markBackupCreated()
      if (safety) safetyReady.value = true
    }
  })
}
async function selectFile(event: Event) {
  const target = event.target as HTMLInputElement,
    file = target.files?.[0]
  target.value = ''
  preview.value = null
  safetyReady.value = false
  skipSafety.value = false
  if (!file) return
  fileName.value = file.name
  await run(async () => {
    stage.value = '正在校验文件、图片与关联记录…'
    preview.value = await inspectBackup(file)
  })
}
async function skip() {
  if (
    await confirmAction(
      '跳过当前数据备份？',
      '覆盖恢复会替换本机全部记录。如果没有当前备份，被覆盖的数据无法找回。',
      '我了解，跳过安全备份'
    )
  )
    skipSafety.value = true
}
async function restore() {
  if (!preview.value || (!safetyReady.value && !skipSafety.value)) return
  if (
    !(await confirmAction(
      '替换此设备上的全部数据',
      `将导入 ${preview.value.counts.items} 件物品、${preview.value.counts.usageLogs} 条使用记录与 ${preview.value.counts.photos} 张照片，替换当前 ${snapshot.value.items.length} 件物品。此操作不能合并数据。`,
      '确认覆盖恢复'
    ))
  )
    return
  await run(async () => {
    stage.value = '正在恢复，请勿关闭页面…'
    await restoreBackup(preview.value!)
    preview.value = null
    await router.replace('/')
  }, '完整备份已恢复')
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">KEEP YOUR MEMORIES SAFE</p>
      <h1>备份与迁移</h1>
      <p class="page-subtitle">为每一份记录，留一个安心的副本。</p>
    </div>
  </div>
  <div class="info-box">
    <AppIcon name="shield" />
    数据仅存储于当前设备，不会自动同步。完整 ZIP 包含照片和回收站，可用于换设备迁移。
  </div>
  <div v-if="error" class="error-box" role="alert">{{ error }}</div>
  <p v-if="busy" class="progress-message" role="status">{{ stage }}</p>
  <div class="backup-columns">
    <section class="panel form-section">
      <span class="large-icon"><AppIcon name="download" :size="30" /></span>
      <h2>导出完整备份</h2>
      <p class="section-description">
        打包物品、使用日志、分类、设置与全部照片，妥善保存每一份生活记录。
      </p>
      <dl class="detail-list">
        <div>
          <dt>包含物品（含回收站）</dt>
          <dd>{{ snapshot.items.length }} 件</dd>
        </div>
        <div>
          <dt>包含使用记录</dt>
          <dd>{{ snapshot.usageLogs.length }} 条</dd>
        </div>
        <div>
          <dt>最近确认备份</dt>
          <dd>
            {{
              preferences.lastBackupAt
                ? new Date(preferences.lastBackupAt).toLocaleString('zh-CN')
                : '尚未备份'
            }}
          </dd>
        </div>
      </dl>
      <button class="button primary full-width" :disabled="busy" @click="exportZip()">
        <AppIcon name="download" />
        下载完整 ZIP 备份
      </button>
      <p class="field-hint">备份文件未加密，包含价格、渠道和照片，请谨慎存放。最大支持 50 MB。</p>
    </section>
    <section class="panel form-section">
      <span class="large-icon beige"><AppIcon name="upload" :size="30" /></span>
      <h2>从备份恢复</h2>
      <p class="section-description">
        先检查文件完整性和数据关联，再预览恢复内容。校验过程不会改变现有数据。
      </p>
      <label class="restore-upload" :class="{ disabled: busy }">
        <AppIcon name="upload" />
        <strong>选择 ZIP 备份文件</strong>
        <span>{{ fileName || '最大 50 MB · 仅支持本应用完整备份' }}</span>
        <input
          type="file"
          accept=".zip,application/zip"
          :disabled="busy"
          aria-label="选择 ZIP 备份文件"
          @change="selectFile"
        />
      </label>
      <p class="field-hint">恢复采用全量覆盖，不支持合并。只选择来自可信来源的备份。</p>
    </section>
  </div>
  <section v-if="preview" class="panel form-section restore-preview">
    <div class="section-heading">
      <h2>
        <AppIcon name="shield" />
        备份校验通过
      </h2>
      <span class="badge">可恢复</span>
    </div>
    <p>备份生成于 {{ new Date(preview.exportedAt).toLocaleString('zh-CN') }}</p>
    <div class="preview-counts">
      <span>
        <strong>{{ preview.counts.items }}</strong>
        件物品
      </span>
      <span>
        <strong>{{ preview.counts.usageLogs }}</strong>
        条日志
      </span>
      <span>
        <strong>{{ preview.counts.photos }}</strong>
        张照片
      </span>
      <span>
        <strong>{{ preview.counts.categories }}</strong>
        个分类
      </span>
    </div>
    <div class="warning-box">恢复将替换此设备上的全部现有数据。请先保存当前数据的安全备份。</div>
    <div class="restore-steps">
      <button class="button" :disabled="busy || safetyReady" @click="exportZip(true)">
        <AppIcon :name="safetyReady ? 'check' : 'download'" />
        {{ safetyReady ? '当前数据已确认备份' : '先下载当前数据安全备份' }}
      </button>
      <button
        v-if="!safetyReady && !skipSafety"
        class="text-button danger"
        :disabled="busy"
        @click="skip"
      >
        跳过安全备份
      </button>
      <span v-if="skipSafety && !safetyReady" class="small danger">已确认跳过安全备份</span>
      <button
        class="button primary"
        :disabled="busy || (!safetyReady && !skipSafety)"
        @click="restore"
      >
        覆盖恢复此备份
      </button>
    </div>
  </section>
  <section class="panel form-section csv-panel">
    <div>
      <h2>导出 CSV，用自己的方式分析</h2>
      <p class="field-hint">金额列 purchasePriceFen 的单位为“分”；CSV 不含照片，不能用于恢复。</p>
    </div>
    <div class="row-actions">
      <button
        class="button"
        :disabled="busy"
        @click="run(() => exportCsv('items'), '物品 CSV 已生成')"
      >
        物品 CSV
      </button>
      <button
        class="button"
        :disabled="busy"
        @click="run(() => exportCsv('usageLogs'), '日志 CSV 已生成')"
      >
        日志 CSV
      </button>
    </div>
  </section>
  <details class="migration-guide">
    <summary>如何安全地换设备？</summary>
    <ol>
      <li>在旧设备导出完整 ZIP，并确认文件已保存。</li>
      <li>通过你信任的方式将文件传到新设备。</li>
      <li>在新设备打开应用，进入“备份与迁移”选择文件。</li>
      <li>检查预览数量，备份新设备已有数据后，确认覆盖恢复。</li>
      <li>检查照片、记录和统计均正常，再决定是否清理旧设备。</li>
    </ol>
  </details>
</template>
