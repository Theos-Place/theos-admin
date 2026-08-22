'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, Download, Check, CheckCircle2, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'

type PreviewRow = {
  area: string
  committee: string
  position: string
  slots: number
  location: string
  schedule: string
  commitment: string
  expires_at: string | null
  is_featured: boolean
}

type ImportResult = {
  inserted: number
  errors: Array<{ row: number; reason: string }>
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  const pushField = () => { row.push(field.trim()); field = '' }
  const pushRow = () => { pushField(); if (row.some(f => f !== '')) rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') pushField()
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow() }
    else field += c
  }
  if (field !== '' || row.length) pushRow()
  return rows
}

function parseDate(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

const TRUEY = new Set(['si', 'sí', 'true', 'x', '1', 'yes', 'verdadero'])

function rowsFromAoa(aoa: string[][]): PreviewRow[] {
  if (aoa.length === 0) return []
  const header = aoa[0].map(norm)
  const idx = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const ai = idx('area', 'área'), ci = idx('comite', 'comité'), ti = idx('puesto', 'titulo', 'nombre'),
    qi = idx('cupo', 'cantidad'), li = idx('ubicaci', 'sede'), si = idx('horario'),
    coi = idx('compromiso'), ei = idx('expira', 'vence'), fe = idx('destacad')
  const at = (cols: string[], i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '')
  return aoa.slice(1)
    .filter(cols => cols.some(c => (c ?? '').trim() !== ''))
    .map(cols => ({
      area: at(cols, ai),
      committee: at(cols, ci),
      position: at(cols, ti),
      slots: Math.max(1, Number(at(cols, qi).replace(/[^\d]/g, '')) || 1),
      location: at(cols, li),
      schedule: at(cols, si),
      commitment: at(cols, coi),
      expires_at: parseDate(at(cols, ei)),
      is_featured: TRUEY.has(norm(at(cols, fe))),
    }))
    .filter(r => r.area || r.committee || r.position)
}

async function parseFile(file: File): Promise<PreviewRow[]> {
  if (/\.csv$/i.test(file.name)) {
    return rowsFromAoa(parseCSV(await file.text()))
  }
  const buf = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]
  return rowsFromAoa(aoa)
}

