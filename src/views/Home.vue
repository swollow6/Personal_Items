<script setup lang="ts">
import { computed } from 'vue'
import { dashboard, preferences } from '../composables/useData'
import { dayDiff, localDate } from '../utils/date'
import { formatMoney } from '../utils/money'
import AppIcon from '../components/AppIcon.vue'
import MetricCard from '../components/MetricCard.vue'
import ItemCard from '../components/ItemCard.vue'
import EmptyState from '../components/EmptyState.vue'
const reminder = computed(
  () =>
    !preferences.value.lastBackupAt ||
    dayDiff(localDate(), localDate(new Date(preferences.value.lastBackupAt))) >=
      preferences.value.backupReminderDays
)
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">A LITTLE MORE MINDFUL</p>
      <h1>
        让每一件拥有，都物有所值
        <span class="heading-dot">。</span>
      </h1>
      <p class="page-subtitle">从一次使用开始，发现物品陪伴你的价值。</p>
    </div>
    <RouterLink class="button primary" to="/items/new">
      <AppIcon name="plus" />
      添加物品
    </RouterLink>
  </div>
  <div class="metric-grid home-metrics">
    <MetricCard
      label="当前在用物品"
      :value="dashboard.activeCount"
      note="每一件，都有自己的故事"
      icon="items"
      to="/items?status=in_use"
    />
    <MetricCard
      label="当前持有购置金额"
      :value="formatMoney(dashboard.heldAmount, preferences.currency)"
      :note="`${dashboard.heldCount} 件持有物品 · ${dashboard.heldUnknownPrices} 件未填写价格`"
      icon="stats"
      accent
      to="/stats"
    />
    <MetricCard
      label="疑似闲置物品"
      :value="dashboard.idle.length"
      :note="`超过 ${preferences.idleThreshold} 天未记录使用`"
      icon="clock"
      to="/items?filter=idle"
    />
  </div>
  <div class="home-columns">
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>最近使用</h2>
          <p>日常的小记录，让价值看得见</p>
        </div>
        <RouterLink to="/items" class="text-link">
          全部物品
          <AppIcon name="next" :size="16" />
        </RouterLink>
      </div>
      <div v-if="dashboard.recent.length" class="recent-list">
        <ItemCard v-for="item in dashboard.recent" :key="item.id" :item="item" row />
      </div>
      <EmptyState
        v-else
        title="拥有之后，别忘了常常使用"
        description="为物品记下第一次使用，你的日常足迹就会出现在这里。"
        icon="leaf"
      >
        <RouterLink class="button" :to="dashboard.items.length ? '/items' : '/items/new'">
          {{ dashboard.items.length ? '去记录一次使用' : '记录第一件物品' }}
          <AppIcon name="arrow" :size="17" />
        </RouterLink>
      </EmptyState>
    </section>
    <div class="home-aside">
      <section class="care-card">
        <div class="section-heading">
          <span class="round-icon"><AppIcon name="leaf" /></span>
          <span class="eyebrow">给拥有多一点关注</span>
        </div>
        <h2>{{ dashboard.idle.length ? '让闲置，重新回到日常。' : '好的生活，从善用开始。' }}</h2>
        <p>
          {{
            dashboard.idle.length
              ? `有 ${dashboard.idle.length} 件物品很久没使用了，也许是时候再见一面。`
              : '少一点遗忘，多一点陪伴。记录每一次使用，慢慢了解真正适合自己的物品。'
          }}
        </p>
        <RouterLink to="/items?filter=idle" class="text-link">
          看看闲置物品
          <AppIcon name="arrow" :size="17" />
        </RouterLink>
        <div class="care-illustration" aria-hidden="true">
          <div class="plant-stem" />
          <span class="plant-leaf one" />
          <span class="plant-leaf two" />
          <span class="plant-leaf three" />
          <div class="plant-pot" />
          <div class="illustration-book" />
        </div>
      </section>
      <RouterLink v-if="reminder" to="/settings/backup" class="backup-reminder">
        <AppIcon name="shield" :size="23" />
        <div>
          <strong>给记录留一份备份</strong>
          <p>本地数据值得妥善保存</p>
        </div>
        <AppIcon name="next" :size="16" />
      </RouterLink>
    </div>
  </div>
  <section class="recent-added">
    <div class="section-heading">
      <div>
        <h2>最近新增</h2>
        <p>欢迎加入你的生活</p>
      </div>
      <RouterLink to="/items" class="text-link">
        查看全部
        <AppIcon name="next" :size="16" />
      </RouterLink>
    </div>
    <div v-if="dashboard.added.length" class="item-grid">
      <ItemCard v-for="item in dashboard.added" :key="item.id" :item="item" />
    </div>
    <div v-else class="add-first">
      <span class="round-icon"><AppIcon name="plus" /></span>
      <div>
        <strong>从你手边的一件物品开始</strong>
        <p>一副耳机、一本书，或每天陪伴你的咖啡杯。</p>
      </div>
      <RouterLink class="text-link" to="/items/new">
        添加物品
        <AppIcon name="arrow" :size="16" />
      </RouterLink>
    </div>
  </section>
  <p class="page-footnote">每一次使用，都是拥有的意义。</p>
</template>
