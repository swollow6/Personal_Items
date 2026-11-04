import type { Item, UsageLog } from './types'
import { dayDiff, localDate } from '../utils/date'
export function calculateUsageMetrics(item: Item, logs: UsageLog[]) {
  const records = logs.filter((l) => l.itemId === item.id)
  let count = 0,
    minutes = 0
  let last: UsageLog | undefined
  const dates = new Set<string>()
  for (const log of records) {
    if (log.mode === 'count') count += log.value
    if (log.mode === 'duration') minutes += log.value
    dates.add(log.localDate)
    if (!last || log.occurredAt > last.occurredAt) last = log
  }
  return {
    count,
    minutes,
    activeDays: dates.size,
    records: records.length,
    lastUsedDate: last?.localDate ?? null,
    lastUsedAt: last?.occurredAt ?? null,
    unitCostFen: item.purchasePriceFen === null || !count ? null : item.purchasePriceFen / count,
    hourlyCostFen:
      item.purchasePriceFen === null || !minutes ? null : (item.purchasePriceFen * 60) / minutes,
  }
}
export type ItemMetrics = ReturnType<typeof calculateUsageMetrics>
export function getIdleDays(item: Item, metrics: ItemMetrics, today = localDate()): number {
  return dayDiff(
    today,
    metrics.lastUsedDate ?? item.purchaseDate ?? localDate(new Date(item.createdAt))
  )
}
export function isIdle(
  item: Item,
  metrics: ItemMetrics,
  threshold: number,
  today = localDate()
): boolean {
  return (
    !item.deletedAt && item.status === 'in_use' && getIdleDays(item, metrics, today) >= threshold
  )
}
