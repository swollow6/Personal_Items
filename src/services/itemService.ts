import { db } from '../db/db'
import type { ItemInput, ItemPhoto } from '../domain/types'
import { itemInputSchema } from '../domain/validation'
import { DomainError } from '../utils/errors'

export async function getItem(id: string) {
  const item = await db.items.get(id)
  if (!item || item.deletedAt) throw new DomainError('ITEM_NOT_FOUND', '物品不存在或已被删除')
  return item
}
export async function saveItem(
  input: ItemInput,
  photos: ItemPhoto[],
  id: string = crypto.randomUUID(),
  editing = false
) {
  const data = itemInputSchema.parse(input)
  if (photos.length > 5 || new Set(photos.map((p) => p.id)).size !== photos.length)
    throw new DomainError('INVALID_INPUT', '每件物品最多上传 5 张不同照片')
  const now = new Date().toISOString()
  await db.transaction('rw', [db.items, db.categories, db.usageLogs, db.photos], async () => {
    if (!(await db.categories.get(data.categoryId)))
      throw new DomainError('INVALID_INPUT', '请选择有效分类')
    const old = await db.items.get(id)
    if (editing && (!old || old.deletedAt))
      throw new DomainError('ITEM_NOT_FOUND', '物品不存在或已被删除')
    if (
      old &&
      old.usageMode !== data.usageMode &&
      (await db.usageLogs.where('itemId').equals(id).count())
    )
      throw new DomainError('MODE_LOCKED', '已有使用记录，暂不支持更换记录模式')
    await db.items.put({
      ...data,
      id,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    })
    await db.photos.where('itemId').equals(id).delete()
    await db.photos.bulkPut(photos.map((p, sortOrder) => ({ ...p, itemId: id, sortOrder })))
  })
  return id
}
export async function moveToRecycle(id: string) {
  await db.transaction('rw', db.items, async () => {
    await getItem(id)
    const now = new Date().toISOString()
    await db.items.update(id, { deletedAt: now, updatedAt: now })
  })
}
export async function restoreItem(id: string) {
  await db.transaction('rw', db.items, db.categories, async () => {
    const item = await db.items.get(id)
    if (!item) throw new DomainError('ITEM_NOT_FOUND', '物品不存在')
    if (!(await db.categories.get(item.categoryId)))
      throw new DomainError('INVALID_INPUT', '分类不存在，请先修复分类')
    await db.items.update(id, { deletedAt: null, updatedAt: new Date().toISOString() })
  })
}
export async function permanentlyDelete(id: string) {
  await db.transaction('rw', db.items, db.usageLogs, db.photos, async () => {
    const item = await db.items.get(id)
    if (!item?.deletedAt) throw new DomainError('INVALID_INPUT', '只有回收站中的物品可以永久删除')
    await db.usageLogs.where('itemId').equals(id).delete()
    await db.photos.where('itemId').equals(id).delete()
    await db.items.delete(id)
  })
}
export const listPhotos = (id: string) => db.photos.where('itemId').equals(id).sortBy('sortOrder')
export async function firstPhoto(id: string) {
  return (await listPhotos(id))[0] ?? null
}
