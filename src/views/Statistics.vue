<script setup lang="ts">
import { computed, ref } from 'vue'
import { snapshot, preferences } from '../composables/useData'
import { getStatistics } from '../services/statsService'
import { formatMoney } from '../utils/money'
import { localDate } from '../utils/date'
import MetricCard from '../components/MetricCard.vue'
import ChartPanel from '../components/ChartPanel.vue'
import ItemCard from '../components/ItemCard.vue'
import EmptyState from '../components/EmptyState.vue'
const start = ref(''),
  end = ref(''),
  invalidRange = computed(() => !!start.value && !!end.value && start.value > end.value)
const stats = computed(() =>
  getStatistics(
    snapshot.value,
    invalidRange.value ? '' : start.value,
    invalidRange.value ? '' : end.value
  )
)
function clearRange() {
  start.value = ''
  end.value = ''
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">THE VALUE OF EVERYDAY</p>
      <h1>使用，让价值发生</h1>
      <p class="page-subtitle">了解你的购置、使用，以及那些被遗忘的拥有。</p>
    </div>
  </div>
  <div class="stats-filter panel">
    <strong>统计日期范围</strong>
    <label>
      <span class="sr-only">开始日期</span>
      <input v-model="start" type="date" aria-label="开始日期" :max="end || localDate()" />
    </label>
    <span>至</span>
    <label>
      <span class="sr-only">结束日期</span>
      <input v-model="end" type="date" aria-label="结束日期" :min="start" :max="localDate()" />
    </label>
    <button class="text-button" @click="clearRange">全部时间</button>
    <span v-if="invalidRange" class="field-error" role="alert">
      开始日期不能晚于结束日期，当前显示全部数据。
    </span>
  </div>
  <div class="metric-grid four">
    <MetricCard
      label="历史购买累计支出"
      :value="formatMoney(stats.historicalAmount, preferences.currency)"
      :note="`${stats.unknownPrices} 件未填写价格`"
      icon="stats"
      accent
    />
    <MetricCard
      label="当前持有购置金额"
      :value="formatMoney(stats.heldAmount, preferences.currency)"
      note="在用与收纳中的物品，不代表现值"
      icon="items"
    />
    <MetricCard
      label="物品总数"
      :value="stats.itemCount"
      note="含已处置物品，不含回收站"
      icon="box"
    />
    <MetricCard
      label="疑似闲置"
      :value="stats.idle.length"
      :note="`当前在用 · ${preferences.idleThreshold} 天未用`"
      icon="clock"
    />
  </div>
  <p class="scope-note">
    金额按购买日期筛选，使用数据按录入的当地日期筛选。闲置为当前全部在用物品；月度图展示最近 6
    个自然月。
  </p>
  <div class="chart-grid">
    <ChartPanel
      title="每月购置金额"
      :labels="stats.months"
      :values="stats.purchases"
      :unit="preferences.currency"
    />
    <ChartPanel title="分类购置金额占比" :pie="stats.categories" :unit="preferences.currency" />
    <ChartPanel title="每月使用次数" :labels="stats.months" :values="stats.counts" unit="次" />
    <ChartPanel title="每月使用时长" :labels="stats.months" :values="stats.minutes" unit="分钟" />
  </div>
  <section class="panel ranking-panel">
    <div class="section-heading">
      <h2>常用物品 Top 10</h2>
      <span class="small muted">仅按次数类物品</span>
    </div>
    <div v-if="stats.ranking.length" class="ranking-list">
      <RouterLink
        v-for="(entry, index) in stats.ranking"
        :key="entry.item.id"
        :to="`/items/${entry.item.id}`"
      >
        <span class="rank-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ entry.item.name }}</strong>
        <span class="rank-bar">
          <span :style="{ width: `${(entry.count / stats.ranking[0]!.count) * 100}%` }" />
        </span>
        <b>{{ entry.count }} 次</b>
      </RouterLink>
    </div>
    <EmptyState
      v-else
      title="常用榜单还在等你"
      description="为次数类物品记录使用后，即可查看排行。"
      compact
    />
  </section>
  <section>
    <div class="section-heading">
      <h2>给这些物品一点关注</h2>
      <span class="small muted">{{ stats.idle.length }} 件疑似闲置</span>
    </div>
    <div v-if="stats.idle.length" class="item-grid">
      <ItemCard v-for="item in stats.idle" :key="item.id" :item="item" />
    </div>
    <EmptyState
      v-else
      title="暂时没有疑似闲置物品"
      description="继续好好使用身边的每一件物品。"
      icon="leaf"
      compact
    />
  </section>
</template>
