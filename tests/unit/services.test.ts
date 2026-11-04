import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/db'
import { seedDatabase } from '../../src/db/seed'
import {
  saveItem,
  listPhotos,
  moveToRecycle,
  restoreItem,
  permanentlyDelete,
} from '../../src/services/itemService'
import { createUsage, updateUsage, deleteUsage } from '../../src/services/usageService'
import { deleteCategory, saveCategory, migrateCategory } from '../../src/services/categoryService'
import { readSnapshot } from '../../src/services/dataService'
import {
  getDashboard,
  getStatistics,
  filterItems,
  deriveItems,
} from '../../src/services/statsService'
import { OTHER_CATEGORY_ID } from '../../src/domain/enums'
import type { ItemInput } from '../../src/domain/types'
import { localDate, recentMonths } from '../../src/utils/date'
const input: ItemInput = {
  name: '测试耳机',
  categoryId: OTHER_CATEGORY_ID,
  purchaseDate: null,
  purchasePriceFen: null,
  brand: 'Brand',
  model: 'Model',
  purchaseChannel: '',
  warrantyEndDate: null,
  usageMode: 'count',
  status: 'in_use',
  note: '',
}
beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedDatabase()
})
const usage = (itemId: string, value = 1) => ({
  itemId,
  mode: 'count' as const,
  value,
  occurredAt: new Date().toISOString(),
  localDate: localDate(),
  note: '',
})
describe('数据库与事务服务', () => {
  it('默认分类幂等，用户删除分类后不重建', async () => {
    await seedDatabase()
    expect(await db.categories.count()).toBe(7)
    const category = (await db.categories.toArray())[0]!
    await deleteCategory(category.id)
    await seedDatabase()
    expect(await db.categories.count()).toBe(6)
  })
  it('最少输入、未知金额和跨重开持久化', async () => {
    const id = await saveItem(input, [])
    db.close()
    await db.open()
    expect(await db.items.get(id)).toMatchObject({
      name: '测试耳机',
      purchasePriceFen: null,
      purchaseDate: null,
    })
  })
  it('状态限制、模式锁定与历史更正', async () => {
    const id = await saveItem(input, []),
      logId = await createUsage(usage(id, 3))
    await expect(saveItem({ ...input, usageMode: 'duration' }, [], id, true)).rejects.toMatchObject(
      { code: 'MODE_LOCKED' }
    )
    await saveItem({ ...input, status: 'sold' }, [], id, true)
    await expect(createUsage(usage(id))).rejects.toMatchObject({ code: 'ITEM_NOT_ACTIVE' })
    await updateUsage(logId, usage(id, 5))
    expect(getDashboard(await readSnapshot()).items[0]!.metrics.count).toBe(5)
    await deleteUsage(logId)
    await saveItem({ ...input, usageMode: 'duration' }, [], id, true)
    expect((await db.items.get(id))?.usageMode).toBe('duration')
  })
  it('照片和日志软删除保留、恢复以及永久级联删除', async () => {
    const blob = new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' })
    const id = await saveItem(input, [
      {
        id: crypto.randomUUID(),
        itemId: '',
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4,
        blob,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      },
    ])
    await createUsage(usage(id))
    await expect(permanentlyDelete(id)).rejects.toThrow()
    await moveToRecycle(id)
    expect(getDashboard(await readSnapshot()).items).toHaveLength(0)
    expect(await listPhotos(id)).toHaveLength(1)
    expect(await db.usageLogs.count()).toBe(1)
    await restoreItem(id)
    expect(getDashboard(await readSnapshot()).items).toHaveLength(1)
    await moveToRecycle(id)
    await permanentlyDelete(id)
    expect(await db.items.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
    expect(await db.usageLogs.count()).toBe(0)
  })
  it('分类引用包含回收站，需迁移后删除；系统分类受保护', async () => {
    await saveCategory('旅行')
    const c = await db.categories.where('name').equals('旅行').first()
    const id = await saveItem({ ...input, categoryId: c!.id }, [])
    await moveToRecycle(id)
    await expect(deleteCategory(c!.id)).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' })
    await migrateCategory(c!.id, OTHER_CATEGORY_ID)
    await deleteCategory(c!.id)
    await expect(deleteCategory(OTHER_CATEGORY_ID)).rejects.toThrow()
    await expect(saveCategory(' 其他 ')).rejects.toThrow()
  })
  it('历史支出包含出售物品，持有金额仅在用/收纳；组合筛选正确', async () => {
    await saveItem({ ...input, purchasePriceFen: 39999 }, [])
    await saveItem({ ...input, name: '出售', status: 'sold', purchasePriceFen: 10000 }, [])
    await saveItem({ ...input, name: '收纳', status: 'stored', purchasePriceFen: 2000 }, [])
    const s = await readSnapshot(),
      d = getDashboard(s)
    expect(d.historicalAmount).toBe(51999)
    expect(d.heldAmount).toBe(41999)
    expect(
      filterItems(deriveItems(s), {
        keyword: ' brand ',
        status: 'in_use',
        categoryId: OTHER_CATEGORY_ID,
      })
    ).toHaveLength(1)
  })
  it('月度使用依照 localDate，不依照 UTC 日期', async () => {
    const id = await saveItem(input, []),
      month = recentMonths()[0]!,
      date = month + '-01'
    const occurredAt = new Date(`${date}T00:10:00+08:00`).toISOString()
    await createUsage({ ...usage(id), occurredAt, localDate: date, value: 3 })
    expect(getStatistics(await readSnapshot()).counts[0]).toBe(3)
  })
  it('500 物品 / 5000 日志统计正确', async () => {
    const now = new Date().toISOString()
    const items = Array.from({ length: 500 }, (_, i) => ({
      ...input,
      id: crypto.randomUUID(),
      name: `物品${i}`,
      purchasePriceFen: 10000,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }))
    await db.items.bulkPut(items)
    await db.usageLogs.bulkPut(
      items.flatMap((item) =>
        Array.from({ length: 10 }, () => ({
          ...usage(item.id),
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        }))
      )
    )
    const dashboard = getDashboard(await readSnapshot())
    expect(dashboard.heldAmount).toBe(5000000)
    expect(dashboard.items.every((i) => i.metrics.count === 10)).toBe(true)
    expect(dashboard.items).toHaveLength(500)
  })
})
