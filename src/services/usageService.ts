import { db } from '../db/db'
import type { UsageInput } from '../domain/types'
import { usageInputSchema } from '../domain/validation'
import { DomainError } from '../utils/errors'
import { getItem } from './itemService'
import { localDate } from '../utils/date'

export async function createUsage(input: UsageInput) {
  const data = usageInputSchema.parse(input)
  const id = crypto.randomUUID(),
    now = new Date().toISOString()
  await db.transaction('rw', db.items, db.usageLogs, async () => {
    const item = await getItem(data.itemId)
    if (item.status !== 'in_use') throw new DomainError('ITEM_NOT_ACTIVE', '请先将物品状态改为在用')
    if (item.usageMode !== data.mode) throw new DomainError('INVALID_INPUT', '使用模式与物品不一致')
    await db.usageLogs.add({ ...data, id, createdAt: now, updatedAt: now })
  })
  return id
}
export async function updateUsage(id: string, input: UsageInput) {
  const data = usageInputSchema.parse(input)
  await db.transaction('rw', db.items, db.usageLogs, async () => {
    const old = await db.usageLogs.get(id)
    if (!old) throw new DomainError('INVALID_INPUT', '记录不存在')
    const item = await getItem(old.itemId)
    // Historical corrections remain possible after an item is sold or stored.
    if (data.itemId !== old.itemId || data.mode !== old.mode || data.mode !== item.usageMode)
      throw new DomainError('INVALID_INPUT', '不可更换关联物品或模式')
    await db.usageLogs.put({
      ...data,
      id,
      createdAt: old.createdAt,
      updatedAt: new Date().toISOString(),
    })
  })
}
export async function deleteUsage(id: string) {
  await db.transaction('rw', db.items, db.usageLogs, async () => {
    const log = await db.usageLogs.get(id)
    if (!log) throw new DomainError('INVALID_INPUT', '记录不存在')
    await getItem(log.itemId)
    await db.usageLogs.delete(id)
  })
}
export async function quickUsage(itemId: string, value = 1) {
  const item = await getItem(itemId)
  const now = new Date()
  return createUsage({
    itemId,
    mode: item.usageMode,
    value,
    occurredAt: now.toISOString(),
    localDate: localDate(now),
    note: '',
  })
}
export const listUsage = (itemId: string) =>
  db.usageLogs.where('itemId').equals(itemId).reverse().sortBy('occurredAt')
export const getUsage = (id: string) => db.usageLogs.get(id)
