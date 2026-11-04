import JSZip from 'jszip'
import { db } from '../db/db'
import { DomainError } from '../utils/errors'
import type { FullSnapshot } from '../domain/types'
import { boundedRead, inspectZipDirectory, invalid, MAX_BACKUP_BYTES, sha256 } from './integrity'
import { dataSchema, manifestSchema, validateRelations } from './validators'
import { validImageSignature } from '../utils/photo'
export interface BackupPreview {
  snapshot: FullSnapshot
  exportedAt: string
  counts: { items: number; usageLogs: number; categories: number; photos: number }
}
const inspected = new WeakSet<BackupPreview>()
export async function inspectBackup(file: Blob): Promise<BackupPreview> {
  try {
    if (file.size > MAX_BACKUP_BYTES) invalid('备份包不能超过 50 MB')
    const bytes = new Uint8Array(await file.arrayBuffer()),
      entries = inspectZipDirectory(bytes)
    if (entries.get('manifest.json')! > 2 * 1024 * 1024) invalid('清单过大')
    const zip = await JSZip.loadAsync(bytes)
    const read = async (path: string) => {
      const entry = zip.file(path),
        size = entries.get(path)
      if (!entry || size === undefined) invalid(`备份缺少文件：${path}`)
      return boundedRead(entry, size)
    }
    const manifest = manifestSchema.parse(
      JSON.parse(new TextDecoder().decode(await read('manifest.json')))
    )
    if (manifest.formatVersion !== 1 || manifest.dbSchemaVersion !== 1)
      throw new DomainError('BACKUP_UNSUPPORTED', '备份版本不受支持，请更新应用后恢复此备份')
    const declared = new Set(manifest.files.map((f) => f.path))
    if (declared.size !== manifest.files.length || declared.has('manifest.json'))
      invalid('备份文件清单重复或异常')
    const actual = [...entries.keys()].filter((p) => !p.endsWith('/') && p !== 'manifest.json')
    if (actual.length !== declared.size || actual.some((p) => !declared.has(p)))
      invalid('备份文件与清单不一致')
    const contents = new Map<string, Uint8Array>()
    for (const file of manifest.files) {
      if (entries.get(file.path) !== file.sizeBytes) invalid('文件长度校验失败')
      const data = await read(file.path)
      if ((await sha256(data)) !== file.sha256) invalid('文件完整性校验失败，原有数据未更改')
      contents.set(file.path, data)
    }
    const raw: Record<string, unknown> = {}
    for (const name of ['items', 'usageLogs', 'categories', 'photos', 'settings']) {
      const data = contents.get(`data/${name}.json`)
      if (!data) invalid('备份缺少数据表')
      raw[name] = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data))
    }
    const data = dataSchema.parse(raw)
    validateRelations(data)
    for (const name of ['items', 'usageLogs', 'categories', 'photos'] as const)
      if (data[name].length !== manifest.counts[name]) invalid('备份记录数量不一致')
    if (actual.length !== 5 + data.photos.length) invalid('包含未关联文件')
    const photos = data.photos.map((meta) => {
      const { assetPath, ...photo } = meta,
        content = contents.get(assetPath)
      if (
        !content ||
        content.length !== photo.sizeBytes ||
        !validImageSignature(content, photo.mimeType)
      )
        invalid('照片缺失、类型或大小异常')
      return {
        ...photo,
        blob: new Blob([new Uint8Array(content).buffer], { type: photo.mimeType }),
      }
    })
    const preview = {
      snapshot: { ...data, photos },
      exportedAt: manifest.exportedAt,
      counts: manifest.counts,
    }
    inspected.add(preview)
    return preview
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw new DomainError('BACKUP_INVALID', '备份文件损坏或字段无效，原有数据未更改')
  }
}
export async function restoreBackup(preview: BackupPreview) {
  if (!inspected.has(preview)) invalid('请先校验备份文件')
  // Snapshot is kept outside Vue deep reactivity and only handed back by this module.
  const s = preview.snapshot
  try {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
      await db.categories.bulkPut(s.categories)
      await db.items.bulkPut(s.items)
      await db.usageLogs.bulkPut(s.usageLogs)
      await db.photos.bulkPut(s.photos)
      await db.settings.bulkPut(s.settings)
      for (const name of ['items', 'usageLogs', 'categories', 'photos'] as const)
        if ((await db[name].count()) !== preview.counts[name]) throw new Error('恢复后数量校验失败')
    })
  } catch {
    throw new DomainError('DB_FAILURE', '恢复失败，原有数据未更改；请检查存储空间后重试')
  }
}
