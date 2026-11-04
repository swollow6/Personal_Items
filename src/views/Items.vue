<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { itemViews, snapshot } from '../composables/useData'
import { filterItems } from '../services/statsService'
import { statusLabels } from '../domain/enums'
import AppIcon from '../components/AppIcon.vue'
import ItemCard from '../components/ItemCard.vue'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute(),
  keyword = ref(''),
  category = ref(''),
  status = ref(''),
  idle = ref(false),
  sort = ref('recent'),
  limit = ref(30)
watch(
  () => route.query,
  (q) => {
    status.value = String(q.status ?? '')
    idle.value = q.filter === 'idle'
  },
  { immediate: true }
)
const results = computed(() =>
  filterItems(itemViews.value, {
    keyword: keyword.value,
    categoryId: category.value,
    status: status.value,
    idle: idle.value,
    sort: sort.value,
  })
)
watch([keyword, category, status, idle, sort], () => {
  limit.value = 30
})
function clear() {
  keyword.value = ''
  category.value = ''
  status.value = ''
  idle.value = false
  sort.value = 'recent'
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">THINGS THAT STAY WITH YOU</p>
      <h1>
        我的物品
        <span class="count-label">{{ itemViews.length }}</span>
      </h1>
      <p class="page-subtitle">好好拥有，也好好使用。</p>
    </div>
    <RouterLink to="/items/new" class="button primary">
      <AppIcon name="plus" />
      添加物品
    </RouterLink>
  </div>
  <section class="filter-panel">
    <label class="search-input">
      <AppIcon name="search" />
      <input v-model="keyword" placeholder="搜索名称、品牌或型号" aria-label="搜索物品" />
    </label>
    <div class="filter-row">
      <label>
        <span class="sr-only">分类筛选</span>
        <select v-model="category" aria-label="分类筛选">
          <option value="">全部分类</option>
          <option v-for="c in snapshot.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>
        <span class="sr-only">状态筛选</span>
        <select v-model="status" aria-label="状态筛选">
          <option value="">全部状态</option>
          <option v-for="(label, value) in statusLabels" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>
      <label class="checkbox-label">
        <input v-model="idle" type="checkbox" />
        仅看疑似闲置
      </label>
      <label class="sort-filter">
        <span class="sr-only">排序</span>
        <select v-model="sort" aria-label="排序">
          <option value="recent">最近使用</option>
          <option value="created">最近添加</option>
          <option value="purchase">购买日期</option>
          <option value="priceAsc">金额从低到高</option>
          <option value="priceDesc">金额从高到低</option>
          <option value="name">名称排序</option>
        </select>
      </label>
    </div>
  </section>
  <div class="list-summary">
    共 {{ results.length }} 件物品
    <button v-if="keyword || category || status || idle" class="text-button" @click="clear">
      清除筛选
    </button>
  </div>
  <div v-if="results.length" class="item-grid">
    <ItemCard v-for="item in results.slice(0, limit)" :key="item.id" :item="item" />
  </div>
  <EmptyState
    v-else
    :title="itemViews.length ? '没有找到符合条件的物品' : '生活的收藏，从这里开始'"
    :description="
      itemViews.length ? '试试调整搜索词或筛选条件。' : '添加一件物品，记录它的购置与使用。'
    "
  >
    <button v-if="itemViews.length" class="button" @click="clear">清除筛选</button>
    <RouterLink v-else to="/items/new" class="button primary">添加第一件物品</RouterLink>
  </EmptyState>
  <div v-if="results.length > limit" class="load-more">
    <button class="button" @click="limit += 30">再显示 30 件</button>
  </div>
</template>
