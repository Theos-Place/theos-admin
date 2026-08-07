'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, Download, Check, CheckCircle2, XCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { generateCSV } from '@/lib/export'
import { formatMoney, type Currency } from '@/lib/format'
import { sumByCurrency, formatTotalsInline, toCurrency } from '@/lib/money'

interface PreviewRow {
  cedula: string
  csv_name: string
  date: string
  amount: number
  /** INT-3: columna opcional del CSV; sin ella, colones. */
  currency: Currency
}

type ImportResult = {
  total_rows: number
  identified: number
  unidentified: number
  duplicates: number
  status: string
}

// Parser CSV simple (maneja comas entre comillas). Espera columnas: cedula,
// nombre, fecha, monto — y OPCIONALMENTE moneda (INT-3). Sin la columna, todo
// entra como colones, que es lo que trae el histórico.
function parseDonationsCSV(text: string): PreviewRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return []
  const split = (line: string) => {
    const out: string[] = []; let f = '', q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) { if (c === '"') { if (line[i+1] === '"') { f += '"'; i++ } else q = false } else f += c }
      else if (c === '"') q = true
      else if (c === ',') { out.push(f); f = '' }
      else f += c
    }
    out.push(f); return out.map(s => s.trim())
  }
  const header = split(lines[0]).map(h => h.toLowerCase())
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const ci = idx(['cedula', 'cédula']), ni = idx(['nombre']), fi = idx(['fecha']), mi = idx(['monto', 'amount'])
  const cui = idx(['moneda', 'currency'])
  return lines.slice(1).map(line => {
    const cols = split(line)
    return {
      cedula: ci >= 0 ? cols[ci] ?? '' : '',
      csv_name: ni >= 0 ? cols[ni] ?? '' : '',
      date: fi >= 0 ? cols[fi] ?? '' : '',
      amount: Number((mi >= 0 ? cols[mi] ?? '0' : '0').replace(/[^\d.-]/g, '')) || 0,
      currency: toCurrency(cui >= 0 ? cols[cui] : null),
    }
  }).filter(r => r.date && r.amount > 0)
}

