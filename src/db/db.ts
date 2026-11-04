import Dexie, { type Table } from 'dexie'
import type { Item, UsageLog, Category, ItemPhoto, AppSetting } from '../domain/types'
export class PersonalItemsDB extends Dexie {
  items!: Table<Item, string>
  usageLogs!: Table<UsageLog, string>
  categories!: Table<Category, string>
  photos!: Table<ItemPhoto, string>
  settings!: Table<AppSetting, string>
  constructor(name = 'PersonalItemsDB') {
    super(name)
    this.version(1).stores({
      items: '&id, name, categoryId, purchaseDate, status, createdAt',
      usageLogs: '&id, itemId, occurredAt, localDate, [itemId+occurredAt]',
      categories: '&id, name, sortOrder',
      photos: '&id, itemId, sortOrder',
      settings: '&key',
    })
  }
}
export const db = new PersonalItemsDB()
