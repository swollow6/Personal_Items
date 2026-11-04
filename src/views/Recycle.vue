<script setup lang="ts">
import { computed } from 'vue'
import { snapshot } from '../composables/useData'
import { useAction, confirmAction } from '../composables/useAction'
import { restoreItem, permanentlyDelete } from '../services/itemService'
import type { Item } from '../domain/types'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
const items = computed(() =>
    snapshot.value.items
      .filter((i) => i.deletedAt)
      .sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!))
  ),
  { busy, run } = useAction()
async function remove(item: Item) {
  if (
    await confirmAction(
      '永久删除，无法撤销',
      `将永久删除“${item.name}”及其所有使用记录与照片。除非有先前备份，否则无法恢复。`,
      '永久删除'
    )
  )
    await run(() => permanentlyDelete(item.id), '已永久删除')
}
</script>
<template>
  <div class="narrow-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">A SECOND CHANCE</p>
        <h1>
          回收站
          <span class="count-label">{{ items.length }}</span>
        </h1>
        <p class="page-subtitle">暂时告别的物品，还可以回到生活里。</p>
      </div>
    </div>
    <div class="info-box">
      <AppIcon name="archive" />
      回收站中的物品不参与统计，照片与记录会一直保留，直到你选择永久删除。
    </div>
    <section v-if="items.length" class="panel recycle-list">
      <article v-for="item in items" :key="item.id" class="recycle-row">
        <span class="round-icon"><AppIcon name="box" /></span>
        <div>
          <h3>{{ item.name }}</h3>
          <p class="small muted">移入于 {{ new Date(item.deletedAt!).toLocaleString('zh-CN') }}</p>
        </div>
        <div class="row-actions">
          <button
            class="button"
            :disabled="busy"
            @click="run(() => restoreItem(item.id), '物品已恢复')"
          >
            恢复
          </button>
          <button
            class="icon-button danger"
            :disabled="busy"
            :aria-label="`永久删除 ${item.name}`"
            @click="remove(item)"
          >
            <AppIcon name="trash" />
          </button>
        </div>
      </article>
    </section>
    <EmptyState
      v-else
      title="回收站是空的"
      description="被移除的物品会在这里等待，直到你决定恢复或永久删除。"
      icon="archive"
    />
  </div>
</template>
