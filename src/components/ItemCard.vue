<script setup lang="ts">
import type { ItemView } from '../services/statsService'
import { statusLabels } from '../domain/enums'
import { formatMoney, formatDuration } from '../utils/money'
import { preferences } from '../composables/useData'
import ItemPhoto from './ItemPhoto.vue'
import QuickUse from './QuickUse.vue'
defineProps<{ item: ItemView; row?: boolean }>()
</script>
<template>
  <article class="item-card" :class="{ row }">
    <RouterLink :to="`/items/${item.id}`" class="item-card-link"
      ><ItemPhoto :item-id="item.id" :category="item.categoryName" :updated-at="item.updatedAt" />
      <div class="item-card-main">
        <div class="item-topline">
          <span class="eyebrow">{{ item.categoryName }}</span
          ><span v-if="item.idle" class="badge amber">疑似闲置</span
          ><span v-else class="badge" :class="{ muted: item.status !== 'in_use' }">{{
            statusLabels[item.status]
          }}</span>
        </div>
        <h3>{{ item.name }}</h3>
        <div class="item-price">
          {{
            item.purchasePriceFen === null
              ? '未填写价格'
              : formatMoney(item.purchasePriceFen, preferences.currency)
          }}
        </div>
        <p class="item-summary">
          {{
            item.usageMode === 'count'
              ? `累计 ${item.metrics.count} 次`
              : item.usageMode === 'duration'
                ? formatDuration(item.metrics.minutes)
                : `${item.metrics.records} 条记录 · ${item.metrics.activeDays} 个活跃日`
          }}
        </p>
      </div></RouterLink
    >
    <div class="item-card-foot">
      <span>{{
        item.metrics.lastUsedDate ? `${item.metrics.lastUsedDate} 使用` : '还未记录使用'
      }}</span
      ><QuickUse :item="item" />
    </div>
  </article>
</template>
