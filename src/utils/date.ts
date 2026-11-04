export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function localTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  if (y! < 1000 || y! > 9999) return null
  const date = new Date(y!, m! - 1, d!, 12)
  return localDate(date) === value ? date : null
}
export function dayNumber(value: string): number {
  const date = parseLocalDate(value)
  if (!date) throw new Error('日期无效')
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}
export function dayDiff(a: string, b: string): number {
  return Math.max(0, dayNumber(a) - dayNumber(b))
}
export function toOccurredAt(date: string, time: string): string {
  const parsed = parseLocalDate(date)
  if (!parsed || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('请输入有效日期和时间')
  const [h, m] = time.split(':').map(Number)
  parsed.setHours(h!, m!, 0, 0)
  return parsed.toISOString()
}
export function recentMonths(count = 6): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) =>
    localDate(new Date(now.getFullYear(), now.getMonth() - count + i + 1, 1)).slice(0, 7)
  )
}
