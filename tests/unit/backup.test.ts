import { beforeEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'node:fs'
import { db } from '../../src/db/db'
import { seedDatabase } from '../../src/db/seed'
import { exportBackup } from '../../src/backup/export'
import { inspectBackup, restoreBackup } from '../../src/backup/import'
import { inspectZipDirectory, sha256 } from '../../src/backup/integrity'
import { readFullSnapshot } from '../../src/services/dataService'
import { saveItem, moveToRecycle } from '../../src/services/itemService'
import { createUsage } from '../../src/services/usageService'
import { OTHER_CATEGORY_ID } from '../../src/domain/enums'
import type { ItemInput } from '../../src/domain/types'
const input: ItemInput = {
  name: '备份示例 · 咖啡杯',
  categoryId: OTHER_CATEGORY_ID,
  purchaseDate: '2025-01-01',
  purchasePriceFen: 39999,
  brand: '',
  model: '',
  purchaseChannel: '',
  warrantyEndDate: null,
  usageMode: 'count',
  status: 'in_use',
  note: '仅用于恢复验收的虚构样本',
}
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxN8AAAAASUVORK5CYII=',
    'base64'
  )
)
beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedDatabase()
})
async function sample() {
  const id = await saveItem(input, [
    {
      id: crypto.randomUUID(),
      itemId: '',
      fileName: 'sample.png',
      mimeType: 'image/png',
      sizeBytes: png.length,
      blob: new Blob([png], { type: 'image/png' }),
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    },
  ])
  await createUsage({
    itemId: id,
    mode: 'count',
    value: 3,
    occurredAt: '2025-01-01T00:10:00.000Z',
    localDate: '2025-01-01',
    note: '验收样本',
  })
  return id
}
async function modifyBackup(
  blob: Blob,
  path: string,
  transform: (text: string) => string,
  rehash = false
) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  zip.file(path, transform(await zip.file(path)!.async('string')))
  if (rehash && path !== 'manifest.json') {
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    const bytes = await zip.file(path)!.async('uint8array')
    const entry = manifest.files.find((f: { path: string }) => f.path === path)
    entry.sizeBytes = bytes.length
    entry.sha256 = await sha256(bytes)
    zip.file('manifest.json', JSON.stringify(manifest))
  }
  return new Blob([await zip.generateAsync({ type: 'arraybuffer' })])
}
describe('ZIP 完整备份与恢复', () => {
  it('完整数据、照片、回收站和所有摘要可独立恢复', async () => {
    const id = await sample()
    await moveToRecycle(id)
    const before = await readFullSnapshot(),
      blob = await exportBackup(),
      preview = await inspectBackup(blob)
    expect(preview.counts).toEqual({ items: 1, usageLogs: 1, categories: 7, photos: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer()),
      manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.files).toHaveLength(6)
    for (const file of manifest.files)
      expect(file.sha256).toBe(await sha256(await zip.file(file.path)!.async('uint8array')))
    await db.delete()
    await db.open()
    await seedDatabase()
    await restoreBackup(preview)
    const after = await readFullSnapshot()
    expect(after.items).toEqual(before.items)
    expect(after.usageLogs).toEqual(before.usageLogs)
    expect(after.categories).toEqual(before.categories)
    expect(after.settings).toEqual(before.settings)
    expect(new Uint8Array(await after.photos[0]!.blob.arrayBuffer())).toEqual(png)
  })
  it('生成可交付的真实格式示例备份', async () => {
    await sample()
    const blob = await exportBackup()
    mkdirSync('tests/fixtures', { recursive: true })
    writeFileSync('tests/fixtures/sample-backup-v1.zip', Buffer.from(await blob.arrayBuffer()))
    expect((await inspectBackup(blob)).counts.items).toBe(1)
  })
  it('JSON 修改一个字节即拒绝，原库完全不变', async () => {
    await sample()
    const before = await readFullSnapshot(),
      blob = await modifyBackup(await exportBackup(), 'data/items.json', (text) =>
        text.replace('39999', '49999')
      )
    await expect(inspectBackup(blob)).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
    expect((await readFullSnapshot()).items).toEqual(before.items)
  })
  it('高版本拒绝，不悄悄丢弃字段', async () => {
    await sample()
    const blob = await modifyBackup(await exportBackup(), 'manifest.json', (text) =>
      text.replace('"formatVersion": 1', '"formatVersion": 2')
    )
    await expect(inspectBackup(blob)).rejects.toMatchObject({ code: 'BACKUP_UNSUPPORTED' })
  })
  it('即使重算摘要，孤儿引用仍被拒绝', async () => {
    await sample()
    const blob = await modifyBackup(
      await exportBackup(),
      'data/items.json',
      (text) => {
        const rows = JSON.parse(text)
        rows[0].categoryId = crypto.randomUUID()
        return JSON.stringify(rows)
      },
      true
    )
    await expect(inspectBackup(blob)).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
  })
  it('重复 ID、非法金额、系统分类损坏分别被拒绝', async () => {
    await sample()
    const source = await exportBackup()
    const duplicate = await modifyBackup(
      source,
      'data/items.json',
      (text) => {
        const rows = JSON.parse(text)
        rows.push(rows[0])
        return JSON.stringify(rows)
      },
      true
    )
    await expect(inspectBackup(duplicate)).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
    const price = await modifyBackup(
      source,
      'data/items.json',
      (text) => text.replace('39999', '-1'),
      true
    )
    await expect(inspectBackup(price)).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
    const category = await modifyBackup(
      source,
      'data/categories.json',
      (text) => text.replace('"isSystem":true', '"isSystem":false'),
      true
    )
    await expect(inspectBackup(category)).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
  })
  it('拒绝 ZIP 路径穿越和伪造解压大小', async () => {
    const zip = new JSZip()
    zip.file('../evil.txt', 'bad', { createFolders: false })
    zip.file('manifest.json', '{}')
    await expect(
      inspectBackup(new Blob([await zip.generateAsync({ type: 'arraybuffer' })]))
    ).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
    const bytes = new Uint8Array(await (await exportBackup()).arrayBuffer()),
      view = new DataView(bytes.buffer)
    const end = bytes.length - 22,
      central = view.getUint32(end + 16, true)
    view.setUint32(central + 24, 60 * 1024 * 1024, true)
    expect(() => inspectZipDirectory(bytes)).toThrow()
  })
  it('照片内容类型伪造拒绝', async () => {
    await sample()
    const source = await exportBackup(),
      zip = await JSZip.loadAsync(await source.arrayBuffer()),
      media = Object.keys(zip.files).find((p) => p.startsWith('media/'))!
    await expect(
      inspectBackup(await modifyBackup(source, media, () => '<script>bad</script>', true))
    ).rejects.toMatchObject({ code: 'BACKUP_INVALID' })
  })
  it('写入故障回滚所有表，不留下半恢复状态', async () => {
    await sample()
    const preview = await inspectBackup(await exportBackup())
    await saveItem({ ...input, name: '恢复前额外数据' }, [])
    const before = await readFullSnapshot()
    const fail = () => {
      throw new Error('模拟存储写入失败')
    }
    db.usageLogs.hook('creating', fail)
    try {
      await expect(restoreBackup(preview)).rejects.toMatchObject({ code: 'DB_FAILURE' })
    } finally {
      db.usageLogs.hook('creating').unsubscribe(fail)
    }
    const after = await readFullSnapshot()
    expect(after.items).toEqual(before.items)
    expect(after.usageLogs).toEqual(before.usageLogs)
    expect(after.photos).toHaveLength(before.photos.length)
  })
})
