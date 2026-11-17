// CSV suomalaiselle Excelille: puolipiste erottimena, desimaalipilkku ja BOM.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined }

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(';')]
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(';'))
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
