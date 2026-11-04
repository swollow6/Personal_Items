import { readSnapshot } from './dataService'
import { downloadBlob } from '../backup/export'
function cell(value: unknown): string {
  let text = value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export async function exportCsv(table: 'items' | 'usageLogs') {
  const snapshot = await readSnapshot(),
    rows = table === 'items' ? snapshot.items : snapshot.usageLogs
  const columns =
    table === 'items'
      ? [
          'id',
          'name',
          'categoryId',
          'purchaseDate',
          'purchasePriceFen',
          'usageMode',
          'status',
          'brand',
          'model',
          'note',
          'deletedAt',
        ]
      : ['id', 'itemId', 'mode', 'value', 'localDate', 'occurredAt', 'note']
  const csv = [
    columns.join(','),
    ...rows.map((row) =>
      columns.map((k) => cell((row as unknown as Record<string, unknown>)[k])).join(',')
    ),
  ].join('\r\n')
  downloadBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    `personal-items-${table}.csv`
  )
}
