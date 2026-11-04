<script setup lang="ts">
import { computed, ref } from 'vue'
import { snapshot } from '../composables/useData'
import { useAction, confirmAction } from '../composables/useAction'
import {
  saveCategory,
  deleteCategory,
  migrateCategory,
  reorderCategory,
} from '../services/categoryService'
import { OTHER_CATEGORY_ID } from '../domain/enums'
import type { Category } from '../domain/types'
import AppIcon from '../components/AppIcon.vue'
const { busy, run, error } = useAction(),
  name = ref(''),
  editing = ref(''),
  migration = ref(''),
  target = ref(OTHER_CATEGORY_ID)
const counts = computed(
  () =>
    new Map(
      snapshot.value.categories.map((c) => [
        c.id,
        snapshot.value.items.filter((i) => i.categoryId === c.id).length,
      ])
    )
)
async function save() {
  await run(async () => {
    await saveCategory(name.value, editing.value || undefined)
    name.value = ''
    editing.value = ''
  }, '分类已保存')
}
function edit(category: Category) {
  name.value = category.name
  editing.value = category.id
  document.querySelector<HTMLInputElement>('#category-name')?.focus()
}
function cancelEdit() {
  name.value = ''
  editing.value = ''
}
function openMigration(category: Category) {
  migration.value = category.id
  target.value =
    category.id === OTHER_CATEGORY_ID
      ? (snapshot.value.categories.find((c) => c.id !== category.id)?.id ?? '')
      : OTHER_CATEGORY_ID
}
async function remove(category: Category) {
  if (
    await confirmAction(
      '删除分类',
      `确认删除“${category.name}”？被物品引用的分类需要先迁移。`,
      '删除'
    )
  )
    await run(() => deleteCategory(category.id), '分类已删除')
}
async function migrate() {
  if (
    await confirmAction(
      '迁移分类中的物品',
      '将迁移全部引用物品（包括回收站）。物品的使用日志和照片保持关联。',
      '迁移物品'
    )
  )
    await run(async () => {
      await migrateCategory(migration.value, target.value)
      migration.value = ''
    }, '物品已迁移')
}
</script>
<template>
  <div class="narrow-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">A PLACE FOR EVERYTHING</p>
        <h1>分类管理</h1>
        <p class="page-subtitle">按自己的生活习惯，整理每一份拥有。</p>
      </div>
    </div>
    <form class="panel category-form" @submit.prevent="save">
      <label for="category-name">{{ editing ? '重命名分类' : '新增分类' }}</label>
      <div class="inline-form">
        <input
          id="category-name"
          v-model="name"
          maxlength="30"
          required
          placeholder="输入分类名称"
        />
        <button type="submit" class="button primary" :disabled="busy">
          {{ editing ? '保存' : '添加' }}
        </button>
        <button v-if="editing" type="button" class="button" @click="cancelEdit">取消</button>
      </div>
      <p v-if="error" class="field-error">{{ error }}</p>
    </form>
    <div class="panel category-list">
      <div v-for="(category, index) in snapshot.categories" :key="category.id" class="category-row">
        <span class="round-icon"><AppIcon name="tag" :size="18" /></span>
        <div class="category-name">
          <strong>{{ category.name }}</strong>
          <small>
            {{ counts.get(category.id) }} 件物品{{ category.isSystem ? ' · 系统分类' : '' }}
          </small>
        </div>
        <div class="category-actions">
          <button
            class="icon-button"
            :disabled="busy || index === 0"
            :aria-label="`上移 ${category.name}`"
            @click="run(() => reorderCategory(category.id, -1))"
          >
            <AppIcon name="up" :size="17" />
          </button>
          <button
            class="icon-button"
            :disabled="busy || index === snapshot.categories.length - 1"
            :aria-label="`下移 ${category.name}`"
            @click="run(() => reorderCategory(category.id, 1))"
          >
            <AppIcon name="down" :size="17" />
          </button>
          <button
            v-if="!category.isSystem"
            class="icon-button"
            :aria-label="`重命名 ${category.name}`"
            @click="edit(category)"
          >
            <AppIcon name="edit" :size="17" />
          </button>
          <button
            v-if="counts.get(category.id)"
            class="text-button"
            @click="openMigration(category)"
          >
            迁移
          </button>
          <button
            v-if="!category.isSystem"
            class="icon-button danger"
            :disabled="busy"
            :aria-label="`删除分类 ${category.name}`"
            @click="remove(category)"
          >
            <AppIcon name="trash" :size="17" />
          </button>
        </div>
      </div>
    </div>
    <section v-if="migration" class="panel form-section">
      <h2>迁移到其他分类</h2>
      <p class="field-hint">
        来源：{{ snapshot.categories.find((c) => c.id === migration)?.name }}，含回收站中的物品。
      </p>
      <div class="inline-form">
        <select v-model="target" aria-label="迁移目标分类">
          <option
            v-for="c in snapshot.categories.filter((c) => c.id !== migration)"
            :key="c.id"
            :value="c.id"
          >
            {{ c.name }}
          </option>
        </select>
        <button class="button primary" :disabled="busy || !target" @click="migrate">
          迁移物品
        </button>
        <button class="button" @click="migration = ''">取消</button>
      </div>
    </section>
  </div>
</template>
