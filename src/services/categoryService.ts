import { db } from '../db/db'
import { DomainError } from '../utils/errors'
import { OTHER_CATEGORY_ID } from '../domain/enums'
export async function saveCategory(name: string, id?: string) {
  name = name.trim()
  if (!name || name.length > 30) throw new DomainError('INVALID_INPUT', '分类名称需为 1～30 字')
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    if (all.some((c) => c.id !== id && c.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
      throw new DomainError('INVALID_INPUT', '分类名称已存在')
    const old = id ? await db.categories.get(id) : undefined
    if (id && !old) throw new DomainError('INVALID_INPUT', '分类不存在')
    if (id === OTHER_CATEGORY_ID && name !== '其他')
      throw new DomainError('INVALID_INPUT', '系统分类“其他”不能改名')
    const now = new Date().toISOString()
    await db.categories.put({
      id: id ?? crypto.randomUUID(),
      name,
      sortOrder: old?.sortOrder ?? Math.max(-1, ...all.map((c) => c.sortOrder)) + 1,
      isSystem: old?.isSystem ?? false,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    })
  })
}
export async function deleteCategory(id: string) {
  await db.transaction('rw', db.items, db.categories, async () => {
    if (id === OTHER_CATEGORY_ID) throw new DomainError('INVALID_INPUT', '内置“其他”分类不能删除')
    if (await db.items.where('categoryId').equals(id).count())
      throw new DomainError('CATEGORY_IN_USE', '请先迁移该分类下的物品（含回收站）')
    await db.categories.delete(id)
  })
}
export async function migrateCategory(from: string, to: string) {
  await db.transaction('rw', db.items, db.categories, async () => {
    if (from === to || !(await db.categories.get(to)))
      throw new DomainError('INVALID_INPUT', '请选择不同的目标分类')
    await db.items
      .where('categoryId')
      .equals(from)
      .modify({ categoryId: to, updatedAt: new Date().toISOString() })
  })
}
export async function reorderCategory(id: string, direction: -1 | 1) {
  await db.transaction('rw', db.categories, async () => {
    const list = await db.categories.orderBy('sortOrder').toArray()
    const i = list.findIndex((c) => c.id === id),
      j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j]!, list[i]!]
    await db.categories.bulkPut(
      list.map((c, sortOrder) => ({ ...c, sortOrder, updatedAt: new Date().toISOString() }))
    )
  })
}
