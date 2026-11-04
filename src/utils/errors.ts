import { ZodError } from 'zod'
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((i) => i.message).join('；')
  if (error instanceof DomainError) return error.message
  if (error instanceof Error && /quota/i.test(error.name))
    return '保存失败：存储空间不足，请备份并清理空间'
  if (import.meta.env.DEV) console.error(error)
  return '操作失败，请重试；必要时先导出备份'
}
