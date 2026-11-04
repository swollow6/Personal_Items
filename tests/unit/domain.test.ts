import { describe, expect, it } from 'vitest'
import { calculateUsageMetrics, isIdle } from '../../src/domain/metrics'
import { fenFromYuanInput, formatMoney } from '../../src/utils/money'
import { localDate, parseLocalDate, toOccurredAt } from '../../src/utils/date'
import { itemInputSchema, usageInputSchema } from '../../src/domain/validation'
import type { Item, UsageLog } from '../../src/domain/types'
import { OTHER_CATEGORY_ID } from '../../src/domain/enums'
const now = '2025-01-01T00:00:00.000Z'
const item: Item = {
  id: crypto.randomUUID(),
  name: '耳机',
  categoryId: OTHER_CATEGORY_ID,
  purchaseDate: '2024-01-01',
  purchasePriceFen: 39999,
  brand: '',
  model: '',
  purchaseChannel: '',
  warrantyEndDate: null,
  usageMode: 'count',
  status: 'in_use',
  note: '',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function log(value: number, date = '2025-01-01'): UsageLog {
  return {
    id: crypto.randomUUID(),
    itemId: item.id,
    mode: 'count',
    value,
    localDate: date,
    occurredAt: date + 'T00:00:00.000Z',
    note: '',
    createdAt: now,
    updatedAt: now,
  }
}
describe('金额、日期和统一校验', () => {
  it('保留未知、零元和精确分，拒绝负数与三位小数', () => {
    expect(fenFromYuanInput('')).toBeNull()
    expect(fenFromYuanInput('0')).toBe(0)
    expect(fenFromYuanInput('399.99')).toBe(39999)
    expect(fenFromYuanInput('9999999.99')).toBe(999999999)
    for (const v of ['-1', '0.001', '1e3', 'NaN', '10000000'])
      expect(() => fenFromYuanInput(v)).toThrow()
  })
  it('真实日期校验与本地日期转换', () => {
    expect(parseLocalDate('2025-02-29')).toBeNull()
    expect(parseLocalDate('2024-02-29')).not.toBeNull()
    expect(localDate(new Date(toOccurredAt('2025-01-01', '00:10')))).toBe('2025-01-01')
  })
  it('名称为空、超长和未来日期不允许', () => {
    const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...input } = item
    expect(itemInputSchema.safeParse({ ...input, name: '  ' }).success).toBe(false)
    expect(itemInputSchema.safeParse({ ...input, purchaseDate: '2099-01-01' }).success).toBe(false)
    expect(itemInputSchema.safeParse({ ...input, note: 'a'.repeat(2001) }).success).toBe(false)
  })
  it('各模式值边界与未来时间', () => {
    const base = {
      itemId: item.id,
      mode: 'count',
      value: 1,
      occurredAt: now,
      localDate: '2025-01-01',
      note: '',
    }
    expect(usageInputSchema.safeParse({ ...base, value: 9999 }).success).toBe(true)
    for (const value of [0, -1, 1.5, 10000])
      expect(usageInputSchema.safeParse({ ...base, value }).success).toBe(false)
    expect(usageInputSchema.safeParse({ ...base, mode: 'duration', value: 1441 }).success).toBe(
      false
    )
    expect(usageInputSchema.safeParse({ ...base, mode: 'checkin', value: 2 }).success).toBe(false)
    expect(
      usageInputSchema.safeParse({ ...base, occurredAt: '2099-01-01T00:00:00.000Z' }).success
    ).toBe(false)
  })
})
describe('统计口径', () => {
  it('日志编辑/删除后按真实数据计算', () => {
    expect(calculateUsageMetrics(item, [log(3)]).count).toBe(3)
    expect(calculateUsageMetrics(item, [log(5)]).unitCostFen).toBe(7999.8)
    expect(calculateUsageMetrics(item, []).unitCostFen).toBeNull()
  })
  it('未知价格与零元严格区分', () => {
    expect(
      calculateUsageMetrics({ ...item, purchasePriceFen: null }, [log(5)]).unitCostFen
    ).toBeNull()
    expect(calculateUsageMetrics({ ...item, purchasePriceFen: 0 }, [log(5)]).unitCostFen).toBe(0)
    expect(formatMoney(0)).toContain('0.00')
  })
  it('同日多条打卡计一个活跃日；分钟单独计费', () => {
    const logs = [
      { ...log(1), mode: 'checkin' as const },
      { ...log(1), mode: 'checkin' as const },
    ]
    expect(calculateUsageMetrics(item, logs)).toMatchObject({
      records: 2,
      activeDays: 1,
      count: 0,
      minutes: 0,
    })
    expect(calculateUsageMetrics(item, [{ ...log(90), mode: 'duration' }]).hourlyCostFen).toBe(
      26666
    )
  })
  it('90 天边界、收纳排除、未知购置日回退创建日', () => {
    const metrics = calculateUsageMetrics(item, [])
    expect(isIdle(item, metrics, 90, '2024-03-31')).toBe(true)
    expect(isIdle(item, metrics, 90, '2024-03-30')).toBe(false)
    expect(isIdle({ ...item, status: 'stored' }, metrics, 90, '2025-01-01')).toBe(false)
    expect(isIdle({ ...item, deletedAt: now }, metrics, 90, '2025-01-01')).toBe(false)
    const undated = { ...item, purchaseDate: null }
    expect(isIdle(undated, metrics, 90, '2025-06-01')).toBe(true)
  })
})
