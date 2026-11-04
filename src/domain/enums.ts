export const statusLabels = {
  in_use: '在用',
  stored: '收纳中',
  sold: '已出售',
  gifted: '已赠送',
  discarded: '已报废',
} as const
export const modeLabels = { count: '按次数', duration: '按时长', checkin: '仅标记使用' } as const
export const defaultPreferences = {
  currency: 'CNY',
  idleThreshold: 90,
  backupReminderDays: 7,
  lastBackupAt: null,
} as const
export const OTHER_CATEGORY_ID = '00000000-0000-4000-8000-000000000007'
