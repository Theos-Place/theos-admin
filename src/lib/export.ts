/** Descarga un texto como archivo (blob + anchor + click + revoke en un solo lugar). */
export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function generateCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const BOM = '﻿'
  const csv = BOM + [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  downloadBlob(csv, `${filename}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8')
}

export function exportQuickBooksCSV(
  type: 'donations' | 'payments',
  rows: (string | number)[][]
) {
  if (type === 'donations') {
    // INT-3: Currency va pegada al Amount — QuickBooks necesita saber en qué
    // moneda está la cifra; sin la columna asumiría la del archivo entero.
    const headers = ['Date', 'Name', 'Account', 'Amount', 'Currency', 'Memo']
    generateCSV(headers, rows, 'quickbooks-donaciones')
  } else {
    const headers = ['Date', 'Name', 'Account', 'Amount', 'Currency', 'Description', 'Method']
    generateCSV(headers, rows, 'quickbooks-pagos')
  }
}
