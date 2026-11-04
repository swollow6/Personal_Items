import type JSZip from 'jszip'
import { DomainError } from '../utils/errors'
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
export function invalid(message = '备份文件无效，原有数据未更改'): never {
  throw new DomainError('BACKUP_INVALID', message)
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
export function safePath(path: string): boolean {
  return /^(manifest\.json|data\/(items|usageLogs|categories|photos|settings)\.json|media\/[0-9a-f-]+\.(jpg|png|webp))$/.test(
    path
  )
}
// Inspect the original central directory before JSZip normalizes paths or collapses duplicates.
export function inspectZipDirectory(bytes: Uint8Array): Map<string, number> {
  if (bytes.length > MAX_BACKUP_BYTES || bytes.length < 22) invalid('备份包为空、损坏或超过 50 MB')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i
      break
    }
  }
  if (end < 0) invalid()
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true)
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count !== view.getUint16(end + 8, true) ||
    count === 65535 ||
    count > 10000 ||
    offset + size !== end
  )
    invalid('不支持分卷、ZIP64 或异常 ZIP 结构')
  let cursor = offset,
    total = 0
  const entries = new Map<string, number>(),
    ranges: [number, number][] = []
  const decoder = new TextDecoder('utf-8', { fatal: true })
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) invalid()
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true)
    const compressed = view.getUint32(cursor + 20, true),
      uncompressed = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    if (
      cursor + 46 + nameLength + extra + comment > end ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      localOffset + 30 > offset
    )
      invalid()
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
    const directory = name === 'data/' || name === 'media/'
    if (
      (!directory && !safePath(name)) ||
      entries.has(name) ||
      ((view.getUint32(cursor + 38, true) >>> 16) & 0xf000) === 0xa000
    )
      invalid('备份包含非法路径、重复文件或链接')
    if (
      view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 8, true) !== method ||
      view.getUint16(localOffset + 6, true) !== flags
    )
      invalid()
    const ln = view.getUint16(localOffset + 26, true),
      le = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + ln + le,
      dataEnd = dataStart + compressed
    if (
      dataStart > offset ||
      dataEnd > offset ||
      decoder.decode(bytes.slice(localOffset + 30, localOffset + 30 + ln)) !== name
    )
      invalid()
    ranges.push([localOffset, dataEnd])
    total += uncompressed
    if (uncompressed > MAX_BACKUP_BYTES || total > MAX_BACKUP_BYTES || (directory && uncompressed))
      invalid('解压后备份大小超过 50 MB 或目录异常')
    entries.set(name, uncompressed)
    cursor += 46 + nameLength + extra + comment
  }
  ranges.sort((a, b) => a[0] - b[0])
  if (
    ranges.some((r, i) => i > 0 && r[0] < ranges[i - 1]![1]) ||
    cursor !== end ||
    !entries.has('manifest.json')
  )
    invalid()
  return entries
}
export function boundedRead(entry: JSZip.JSZipObject, expectedSize: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0,
      failed = false
    // JSZip 3.10 exposes this streaming API, but omits it from JSZipObject's declarations.
    interface Stream {
      on(event: 'data', callback: (chunk: Uint8Array) => void): Stream
      on(event: 'error', callback: (error: Error) => void): Stream
      on(event: 'end', callback: () => void): Stream
      pause(): Stream
      resume(): Stream
    }
    const stream = (
      entry as JSZip.JSZipObject & { internalStream(type: 'uint8array'): Stream }
    ).internalStream('uint8array')
    stream
      .on('data', (chunk: Uint8Array) => {
        if (failed) return
        total += chunk.length
        if (total > expectedSize || total > MAX_BACKUP_BYTES) {
          failed = true
          stream.pause()
          reject(new DomainError('BACKUP_INVALID', '解压数据超出声明大小，原有数据未更改'))
          return
        }
        chunks.push(chunk)
      })
      .on('error', reject)
      .on('end', () => {
        if (failed) return
        if (total !== expectedSize) {
          reject(new DomainError('BACKUP_INVALID', '备份文件长度不匹配'))
          return
        }
        const result = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
          result.set(c, offset)
          offset += c.length
        }
        resolve(result)
      })
      .resume()
  })
}
