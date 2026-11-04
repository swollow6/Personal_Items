import type { Item, Snapshot } from '../domain/types'
import { calculateUsageMetrics, isIdle } from '../domain/metrics'
import { preferencesFrom } from './dataService'
import { recentMonths } from '../utils/date'
export function deriveItems(snapshot: Snapshot) {
  const grouped = new Map<string, Snapshot['usageLogs']>()
  for (const log of snapshot.usageLogs) {
    const group = grouped.get(log.itemId) ?? []
    group.push(log)
    grouped.set(log.itemId, group)
  }
  return snapshot.items
    .filter((i) => !i.deletedAt)
    .map((item) => {
      const metrics = calculateUsageMetrics(item, grouped.get(item.id) ?? [])
      return {
        ...item,
        metrics,
        idle: isIdle(item, metrics, preferencesFrom(snapshot).idleThreshold),
        categoryName: snapshot.categories.find((c) => c.id === item.categoryId)?.name ?? '其他',
      }
    })
}
export type ItemView = ReturnType<typeof deriveItems>[number]
export function getDashboard(snapshot: Snapshot) {
  const items = deriveItems(snapshot),
    held = items.filter((i) => ['in_use', 'stored'].includes(i.status))
  return {
    items,
    activeCount: items.filter((i) => i.status === 'in_use').length,
    heldCount: held.length,
    heldAmount: held.reduce((s, i) => s + (i.purchasePriceFen ?? 0), 0),
    historicalAmount: items.reduce((s, i) => s + (i.purchasePriceFen ?? 0), 0),
    unknownPrices: items.filter((i) => i.purchasePriceFen === null).length,
    heldUnknownPrices: held.filter((i) => i.purchasePriceFen === null).length,
    idle: items.filter((i) => i.idle),
    recent: items
      .filter((i) => i.metrics.lastUsedAt)
      .sort((a, b) => b.metrics.lastUsedAt!.localeCompare(a.metrics.lastUsedAt!))
      .slice(0, 5),
    added: [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  }
}
export interface ItemQuery {
  keyword?: string
  categoryId?: string
  status?: string
  idle?: boolean
  sort?: string
}
export function filterItems(items: ItemView[], query: ItemQuery): ItemView[] {
  const keyword = (query.keyword ?? '').trim().toLocaleLowerCase()
  const result = items.filter(
    (i) =>
      (!keyword || `${i.name} ${i.brand} ${i.model}`.toLocaleLowerCase().includes(keyword)) &&
      (!query.categoryId || i.categoryId === query.categoryId) &&
      (!query.status || i.status === query.status) &&
      (!query.idle || i.idle)
  )
  return result.sort((a, b) => {
    switch (query.sort) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'created':
        return b.createdAt.localeCompare(a.createdAt)
      case 'purchase':
        return (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '')
      case 'priceAsc':
      case 'priceDesc':
        if (a.purchasePriceFen === null) return b.purchasePriceFen === null ? 0 : 1
        if (b.purchasePriceFen === null) return -1
        return (a.purchasePriceFen - b.purchasePriceFen) * (query.sort === 'priceAsc' ? 1 : -1)
      default:
        return (
          (b.metrics.lastUsedAt ?? '').localeCompare(a.metrics.lastUsedAt ?? '') ||
          b.createdAt.localeCompare(a.createdAt)
        )
    }
  })
}
export function getStatistics(snapshot: Snapshot, start = '', end = '') {
  const dashboard = getDashboard(snapshot)
  const inRange = (date: string | null) =>
    (!start && !end) || (!!date && (!start || date >= start) && (!end || date <= end))
  const items = dashboard.items.filter((i) => inRange(i.purchaseDate))
  const existing = new Set(dashboard.items.map((i) => i.id))
  const logs = snapshot.usageLogs.filter((l) => existing.has(l.itemId) && inRange(l.localDate))
  const months = recentMonths()
  const sum = (list: Item[]) => list.reduce((n, i) => n + (i.purchasePriceFen ?? 0), 0)
  return {
    ...dashboard,
    historicalAmount: sum(items),
    heldAmount: sum(items.filter((i) => ['in_use', 'stored'].includes(i.status))),
    itemCount: items.length,
    unknownPrices: items.filter((i) => i.purchasePriceFen === null).length,
    months,
    purchases: months.map((m) => sum(items.filter((i) => i.purchaseDate?.startsWith(m))) / 100),
    counts: months.map((m) =>
      logs
        .filter((l) => l.mode === 'count' && l.localDate.startsWith(m))
        .reduce((n, l) => n + l.value, 0)
    ),
    minutes: months.map((m) =>
      logs
        .filter((l) => l.mode === 'duration' && l.localDate.startsWith(m))
        .reduce((n, l) => n + l.value, 0)
    ),
    categories: snapshot.categories
      .map((c) => ({ name: c.name, value: sum(items.filter((i) => i.categoryId === c.id)) / 100 }))
      .filter((c) => c.value > 0),
    ranking: dashboard.items
      .filter((i) => i.usageMode === 'count')
      .map((i) => ({ item: i, count: calculateUsageMetrics(i, logs).count }))
      .filter((i) => i.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}
