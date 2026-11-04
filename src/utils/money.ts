export function fenFromYuanInput(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw new Error('请输入 0～9,999,999.99 的金额，最多两位小数')
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
export function formatMoney(fen: number | null, currency = 'CNY'): string {
  return fen === null
    ? '—'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(fen / 100)
}
export function formatDuration(minutes: number): string {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`
    : `${minutes} 分钟`
}
