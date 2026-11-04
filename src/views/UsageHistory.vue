<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { itemViews, snapshot } from '../composables/useData'
import { useAction, confirmAction } from '../composables/useAction'
import { deleteUsage } from '../services/usageService'
import type { UsageLog } from '../domain/types'
import { formatDuration } from '../utils/money'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute(),
  { busy, run } = useAction(),
  item = computed(() => itemViews.value.find((i) => i.id === route.params.id))
const logs = computed(() =>
  snapshot.value.usageLogs
    .filter((l) => l.itemId === route.params.id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
)
function describe(log: UsageLog) {
  return log.mode === 'count'
    ? `${log.value} 次`
    : log.mode === 'duration'
      ? formatDuration(log.value)
      : '标记使用'
}
async function remove(log: UsageLog) {
  if (
    await confirmAction(
      '删除这条使用记录？',
      `${item.value?.name} · ${log.localDate} · ${describe(log)}\n删除后会重新计算所有使用统计。`,
      '删除记录'
    )
  )
    await run(() => deleteUsage(log.id), '记录已删除')
}
</script>
<template>
  <EmptyState v-if="!item" title="物品不存在或已被删除" />
  <template v-else>
    <div class="page-heading">
      <div>
        <p class="eyebrow">EVERY USE COUNTS</p>
        <h1>使用历史</h1>
        <p class="page-subtitle">{{ item.name }} · 共 {{ logs.length }} 条记录</p>
      </div>
      <RouterLink
        v-if="item.status === 'in_use'"
        :to="`/items/${item.id}/usage/new`"
        class="button primary"
      >
        <AppIcon name="plus" />
        记录使用
      </RouterLink>
    </div>
    <section v-if="logs.length" class="panel history-list">
      <article v-for="log in logs" :key="log.id" class="history-row">
        <span class="round-icon">
          <AppIcon
            :name="log.mode === 'duration' ? 'clock' : log.mode === 'checkin' ? 'check' : 'plus'"
          />
        </span>
        <div class="history-content">
          <strong>{{ describe(log) }}</strong>
          <p>
            {{ log.localDate }}
            <span class="muted">
              ·
              {{
                new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(
                  new Date(log.occurredAt)
                )
              }}
            </span>
          </p>
          <p v-if="log.note" class="preserve-whitespace">{{ log.note }}</p>
        </div>
        <RouterLink
          :to="`/usage/${log.id}/edit`"
          class="icon-button"
          :aria-label="`编辑 ${log.localDate} 的记录`"
        >
          <AppIcon name="edit" :size="18" />
        </RouterLink>
        <button
          class="icon-button danger"
          :aria-label="`删除 ${log.localDate} 的记录`"
          :disabled="busy"
          @click="remove(log)"
        >
          <AppIcon name="trash" :size="18" />
        </button>
      </article>
    </section>
    <EmptyState
      v-else
      title="第一条足迹，等你留下"
      description="记录一次使用，开始了解这件物品的价值。"
      icon="clock"
    >
      <RouterLink
        v-if="item.status === 'in_use'"
        :to="`/items/${item.id}/usage/new`"
        class="button"
      >
        记录使用
      </RouterLink>
    </EmptyState>
  </template>
</template>
