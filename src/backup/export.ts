import JSZip from 'jszip'
import { readFullSnapshot, markBackupCreated } from '../services/dataService'
import { MAX_BACKUP_BYTES, sha256 } from './integrity'
import { DomainError } from '../utils/errors'
import { localDate, localTime } from '../utils/date'
export async function exportBackup(): Promise<Blob> {
  const snapshot = await readFullSnapshot(),
    zip = new JSZip()
  const files: { path: string; sha256: string; sizeBytes: number }[] = []
  let total = 0
  async function add(path: string, bytes: Uint8Array) {
    total += bytes.length
    if (total > MAX_BACKUP_BYTES)
      throw new DomainError('BACKUP_INVALID', '备份超过 50 MB，请清理不需要的照片后再试')
    files.push({ path, sha256: await sha256(bytes), sizeBytes: bytes.length })
    zip.file(path, bytes, { createFolders: false })
  }
  const photoMetadata = []
  for (const photo of snapshot.photos) {
    const { blob, ...meta } = photo,
      assetPath = `media/${photo.id}.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[photo.mimeType]}`
    photoMetadata.push({ ...meta, assetPath })
    await add(assetPath, new Uint8Array(await blob.arrayBuffer()))
  }
  for (const [name, rows] of Object.entries({
    items: snapshot.items,
    usageLogs: snapshot.usageLogs,
    categories: snapshot.categories,
    settings: snapshot.settings,
    photos: photoMetadata,
  }))
    await add(`data/${name}.json`, new TextEncoder().encode(JSON.stringify(rows)))
  const manifest = JSON.stringify(
    {
      format: 'personal-items-backup',
      formatVersion: 1,
      dbSchemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      counts: {
        items: snapshot.items.length,
        usageLogs: snapshot.usageLogs.length,
        categories: snapshot.categories.length,
        photos: snapshot.photos.length,
      },
      files,
    },
    null,
    2
  )
  if (total + new TextEncoder().encode(manifest).length > MAX_BACKUP_BYTES)
    throw new DomainError('BACKUP_INVALID', '备份超过 50 MB')
  zip.file('manifest.json', manifest)
  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  if (bytes.length > MAX_BACKUP_BYTES) throw new DomainError('BACKUP_INVALID', '备份超过 50 MB')
  return new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' })
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export async function downloadBackup() {
  const blob = await exportBackup(),
    now = new Date()
  downloadBlob(
    blob,
    `personal-items-backup-${localDate(now).replaceAll('-', '')}-${localTime(now).replace(':', '')}${String(now.getSeconds()).padStart(2, '0')}.zip`
  )
  // The UI requests explicit confirmation before recording the backup timestamp.
  return blob
}
export { markBackupCreated }
