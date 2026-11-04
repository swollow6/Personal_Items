import { z } from 'zod'
import { localDate, parseLocalDate } from '../utils/date'
export const idSchema = z.string().uuid('ID 无效')
export const dateSchema = z.string().refine((v) => parseLocalDate(v) !== null, '日期无效')
export const pastDateSchema = dateSchema.refine((v) => v <= localDate(), '日期不能晚于今天')
export const isoSchema = z.string().datetime({ offset: false, message: '时间戳无效' })
export const statusSchema = z.enum(['in_use', 'stored', 'sold', 'gifted', 'discarded'])
export const modeSchema = z.enum(['count', 'duration', 'checkin'])
export const itemInputSchema = z
  .object({
    name: z.string().trim().min(1, '请填写物品名称').max(80, '名称最多 80 字'),
    categoryId: idSchema,
    purchaseDate: pastDateSchema.nullable(),
    purchasePriceFen: z.number().int().min(0).max(999999999).nullable(),
    brand: z.string().trim().max(60, '品牌最多 60 字'),
    model: z.string().trim().max(80, '型号最多 80 字'),
    purchaseChannel: z.string().trim().max(80, '购买渠道最多 80 字'),
    warrantyEndDate: dateSchema.nullable(),
    usageMode: modeSchema,
    status: statusSchema,
    note: z.string().trim().max(2000, '备注最多 2000 字'),
  })
  .strict()
export const itemSchema = itemInputSchema
  .extend({
    id: idSchema,
    createdAt: isoSchema,
    updatedAt: isoSchema,
    deletedAt: isoSchema.nullable(),
  })
  .strict()
const usageFields = {
  itemId: idSchema,
  mode: modeSchema,
  value: z.number().int('请输入整数').min(1, '数值至少为 1'),
  occurredAt: isoSchema.refine((v) => Date.parse(v) <= Date.now(), '不能记录未来的使用时间'),
  localDate: pastDateSchema,
  note: z.string().trim().max(500, '备注最多 500 字'),
}
function validUsage(v: { mode: string; value: number }) {
  return v.mode === 'checkin' ? v.value === 1 : v.value <= (v.mode === 'duration' ? 1440 : 9999)
}
const valueRule = {
  message: '次数范围为 1～9999；时长为 1～1440 分钟；打卡固定为 1',
  path: ['value'],
}
export const usageInputSchema = z.object(usageFields).strict().refine(validUsage, valueRule)
export const usageSchema = z
  .object({ ...usageFields, id: idSchema, createdAt: isoSchema, updatedAt: isoSchema })
  .strict()
  .refine(validUsage, valueRule)
export const categorySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(30),
    sortOrder: z.number().int().min(0),
    isSystem: z.boolean(),
    createdAt: isoSchema,
    updatedAt: isoSchema,
  })
  .strict()
export const photoMetaSchema = z
  .object({
    id: idSchema,
    itemId: idSchema,
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
    sortOrder: z.number().int().min(0).max(4),
    createdAt: isoSchema,
    assetPath: z.string(),
  })
  .strict()
export const preferencesSchema = z
  .object({
    currency: z.enum(['CNY', 'USD', 'EUR', 'JPY']),
    idleThreshold: z.number().int().min(7).max(730),
    backupReminderDays: z.number().int().min(1).max(365),
    lastBackupAt: isoSchema.nullable(),
  })
  .strict()
