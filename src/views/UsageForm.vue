<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itemViews } from '../composables/useData'
import { useAction } from '../composables/useAction'
import { useUnsaved } from '../composables/useUnsaved'
import { createUsage, getUsage, updateUsage } from '../services/usageService'
import { usageInputSchema } from '../domain/validation'
import { localDate, localTime, toOccurredAt } from '../utils/date'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute(),
  router = useRouter(),
  logId = String(route.params.logId ?? ''),
  itemId = ref(String(route.params.id ?? '')),
  ready = ref(!logId),
  { busy, error, run } = useAction()
const item = computed(() => itemViews.value.find((i) => i.id === itemId.value)),
  errors = ref<Record<string, string>>({})
const form = reactive({ date: localDate(), time: localTime(), value: 1, note: '' })
let originalOccurredAt = '',
  originalDate = '',
  originalTime = ''
const { reset, markSaved } = useUnsaved(computed(() => JSON.stringify(form)))
onMounted(async () => {
  if (logId)
    await run(async () => {
      const log = await getUsage(logId)
      if (!log) throw new Error('记录不存在')
      itemId.value = log.itemId
      originalOccurredAt = log.occurredAt
      originalDate = log.localDate
      originalTime = localTime(new Date(log.occurredAt))
      Object.assign(form, {
        date: originalDate,
        time: originalTime,
        value: log.value,
        note: log.note,
      })
      reset()
      ready.value = true
    })
})
async function submit() {
  if (!item.value) return
  errors.value = {}
  let occurredAt: string
  try {
    occurredAt =
      logId && form.date === originalDate && form.time === originalTime
        ? originalOccurredAt
        : toOccurredAt(form.date, form.time)
  } catch (e) {
    errors.value.localDate = (e as Error).message
    return
  }
  const input = {
    itemId: item.value.id,
    mode: item.value.usageMode,
    value: item.value.usageMode === 'checkin' ? 1 : Number(form.value),
    occurredAt,
    localDate: form.date,
    note: form.note,
  }
  const result = usageInputSchema.safeParse(input)
  if (!result.success) {
    for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.message
    return
  }
  await run(
    async () => {
      if (logId) await updateUsage(logId, result.data)
      else await createUsage(result.data)
      markSaved()
      await router.replace(`/items/${item.value!.id}/usage`)
    },
    logId ? '记录已更新' : '已记录这次使用'
  )
}
</script>
<template>
  <div class="narrow-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">A MOMENT WELL SPENT</p>
        <h1>{{ logId ? '编辑使用记录' : '记下一次使用' }}</h1>
        <p class="page-subtitle">每一次使用，都是物品价值的积累。</p>
      </div>
    </div>
    <div v-if="error" class="error-box">{{ error }}</div>
    <EmptyState
      v-if="ready && !item"
      title="找不到关联物品"
      description="物品可能已被移入回收站。"
    />
    <form v-else-if="ready && item" class="panel form-section" novalidate @submit.prevent="submit">
      <div class="usage-item-title">
        <span class="round-icon"><AppIcon name="items" /></span>
        <div>
          <strong>{{ item.name }}</strong>
          <p>{{ item.categoryName }}</p>
        </div>
      </div>
      <p v-if="!logId && item.status !== 'in_use'" class="error-box">请先将物品状态改为在用。</p>
      <div class="form-grid">
        <div class="field">
          <label for="usage-date">使用日期</label>
          <input id="usage-date" v-model="form.date" type="date" :max="localDate()" required />
          <span class="field-error">{{ errors.localDate }}</span>
        </div>
        <div class="field">
          <label for="usage-time">使用时间</label>
          <input id="usage-time" v-model="form.time" type="time" required />
          <span class="field-error">{{ errors.occurredAt }}</span>
        </div>
      </div>
      <div v-if="item.usageMode !== 'checkin'" class="field">
        <label for="usage-value">
          {{ item.usageMode === 'count' ? '使用次数' : '使用时长（分钟）' }}
        </label>
        <input
          id="usage-value"
          v-model="form.value"
          type="number"
          min="1"
          :max="item.usageMode === 'count' ? 9999 : 1440"
          step="1"
          inputmode="numeric"
        />
        <span class="field-error">{{ errors.value }}</span>
        <div v-if="item.usageMode === 'duration'" class="duration-presets">
          <button
            v-for="minute in [15, 30, 60, 90, 120]"
            :key="minute"
            type="button"
            class="chip"
            :class="{ selected: Number(form.value) === minute }"
            @click="form.value = minute"
          >
            {{ minute }} 分钟
          </button>
        </div>
      </div>
      <div v-else class="info-box">
        <AppIcon name="check" />
        本次将添加 1 条使用标记。同一天的多条记录只计为 1 个活跃日期。
      </div>
      <div class="field">
        <label for="usage-note">
          备注
          <span class="optional">选填</span>
        </label>
        <textarea
          id="usage-note"
          v-model="form.note"
          rows="4"
          maxlength="500"
          placeholder="这次使用有什么值得记录的？"
        />
        <span class="field-error">{{ errors.note }}</span>
      </div>
      <button
        class="button primary full-width"
        type="submit"
        :disabled="busy || (!logId && item.status !== 'in_use')"
      >
        <AppIcon name="check" />
        {{ busy ? '保存中…' : '保存使用记录' }}
      </button>
    </form>
  </div>
</template>
