import { liveQuery } from 'dexie'
import { db } from '../db/db'
import type { Snapshot, Preferences, FullSnapshot } from '../domain/types'
import { defaultPreferences } from '../domain/enums'
import { preferencesSchema } from '../domain/validation'
export async function readSnapshot(): Promise<Snapshot> {
  return db.transaction('r', db.items, db.usageLogs, db.categories, db.settings, async () => ({
    items: await db.items.toArray(),
    usageLogs: await db.usageLogs.toArray(),
    categories: await db.categories.orderBy('sortOrder').toArray(),
    settings: await db.settings.toArray(),
  }))
}
export function observeData(next: (s: Snapshot) => void, error: (e: unknown) => void) {
  return liveQuery(readSnapshot).subscribe({ next, error })
}
export function preferencesFrom(snapshot: Snapshot): Preferences {
  return preferencesSchema.parse(
    snapshot.settings.find((s) => s.key === 'preferences')?.value ?? defaultPreferences
  )
}
export async function savePreferences(input: Preferences) {
  await db.settings.put({ key: 'preferences', value: preferencesSchema.parse(input) })
}
export async function markBackupCreated() {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('preferences'))?.value ?? defaultPreferences
    await db.settings.put({
      key: 'preferences',
      value: { ...preferencesSchema.parse(current), lastBackupAt: new Date().toISOString() },
    })
  })
}
export async function readFullSnapshot(): Promise<FullSnapshot> {
  return db.transaction('r', db.tables, async () => ({
    ...(await readSnapshot()),
    photos: await db.photos.toArray(),
  }))
}
