<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { snapshot } from '../composables/useData'
import { useAction } from '../composables/useAction'
import { useUnsaved } from '../composables/useUnsaved'
import { getItem, listPhotos, saveItem } from '../services/itemService'
import { listUsage } from '../services/usageService'
import { itemInputSchema } from '../domain/validation'
import { modeLabels, statusLabels, OTHER_CATEGORY_ID } from '../domain/enums'
import type { ItemInput, ItemPhoto, ItemStatus, UsageMode } from '../domain/types'
import { localDate } from '../utils/date'
import { fenFromYuanInput } from '../utils/money'
import { preparePhoto } from '../utils/photo'
import { errorMessage } from '../utils/errors'
import AppIcon from '../components/AppIcon.vue'
const route = useRoute(),
  router = useRouter(),
  id = String(route.params.id ?? ''),
  editing = !!id,
  ready = ref(!editing),
  locked = ref(false),
  photoBusy = ref(false)
const { busy, error, run } = useAction(),
  photoError = ref(''),
  photos = shallowRef<ItemPhoto[]>([]),
  photoUrls = ref<string[]>([]),
  errors = ref<Record<string, string>>({})
const form = reactive({
  name: '',
  categoryId: OTHER_CATEGORY_ID,
  price: '',
  purchaseDate: localDate(),
  usageMode: 'count' as UsageMode,
  status: 'in_use' as ItemStatus,
  brand: '',
  model: '',
  purchaseChannel: '',
  warrantyEndDate: '',
  note: '',
})
const { reset, markSaved } = useUnsaved(
  computed(() => JSON.stringify({ form, photos: photos.value.map((p) => p.id) }))
)
watch(photos, (list) => {
  photoUrls.value.forEach(URL.revokeObjectURL)
  photoUrls.value = list.map((p) => URL.createObjectURL(p.blob))
})
onBeforeUnmount(() => photoUrls.value.forEach(URL.revokeObjectURL))
onMounted(async () => {
  if (editing)
    await run(async () => {
      const item = await getItem(id)
      Object.assign(form, {
        ...item,
        price: item.purchasePriceFen === null ? '' : (item.purchasePriceFen / 100).toFixed(2),
        purchaseDate: item.purchaseDate ?? '',
        warrantyEndDate: item.warrantyEndDate ?? '',
      })
      photos.value = await listPhotos(id)
      locked.value = (await listUsage(id)).length > 0
      reset()
      ready.value = true
    })
})
function validate(): ItemInput | null {
  errors.value = {}
  let price = null
  try {
    price = fenFromYuanInput(form.price)
  } catch (e) {
    errors.value.price = (e as Error).message
  }
  const data = {
    name: form.name,
    categoryId: form.categoryId,
    purchasePriceFen: price,
    purchaseDate: form.purchaseDate || null,
    usageMode: form.usageMode,
    status: form.status,
    brand: form.brand,
    model: form.model,
    purchaseChannel: form.purchaseChannel,
    warrantyEndDate: form.warrantyEndDate || null,
    note: form.note,
  }
  const result = itemInputSchema.safeParse(data)
  if (!result.success)
    for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.message
  return result.success && Object.keys(errors.value).length === 0 ? result.data : null
}
async function submit() {
  const input = validate()
  if (!input) {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  await run(
    async () => {
      const saved = await saveItem(input, photos.value, id || undefined, editing)
      markSaved()
      await router.replace(`/items/${saved}`)
    },
    editing ? '物品已更新' : '已添加到你的物品'
  )
}
async function addPhotos(event: Event) {
  const target = event.target as HTMLInputElement,
    files = Array.from(target.files ?? [])
  target.value = ''
  photoError.value = ''
  if (photos.value.length + files.length > 5) {
    photoError.value = '每件物品最多 5 张照片'
    return
  }
  photoBusy.value = true
  try {
    const prepared: ItemPhoto[] = []
    for (const file of files) prepared.push(await preparePhoto(file))
    photos.value = [...photos.value, ...prepared]
  } catch (e) {
    photoError.value = errorMessage(e)
  } finally {
    photoBusy.value = false
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
      <h1>{{ editing ? '编辑物品' : '记录一件新物品' }}</h1>
      <p class="page-subtitle">先记下名字，其他细节可以慢慢补充。</p>
    </div>
  </div>
  <div v-if="error" class="error-box" role="alert">{{ error }}</div>
  <form v-if="ready" class="editor-layout" novalidate @submit.prevent="submit">
    <div class="editor-main">
      <section class="panel form-section">
        <h2>基本信息</h2>
        <div class="field">
          <label for="item-name">
            物品名称
            <em>*</em>
          </label>
          <input
            id="item-name"
            v-model="form.name"
            maxlength="80"
            placeholder="例如：每天使用的降噪耳机"
            :aria-invalid="!!errors.name"
            @blur="!form.name.trim() && (errors.name = '请填写物品名称')"
          />
          <span class="field-error">{{ errors.name }}</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="item-category">
              分类
              <em>*</em>
            </label>
            <select id="item-category" v-model="form.categoryId">
              <option v-for="c in snapshot.categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <span class="field-error">{{ errors.categoryId }}</span>
          </div>
          <div class="field">
            <label for="item-status">当前状态</label>
            <select id="item-status" v-model="form.status">
              <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
        </div>
        <fieldset class="mode-field">
          <legend>
            使用记录方式
            <em>*</em>
          </legend>
          <div class="mode-options">
            <label
              v-for="(label, value) in modeLabels"
              :key="value"
              :class="{ selected: form.usageMode === value, disabled: locked }"
            >
              <input v-model="form.usageMode" type="radio" :value="value" :disabled="locked" />
              <AppIcon
                :name="value === 'count' ? 'plus' : value === 'duration' ? 'clock' : 'check'"
              />
              <strong>{{ label }}</strong>
              <small>
                {{
                  value === 'count'
                    ? '耳机、相机等'
                    : value === 'duration'
                      ? '电脑、运动器材等'
                      : '家具、日常用品等'
                }}
              </small>
            </label>
          </div>
          <p class="field-hint">
            {{
              locked ? '已有使用记录，暂不支持更换记录模式。' : '产生使用记录后，记录方式将锁定。'
            }}
          </p>
        </fieldset>
      </section>
      <section class="panel form-section">
        <h2>
          购置信息
          <span class="optional">选填</span>
        </h2>
        <div class="form-grid">
          <div class="field">
            <label for="item-price">购买价格</label>
            <input
              id="item-price"
              v-model="form.price"
              inputmode="decimal"
              placeholder="未知可留空；0 表示免费获得"
              :aria-invalid="!!errors.price"
            />
            <span class="field-error">{{ errors.price }}</span>
          </div>
          <div class="field">
            <label for="purchase-date">购买日期</label>
            <input
              id="purchase-date"
              v-model="form.purchaseDate"
              type="date"
              :max="localDate()"
              :aria-invalid="!!errors.purchaseDate"
            />
            <span class="field-error">{{ errors.purchaseDate }}</span>
            <button type="button" class="text-button small" @click="form.purchaseDate = ''">
              日期未知，清空
            </button>
          </div>
          <div class="field">
            <label for="brand">品牌</label>
            <input id="brand" v-model="form.brand" maxlength="60" placeholder="品牌名称" />
          </div>
          <div class="field">
            <label for="model">型号</label>
            <input id="model" v-model="form.model" maxlength="80" placeholder="产品型号" />
          </div>
          <div class="field">
            <label for="channel">购买渠道</label>
            <input
              id="channel"
              v-model="form.purchaseChannel"
              maxlength="80"
              placeholder="在哪里遇见它"
            />
          </div>
          <div class="field">
            <label for="warranty">保修到期日</label>
            <input
              id="warranty"
              v-model="form.warrantyEndDate"
              type="date"
              :aria-invalid="!!errors.warrantyEndDate"
            />
            <span class="field-error">{{ errors.warrantyEndDate }}</span>
          </div>
        </div>
        <div class="field">
          <label for="item-note">备注</label>
          <textarea
            id="item-note"
            v-model="form.note"
            maxlength="2000"
            rows="4"
            placeholder="关于它，任何你想记住的事…"
          />
          <span class="field-hint">{{ form.note.length }} / 2000</span>
        </div>
      </section>
    </div>
    <aside class="editor-aside">
      <section class="panel form-section">
        <h2>
          物品照片
          <span class="optional">{{ photos.length }} / 5</span>
        </h2>
        <label class="photo-upload" :class="{ disabled: photoBusy || photos.length >= 5 }">
          <AppIcon name="image" :size="30" />
          <strong>{{ photoBusy ? '正在处理照片…' : '添加照片' }}</strong>
          <span>JPG / PNG / WEBP · 单张不超过 8 MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            :disabled="photoBusy || photos.length >= 5"
            aria-label="添加照片"
            @change="addPhotos"
          />
        </label>
        <p v-if="photoError" class="field-error" role="alert">{{ photoError }}</p>
        <div class="photo-previews">
          <div v-for="(photo, index) in photos" :key="photo.id">
            <img :src="photoUrls[index]" :alt="photo.fileName" />
            <button
              type="button"
              class="photo-remove"
              :aria-label="`删除照片 ${index + 1}`"
              @click="photos = photos.filter((p) => p.id !== photo.id)"
            >
              <AppIcon name="close" :size="16" />
            </button>
          </div>
        </div>
        <p class="field-hint">照片只保存在本机，导出完整备份时会一并保存。</p>
      </section>
      <div class="form-tip">
        <AppIcon name="leaf" />
        <p>无需一次填完所有信息。先让这件物品拥有一份属于自己的记录。</p>
      </div>
    </aside>
    <footer class="form-footer">
      <span class="small muted">
        {{ editing ? '保存后将立即更新统计' : '带 * 的字段为必填项' }}
      </span>
      <button class="button primary" :disabled="busy || photoBusy" type="submit">
        <AppIcon name="check" />
        {{ busy ? '正在保存…' : '保存物品' }}
      </button>
    </footer>
  </form>
</template>
