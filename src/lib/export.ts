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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportQuickBooksCSV(
  type: 'donations' | 'payments',
  rows: (string | number)[][]
) {
  if (type === 'donations') {
    const headers = ['Date', 'Name', 'Account', 'Amount', 'Memo']
    generateCSV(headers, rows, 'quickbooks-donaciones')
  } else {
    const headers = ['Date', 'Name', 'Account', 'Amount', 'Description', 'Method']
    generateCSV(headers, rows, 'quickbooks-pagos')
  }
}
