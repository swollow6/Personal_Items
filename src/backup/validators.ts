import { z } from 'zod'
import {
  itemSchema,
  usageSchema,
  categorySchema,
  photoMetaSchema,
  preferencesSchema,
  isoSchema,
} from '../domain/validation'
import { OTHER_CATEGORY_ID } from '../domain/enums'
import { invalid } from './integrity'
export const manifestSchema = z
  .object({
    format: z.literal('personal-items-backup'),
    formatVersion: z.number().int(),
    dbSchemaVersion: z.number().int(),
    appVersion: z.string().max(40),
    exportedAt: isoSchema,
    counts: z
      .object({
        items: z.number().int().min(0),
        usageLogs: z.number().int().min(0),
        categories: z.number().int().min(1),
        photos: z.number().int().min(0),
      })
      .strict(),
    files: z
      .array(
        z
          .object({
            path: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            sizeBytes: z.number().int().min(0),
          })
          .strict()
      )
      .max(10000),
  })
  .strict()
export const dataSchema = z
  .object({
    items: z.array(itemSchema),
    usageLogs: z.array(usageSchema),
    categories: z.array(categorySchema),
    photos: z.array(photoMetaSchema),
    settings: z.array(
      z.union([
        z.object({ key: z.literal('initialized'), value: z.literal(true) }).strict(),
        z.object({ key: z.literal('preferences'), value: preferencesSchema }).strict(),
      ])
    ),
  })
  .strict()
export type BackupData = z.infer<typeof dataSchema>
export function validateRelations(data: BackupData) {
  for (const rows of [data.items, data.usageLogs, data.categories, data.photos])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      invalid('备份包含重复 ID，原有数据未更改')
  if (data.settings.length !== 2 || new Set(data.settings.map((s) => s.key)).size !== 2)
    invalid('设置数据不完整')
  const categories = new Set(data.categories.map((c) => c.id)),
    items = new Map(data.items.map((i) => [i.id, i]))
  if (
    new Set(data.categories.map((c) => c.name.toLocaleLowerCase())).size !== data.categories.length
  )
    invalid('存在重复分类名')
  const system = data.categories.filter((c) => c.isSystem)
  if (system.length !== 1 || system[0]!.id !== OTHER_CATEGORY_ID || system[0]!.name !== '其他')
    invalid('内置“其他”分类约束不满足')
  for (const item of data.items)
    if (!categories.has(item.categoryId)) invalid('物品引用了不存在的分类')
  for (const log of data.usageLogs) {
    if (!items.has(log.itemId) || items.get(log.itemId)!.usageMode !== log.mode)
      invalid('日志引用或模式不匹配')
    if (
      Math.abs(Date.parse(log.localDate + 'T12:00:00Z') - Date.parse(log.occurredAt)) >
      38 * 3600000
    )
      invalid('日志日期与时间不一致')
  }
  const photoCounts = new Map<string, number>(),
    paths = new Set<string>(),
    orders = new Set<string>()
  for (const photo of data.photos) {
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[photo.mimeType]
    const key = `${photo.itemId}:${photo.sortOrder}`
    if (
      !items.has(photo.itemId) ||
      photo.assetPath !== `media/${photo.id}.${ext}` ||
      paths.has(photo.assetPath) ||
      orders.has(key)
    )
      invalid('图片关联或路径异常')
    const count = (photoCounts.get(photo.itemId) ?? 0) + 1
    if (count > 5) invalid('单个物品的照片超过 5 张')
    photoCounts.set(photo.itemId, count)
    paths.add(photo.assetPath)
    orders.add(key)
  }
}
