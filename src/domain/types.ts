export type ItemStatus = 'in_use' | 'stored' | 'sold' | 'gifted' | 'discarded'
export type UsageMode = 'count' | 'duration' | 'checkin'
export interface Item {
  id: string
  name: string
  categoryId: string
  purchaseDate: string | null
  purchasePriceFen: number | null
  brand: string
  model: string
  purchaseChannel: string
  warrantyEndDate: string | null
  usageMode: UsageMode
  status: ItemStatus
  note: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
export interface UsageLog {
  id: string
  itemId: string
  mode: UsageMode
  value: number
  occurredAt: string
  localDate: string
  note: string
  createdAt: string
  updatedAt: string
}
export interface Category {
  id: string
  name: string
  sortOrder: number
  isSystem: boolean
  createdAt: string
  updatedAt: string
}
export interface ItemPhoto {
  id: string
  itemId: string
  fileName: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  blob: Blob
  sortOrder: number
  createdAt: string
}
export interface AppSetting {
  key: string
  value: unknown
}
export interface Preferences {
  currency: 'CNY' | 'USD' | 'EUR' | 'JPY'
  idleThreshold: number
  backupReminderDays: number
  lastBackupAt: string | null
}
export interface Snapshot {
  items: Item[]
  usageLogs: UsageLog[]
  categories: Category[]
  settings: AppSetting[]
}
export interface FullSnapshot extends Snapshot {
  photos: ItemPhoto[]
}
export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UsageInput = Omit<UsageLog, 'id' | 'createdAt' | 'updatedAt'>