export default function ImportarDonacionesPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [updateDonorStatus, setUpdateDonorStatus] = useState(true)
  const [toast, setToast] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function loadFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseDonationsCSV(text)
    // Avisar cuántas filas se descartaron (sin fecha o sin monto válido).
    const dataLines = text.split(/\r?\n/).filter(l => l.trim()).length - 1
    const dropped = Math.max(0, dataLines - parsed.length)
    if (dropped > 0) showToast(`${dropped} fila${dropped !== 1 ? 's' : ''} sin fecha o monto válido se descartaron.`)
    setRows(parsed)
    setStep(2)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await loadFile(file)
  }

  function downloadTemplate() {
    generateCSV(
      // La columna moneda es opcional: si no viene, se importa en colones.
      ['cedula', 'nombre', 'fecha', 'monto', 'moneda'],
      [
        ['1-0847-0291', 'RUIZ MORENO ALEJANDRO', '2026-05-05', '50000', 'CRC'],
        ['2-0738-1094', 'FERNANDEZ LOPEZ SOFIA', '2026-05-10', '35000', 'CRC'],
      ],
      'plantilla-donaciones'
    )
  }

  async function handleConfirmImport() {
    if (importing || rows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/finance/donations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName || 'donaciones.csv',
          rows: rows.map(r => ({ cedula: r.cedula || null, donation_date: r.date, amount: r.amount, currency: r.currency })),
          update_donor_status: updateDonorStatus,
        }),
      })
      if (!res.ok) throw new Error()
      const batch = (await res.json()) as ImportResult
      showToast(`Importación completada — ${batch.identified} identificadas, ${batch.unidentified} sin identificar, ${batch.duplicates} duplicadas`)
      setTimeout(() => router.push('/finanzas/donaciones'), 2200)
    } catch {
      showToast('Error al importar las donaciones')
      setImporting(false)
    }
  }

  // En el preview solo sabemos si la fila trae cédula; la identificación real
  // (match contra miembros + duplicados) la hace el backend al importar.
  const conCedula = rows.filter(r => r.cedula).length
  const sinCedula = rows.length - conCedula

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => step === 1 ? router.push('/finanzas/donaciones') : setStep(s => (s - 1) as 1 | 2 | 3)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-[rgba(255,255,255,0.60)]"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl text-white font-display font-extrabold">
                Importar donaciones
              </h1>
              <p className="text-[12px] text-white/70 mt-0.5 font-body">
                {fileName || 'Cargá el archivo CSV del banco'}
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all font-display"
                  style={{
                    background: step > s ? '#3DB97A' : step === s ? '#EF5554' : 'rgba(255,255,255,0.15)',
                    color: step >= s ? 'white' : 'rgba(255,255,255,0.40)',
                  }}
                >
                  {step > s ? <Check size={13} /> : s}
                </div>
                <span className="text-[11px] hidden sm:block font-body" style={{ color: step === s ? 'white' : 'rgba(255,255,255,0.40)' }}>
                  {s === 1 ? 'Cargar' : s === 2 ? 'Previsualizar' : 'Confirmar'}
                </span>
                {idx < 2 && <ChevronRight size={14} className="text-[rgba(255,255,255,0.30)]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div className="rounded-2xl p-8 space-y-6 bg-surface-card shadow-[var(--shadow-md)]">
            <div
              className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-navy/30 hover:bg-navy/2 border-[rgba(22,20,64,0.20)]"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                // Sin preventDefault, soltar el archivo NAVEGABA fuera de la página.
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (!file) return
                if (!file.name.toLowerCase().endsWith('.csv')) {
                  showToast('El archivo debe ser un CSV.')
                  return
                }
                await loadFile(file)
              }}
            >
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[rgba(81,157,162,0.10)]">
                <CloudUpload size={32} className="text-teal-deep" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold font-display text-navy">
                  Arrastrá el CSV aquí
                </p>
                <p className="text-sm mt-1 font-body text-[rgba(22,20,64,0.60)]">
                  o hacé clic para seleccionar
                </p>
                <p className="text-[11px] mt-2 text-[rgba(22,20,64,0.35)] font-body">
                  Formato: cédula, nombre, fecha, monto
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all border border-[var(--outline-variant)] text-navy font-body"
              >
                <Download size={15} />
                Descargar plantilla CSV
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Preview */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Filas en el archivo', count: rows.length, color: '#161440', bg: 'rgba(22,20,64,0.06)', Icon: CheckCircle2 },
                { label: 'Con cédula', count: conCedula, color: '#3DB97A', bg: 'rgba(61,185,122,0.10)', Icon: CheckCircle2 },
                { label: 'Sin cédula', count: sinCedula, color: '#EF5554', bg: 'rgba(239,85,84,0.10)', Icon: XCircle },
              ].map(({ label, count, color, bg, Icon }) => (
                <div key={label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: bg }}>
                  <Icon size={20} className="shrink-0" style={{ color }} />
                  <div>
                    <p className="text-xl font-extrabold font-display" style={{ color }}>{count}</p>
                    <p className="text-[11px] font-body text-[rgba(22,20,64,0.60)]">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Cédula', 'Nombre del CSV', 'Fecha', 'Monto'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 transition-colors border-[var(--outline-variant)]">
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">{row.cedula}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-body text-navy">{row.csv_name || '—'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px] whitespace-nowrap text-[rgba(22,20,64,0.60)] font-body">
                            {new Date(row.date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-medium text-navy font-body">
                            {formatMoney(row.amount, row.currency)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(3)}
                className="rounded-full px-6 py-2.5 text-sm text-white font-medium bg-coral font-body"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="rounded-2xl p-8 space-y-6 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="space-y-2">
              <p className="text-base font-bold font-display text-navy">
                Resumen de importación
              </p>
              <p className="text-sm font-body text-[rgba(22,20,64,0.60)]">
                Revisá el resumen antes de confirmar
              </p>
            </div>

            <div className="rounded-xl p-5 space-y-3 bg-[rgba(22,20,64,0.03)] border border-[rgba(22,20,64,0.08)]">
              {[
                { label: 'Archivo', value: fileName || 'donaciones.csv' },
                { label: 'Total filas', value: `${rows.length}` },
                { label: 'Con cédula', value: `${conCedula}` },
                { label: 'Sin cédula', value: `${sinCedula}` },
                { label: 'Monto total', value: formatTotalsInline(sumByCurrency(rows)) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm font-body">
                  <span className="text-[rgba(22,20,64,0.55)]">{label}</span>
                  <span className="font-medium text-navy">{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateDonorStatus}
                  onChange={e => setUpdateDonorStatus(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-navy"
                />
                <div>
                  <p className="text-sm font-medium font-body text-navy">
                    Actualizar estado “Donador” en perfiles
                  </p>
                  <p className="text-[12px] text-[rgba(22,20,64,0.60)] font-body">
                    Marcará como donadores a los miembros identificados en esta importación
                  </p>
                </div>
              </label>
              {/* "Lógica familiar" se quitó: el backend no la implementa y el
                  checkbox se descartaba en silencio. */}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-full border px-5 py-2.5 text-sm transition-colors border-[var(--outline-variant)] text-[rgba(22,20,64,0.70)] font-body"
              >
                ← Atrás
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || rows.length === 0}
                className="flex-1 rounded-full py-2.5 text-sm text-white font-medium transition-all disabled:opacity-50 bg-[#3DB97A] font-body"
              >
                {importing ? 'Importando...' : 'Confirmar importación'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body"
        >
          <Check size={15} className="text-[#3DB97A]" />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}
