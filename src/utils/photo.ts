import type { ItemPhoto } from '../domain/types'
import { DomainError } from './errors'
export async function preparePhoto(file: File): Promise<ItemPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new DomainError('INVALID_INPUT', '请选择 JPG、PNG 或 WEBP 图片；HEIC/HEIF 请先转换')
  if (file.size > 8 * 1024 * 1024) throw new DomainError('INVALID_INPUT', '单张原图不能超过 8 MB')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new DomainError('INVALID_INPUT', '图片无法解码，请换成 JPG 或 PNG')
    }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new DomainError('INVALID_INPUT', '当前浏览器无法处理图片')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const encode = (quality: number) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))),
          mimeType,
          quality
        )
      )
    let blob = await encode(0.82)
    if (blob.size > 1024 * 1024 && mimeType === 'image/jpeg') blob = await encode(0.65)
    if (blob.size > 8 * 1024 * 1024)
      throw new DomainError('INVALID_INPUT', '处理后的图片仍然过大，请选择更小图片')
    return {
      id: crypto.randomUUID(),
      itemId: '',
      fileName: `${file.name.replace(/\.[^.]+$/, '').slice(0, 220)}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      mimeType,
      sizeBytes: blob.size,
      blob,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
export function validImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (mime === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
}
