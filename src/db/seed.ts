import { db } from './db'
import { defaultPreferences } from '../domain/enums'
export async function seedDatabase() {
  await db.transaction('rw', db.categories, db.settings, async () => {
    // A marker prevents intentionally deleted / renamed defaults being recreated.
    if (await db.settings.get('initialized')) return
    const now = new Date().toISOString()
    const names = ['数码设备', '家用电器', '衣物配饰', '运动户外', '家具', '生活用品', '其他']
    await db.categories.bulkPut(
      names.map((name, i) => ({
        id: `00000000-0000-4000-8000-00000000000${i + 1}`,
        name,
        sortOrder: i,
        isSystem: i === 6,
        createdAt: now,
        updatedAt: now,
      }))
    )
    await db.settings.bulkPut([
      { key: 'initialized', value: true },
      { key: 'preferences', value: { ...defaultPreferences } },
    ])
  })
}