export default function ImportarVacantesPage() {
  const router = useRouter()
  const { hasRole, loaded } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setRows(await parseFile(file))
    setStep(2)
  }

  async function handleConfirmImport() {
    if (importing || rows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/servers/vacancies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) throw new Error()
      setResult((await res.json()) as ImportResult)
      setStep(3)
    } catch {
      setImporting(false)
    } finally {
      setImporting(false)
    }
  }

  if (loaded && !hasRole('admin', ...STAFF_IMPORT_ROLES)) return <AccessDenied />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step === 1 ? router.push('/servidores/admin') : setStep(s => (s - 1) as 1 | 2 | 3))}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-white/80"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold">Importar vacantes</h1>
            <p className="text-[13px] text-white/80 mt-0.5 font-body">{fileName || 'Cargá el archivo .xlsx o .csv'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-bold font-display"
                style={{
                  background: step > s ? '#3DB97A' : step === s ? '#D63E3D' : 'rgba(255,255,255,0.15)',
                  color: step >= s ? 'white' : 'rgba(255,255,255,0.40)',
                }}
              >
                {step > s ? <Check size={13} /> : s}
              </div>
              <span className="text-[13px] hidden sm:block font-body" style={{ color: step === s ? 'white' : 'rgba(255,255,255,0.40)' }}>
                {s === 1 ? 'Cargar' : s === 2 ? 'Previsualizar' : 'Resultado'}
              </span>
              {idx < 2 && <ChevronRight size={14} className="text-white/40" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="rounded-2xl p-8 space-y-6 bg-surface-card shadow-[var(--shadow-md)]">
          <div
            className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-navy/30 border-[rgba(22,20,64,0.20)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[rgba(81,157,162,0.10)]">
              <CloudUpload size={32} className="text-teal-deep" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold font-display text-navy">Subí el archivo de vacantes</p>
              <p className="text-sm mt-1 font-body text-navy-light/80">.xlsx o .csv — hacé clic para seleccionar</p>
              <p className="text-[13px] mt-2 text-navy-light/80 font-body">
                Columnas: área, comité, puesto, cupos, ubicación, horario, compromiso, expiración, destacado
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>
          <div className="flex flex-col items-center gap-2">
            {/* Descarga de un route handler (no una página): Link no aplica. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/servers/vacancies/import-template"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[var(--outline-variant)] text-navy font-body hover:bg-surface-low transition-colors"
            >
              <Download size={15} /> Descargar plantilla Excel
            </a>
            <p className="text-[13px] text-navy-light/80 font-body text-center max-w-md">
              La plantilla trae las <strong>áreas, comités y puestos actuales</strong> con listas
              desplegables en cascada (Área → Comité → Puesto). La vacante hereda descripción/funciones/perfil
              del puesto. <strong>destacado</strong> = Sí/No · <strong>expiración</strong> = YYYY-MM-DD.
            </p>
          </div>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl p-4 flex items-center gap-3 bg-[rgba(22,20,64,0.06)]">
            <CheckCircle2 size={20} className="text-navy shrink-0" />
            <div>
              <p className="text-xl font-extrabold font-display text-navy">{rows.length}</p>
              <p className="text-[13px] font-body text-navy-light/80">filas en el archivo · se validan al importar</p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {['Área', 'Comité', 'Puesto', 'Cupos', 'Ubicación', 'Horario', 'Compromiso', 'Expiración', 'Destacado'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-widest font-display text-navy-light/80 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--outline-variant)] align-top">
                      <td className="px-3 py-2.5 text-[13px] text-navy font-body whitespace-nowrap">{r.area || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy font-body whitespace-nowrap">{r.committee || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy font-body">{r.position || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy font-body text-center">{r.slots}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy-light/80 font-body">{r.location || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy-light/80 font-body">{r.schedule || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy-light/80 font-body">{r.commitment || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{r.expires_at || '—'}</td>
                      <td className="px-3 py-2.5 text-[13px] font-body text-center">{r.is_featured ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && (
              <p className="px-4 py-3 text-[13px] text-navy-light/80 font-body border-t border-[var(--outline-variant)]">
                Mostrando 100 de {rows.length}. Se validan e importan todas.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleConfirmImport}
              disabled={importing || rows.length === 0}
              className="rounded-full px-6 py-2.5 text-sm text-white font-medium bg-coral disabled:opacity-50 font-body"
            >
              {importing ? 'Importando…' : `Importar ${rows.length} vacantes`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && result && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Importadas', count: result.inserted, color: '#3DB97A', bg: 'rgba(61,185,122,0.10)' },
              { label: 'Filas con error (no importadas)', count: result.errors.length, color: '#C43635', bg: 'rgba(239,85,84,0.10)' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: bg }}>
                <p className="text-2xl font-extrabold font-display" style={{ color }}>{count}</p>
                <p className="text-[13px] font-body text-navy-light/80">{label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="px-4 py-3 border-b border-[var(--outline-variant)] flex items-center gap-2">
                <AlertCircle size={15} className="text-coral" />
                <p className="text-[13px] font-semibold text-navy font-body">Filas rechazadas — corregilas en el Excel y volvé a importar</p>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Fila', 'Motivo'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest font-display text-navy-light/80">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((u, i) => (
                      <tr key={i} className="border-b border-[var(--outline-variant)]">
                        <td className="px-4 py-2 text-[13px] text-navy-light/80 font-body whitespace-nowrap">Fila {u.row}</td>
                        <td className="px-4 py-2 text-[13px] text-navy font-body">{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setRows([]); setResult(null); setFileName('') }}
              className="rounded-full border px-5 py-2.5 text-sm border-[var(--outline-variant)] text-navy-light font-body">
              Importar otro archivo
            </button>
            <button onClick={() => router.push('/servidores/vacantes')}
              className="rounded-full px-5 py-2.5 text-sm text-white bg-navy font-body">
              Ver vacantes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
