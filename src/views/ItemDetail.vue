<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview } from 'vant'
import { itemViews, preferences } from '../composables/useData'
import { useAction, confirmAction } from '../composables/useAction'
import { listPhotos, moveToRecycle } from '../services/itemService'
import { modeLabels, statusLabels } from '../domain/enums'
import { formatMoney, formatDuration } from '../utils/money'
import { getIdleDays } from '../domain/metrics'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import QuickUse from '../components/QuickUse.vue'
const route = useRoute(),
  router = useRouter(),
  item = computed(() => itemViews.value.find((i) => i.id === route.params.id)),
  urls = ref<string[]>([]),
  { busy, run, error } = useAction()
onMounted(() => {
  void run(async () => {
    urls.value = (await listPhotos(String(route.params.id))).map((p) => URL.createObjectURL(p.blob))
  })
})
onBeforeUnmount(() => urls.value.forEach(URL.revokeObjectURL))
const cost = computed(() =>
  !item.value
    ? null
    : item.value.usageMode === 'count'
      ? item.value.metrics.unitCostFen
      : item.value.metrics.hourlyCostFen
)
async function recycle() {
  if (
    item.value &&
    (await confirmAction(
      '移至回收站',
      `“${item.value.name}”及其日志、照片会被保留，可在回收站恢复。`,
      '移至回收站'
    ))
  )
    await run(async () => {
      await moveToRecycle(item.value!.id)
      await router.replace('/items')
    }, '已移至回收站')
}
</script>
<template>
  <EmptyState
    v-if="!item"
    title="物品不存在或已被删除"
    description="你可以去回收站看看，或返回物品列表。"
  >
    <RouterLink to="/items" class="button">返回物品列表</RouterLink>
  </EmptyState>
  <template v-else>
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ item.categoryName }} / {{ modeLabels[item.usageMode] }}</p>
        <h1>{{ item.name }}</h1>
        <p class="page-subtitle">
          {{ [item.brand, item.model].filter(Boolean).join(' · ') || '生活中的一份陪伴' }}
        </p>
      </div>
      <RouterLink class="button" :to="`/items/${item.id}/edit`">
        <AppIcon name="edit" />
        编辑物品
      </RouterLink>
    </div>
    <div class="detail-grid">
      <div class="detail-visual">
        <button
          v-if="urls.length"
          class="hero-photo"
          aria-label="查看物品大图"
          @click="showImagePreview(urls)"
        >
          <img :src="urls[0]" :alt="item.name" />
        </button>
        <div v-else class="hero-photo placeholder">
          <AppIcon name="box" :size="90" />
          <span>每一件物品，都有一个故事</span>
        </div>
        <div v-if="urls.length > 1" class="photo-thumbs">
          <button
            v-for="(url, index) in urls"
            :key="url"
            :aria-label="`查看第 ${index + 1} 张照片`"
            @click="showImagePreview({ images: urls, startPosition: index })"
          >
            <img :src="url" :alt="`照片 ${index + 1}`" />
          </button>
        </div>
        <div class="detail-actions">
          <QuickUse :item="item" large />
          <RouterLink
            class="button"
            :to="`/items/${item.id}/usage/new`"
            v-if="item.status === 'in_use'"
          >
            补记使用
          </RouterLink>
        </div>
        <p v-if="item.status !== 'in_use'" class="field-hint">
          当前状态为{{ statusLabels[item.status] }}，请先改回“在用”再新增记录。
        </p>
      </div>
      <div>
        <section class="panel form-section">
          <div class="section-heading">
            <h2>使用的价值</h2>
            <span class="badge" :class="{ amber: item.idle }">
              {{ item.idle ? '疑似闲置' : statusLabels[item.status] }}
            </span>
          </div>
          <div class="detail-numbers">
            <div>
              <span>
                {{
                  item.usageMode === 'count'
                    ? '累计使用'
                    : item.usageMode === 'duration'
                      ? '累计时长'
                      : '活跃日期'
                }}
              </span>
              <strong>
                {{
                  item.usageMode === 'count'
                    ? `${item.metrics.count} 次`
                    : item.usageMode === 'duration'
                      ? formatDuration(item.metrics.minutes)
                      : `${item.metrics.activeDays} 天`
                }}
              </strong>
            </div>
            <div v-if="item.usageMode !== 'checkin'">
              <span>{{ item.usageMode === 'count' ? '每次购置成本' : '每小时购置成本' }}</span>
              <strong>{{ formatMoney(cost, preferences.currency) }}</strong>
              <small v-if="cost === null">
                {{ item.purchasePriceFen === null ? '未填写购置金额' : '尚未产生使用记录' }}
              </small>
            </div>
            <div v-else>
              <span>使用记录</span>
              <strong>{{ item.metrics.records }} 条</strong>
            </div>
          </div>
          <dl class="detail-list">
            <div>
              <dt>最近使用</dt>
              <dd>{{ item.metrics.lastUsedDate ?? '未使用' }}</dd>
            </div>
            <div>
              <dt>活跃日期</dt>
              <dd>{{ item.metrics.activeDays }} 天</dd>
            </div>
            <div v-if="item.idle">
              <dt>距起算日</dt>
              <dd>{{ getIdleDays(item, item.metrics) }} 天</dd>
            </div>
          </dl>
          <RouterLink class="button full-width" :to="`/items/${item.id}/usage`">
            查看使用历史
            <AppIcon name="next" :size="16" />
          </RouterLink>
        </section>
        <section class="panel form-section">
          <h2>关于这件物品</h2>
          <dl class="detail-list">
            <div>
              <dt>购买价格</dt>
              <dd>
                {{
                  item.purchasePriceFen === null
                    ? '未填写'
                    : formatMoney(item.purchasePriceFen, preferences.currency)
                }}
              </dd>
            </div>
            <div>
              <dt>购买日期</dt>
              <dd>{{ item.purchaseDate ?? '未知' }}</dd>
            </div>
            <div>
              <dt>购买渠道</dt>
              <dd>{{ item.purchaseChannel || '未填写' }}</dd>
            </div>
            <div>
              <dt>保修到期</dt>
              <dd>{{ item.warrantyEndDate ?? '未填写' }}</dd>
            </div>
            <div>
              <dt>记录方式</dt>
              <dd>{{ modeLabels[item.usageMode] }}</dd>
            </div>
          </dl>
          <div v-if="item.note" class="note-block">
            <strong>备注</strong>
            <p>{{ item.note }}</p>
          </div>
        </section>
        <button class="text-button danger" :disabled="busy" @click="recycle">
          <AppIcon name="trash" :size="16" />
          移至回收站
        </button>
        <p v-if="error" class="field-error">{{ error }}</p>
      </div>
    </div>
  </template>
</template>
