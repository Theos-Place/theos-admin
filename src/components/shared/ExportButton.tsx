'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react'
import { type ColumnDef } from './ColumnSelector'
import { generateCSV } from '@/lib/export'

interface Props<T> {
  data: T[]
  columns: ColumnDef<T>[]
  allColumns: ColumnDef<T>[]
  filename: string
  label?: string
  /** Si se pasa, al exportar se piden los datos completos (no solo los de `data`). */
  fetchData?: () => Promise<T[]>
  /** Si se pasa, se confirma con el usuario antes de exportar (p. ej. export sin filtros). */
  confirmMessage?: string
}

function exportToExcel<T>(data: T[], columns: ColumnDef<T>[], filename: string) {
  import('xlsx').then(XLSX => {
    const exportCols = columns.filter(c => c.exportable !== false)
    const headers = exportCols.map(c => c.label)
    const rows = data.map(row =>
      exportCols.map(col => {
        const val = col.exportValue ? col.exportValue(row) : (row as Record<string, unknown>)[String(col.key)]
        if (val === null || val === undefined) return ''
        return String(val)
      })
    )

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c })
      if (!ws[cell]) continue
      ws[cell].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '161440' } },
        alignment: { horizontal: 'center' },
      }
    }

    ws['!cols'] = exportCols.map(col => ({ wch: Math.max(col.label.length, 15) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Datos')
    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`)
  })
}

export function ExportButton<T>({ data, columns, allColumns, filename, label, fetchData, confirmMessage }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [onlyVisible, setOnlyVisible] = useState(true)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Obtiene los datos a exportar: completos (fetchData) o los ya cargados.
  async function resolveData(): Promise<T[] | null> {
    if (confirmMessage && !window.confirm(confirmMessage)) return null
    if (!fetchData) return data
    setBusy(true)
    try { return await fetchData() }
    catch { return null }
    finally { setBusy(false) }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeCols = onlyVisible ? columns : allColumns
  const exportCols = activeCols.filter(c => c.exportable !== false)

  async function handleCSV() {
    const rows0 = await resolveData()
    if (!rows0) return
    const headers = exportCols.map(c => c.label)
    const rows = rows0.map(row =>
      exportCols.map(col => {
        const val = col.exportValue ? col.exportValue(row) : (row as Record<string, unknown>)[String(col.key)]
        if (val === null || val === undefined) return ''
        return String(val)
      })
    )
    generateCSV(headers, rows, filename)
    setOpen(false)
  }

  async function handleExcel() {
    const rows0 = await resolveData()
    if (!rows0) return
    exportToExcel(rows0, exportCols, filename)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
      >
        <Download size={14} strokeWidth={1.75} />
        {busy ? 'Preparando export…' : (label ?? 'Exportar')}
        <span className="text-[11px] opacity-50">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--surface-card)',
            boxShadow: '0 20px 48px rgba(22,20,64,0.14)',
            border: '1px solid var(--outline-variant)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
            <p className="text-[10px] uppercase tracking-widest text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Exportar resultados
            </p>
          </div>

          {/* Format options */}
          <div className="py-1.5">
            <button
              onClick={handleExcel}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <FileSpreadsheet size={15} className="text-[#1D6F42] shrink-0" />
              Excel (.xlsx)
            </button>
            <button
              onClick={handleCSV}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <FileText size={15} className="text-navy-light/50 shrink-0" />
              CSV (.csv)
            </button>
          </div>

          {/* Column scope toggle */}
          <div className="border-t py-1.5" style={{ borderColor: 'var(--outline-variant)' }}>
            <button
              onClick={() => setOnlyVisible(true)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors hover:bg-surface-low"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${onlyVisible ? 'border-coral bg-coral' : 'border-navy-light/30'}`}>
                {onlyVisible && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className={onlyVisible ? 'text-navy' : 'text-navy-light/60'}>Solo columnas visibles</span>
            </button>
            <button
              onClick={() => setOnlyVisible(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors hover:bg-surface-low"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!onlyVisible ? 'border-coral bg-coral' : 'border-navy-light/30'}`}>
                {!onlyVisible && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className={!onlyVisible ? 'text-navy' : 'text-navy-light/60'}>Todas las columnas</span>
            </button>
          </div>

          {/* Record count */}
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--outline-variant)' }}>
            <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="font-semibold text-navy">{data.length.toLocaleString('es-CR')}</span> registros a exportar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
