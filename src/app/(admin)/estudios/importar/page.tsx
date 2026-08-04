'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { CloudUpload, Download, CheckCircle2, AlertCircle, AlertTriangle, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'
import type { GroupImportRow } from '@/lib/studies/group-import-rules'
import { PageContainer } from '@/components/layout/PageContainer'

// EST-2: importación masiva de grupos de estudio desde CSV/XLSX (mismo patrón
// que importar-vacantes). El preview usa el POST con dry_run=true, así los
// errores por fila que se muestran son EXACTAMENTE los del server.

type ImportResult = {
  inserted: number
  valid: number
  errors: Array<{ row: number; reason: string }>
  warnings: Array<{ row: number; reason: string }>
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
  const s = (v ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

function rowsFromAoa(aoa: string[][]): GroupImportRow[] {
  if (aoa.length === 0) return []
  const header = aoa[0].map(norm)
  const idx = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const pi = idx('plan'), zi = idx('zona', 'sede'), di = idx('dia', 'día'), hi = idx('horario'),
    fii = idx('fecha inicio', 'inicio del grupo'), ffi = idx('fecha fin', 'fin del grupo'),
    ci = idx('cupo'), cedi = idx('cedula', 'cédula', 'documento'),
    imi = idx('inicio de matricula', 'inicio de matrícula'), fmi = idx('fin de matricula', 'fin de matrícula')
  const at = (cols: string[], i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '')
  return aoa.slice(1)
    .filter(cols => cols.some(c => (c ?? '').trim() !== ''))
    .map(cols => ({
      plan: at(cols, pi),
      zona: at(cols, zi),
      dia: at(cols, di),
      horario: at(cols, hi),
      fecha_inicio: parseDate(at(cols, fii)),
      fecha_fin: parseDate(at(cols, ffi)),
      cupo: at(cols, ci),
      cedula_dirigente: at(cols, cedi),
      inicio_matricula: parseDate(at(cols, imi)),
      fin_matricula: parseDate(at(cols, fmi)),
    }))
    .filter(r => r.plan || r.zona || r.cedula_dirigente)
}

async function parseFile(file: File): Promise<GroupImportRow[]> {
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

export default function ImportarGruposPage() {
  const { user, loaded } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<GroupImportRow[]>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const canImport = (user?.roles ?? []).some(r => (STUDY_ADMIN_ROLES as readonly string[]).includes(r) || r === 'admin')
  if (loaded && !canImport) return <AccessDenied />

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const parsed = await parseFile(file)
      if (parsed.length === 0) { setError('El archivo no tiene filas con datos.'); return }
      setFileName(file.name)
      setRows(parsed)
      // Preview server-side: dry_run valida sin insertar.
      const res = await fetch('/api/studies/groups/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed, dry_run: true }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
      setPreview(await res.json())
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function confirmImport() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/studies/groups/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
      setResult(await res.json())
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar.')
    } finally {
      setBusy(false)
    }
  }

  const issueByRow = new Map<number, { kind: 'error' | 'warning'; reason: string }>()
  for (const w of preview?.warnings ?? []) issueByRow.set(w.row, { kind: 'warning', reason: w.reason })
  for (const e of preview?.errors ?? []) issueByRow.set(e.row, { kind: 'error', reason: e.reason })

  return (
    <PageContainer width="form" className="page space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/estudios" className="text-navy-light/60 hover:text-navy" aria-label="Volver a estudios">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy font-display">Importar grupos de estudio</h1>
          <p className="text-[13px] text-navy-light/70 font-body">{fileName || 'CSV o Excel con un grupo por fila'}</p>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Descarga de un route handler (no una página): Link no aplica. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/studies/groups/import-template"
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 px-4 py-2 text-sm text-navy hover:bg-surface-low transition-colors font-body"
          >
            <Download size={15} /> Descargar plantilla (.xlsx)
          </a>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-navy/20 bg-surface-card px-6 py-14 text-center hover:border-coral/40 transition-colors"
          >
            {busy ? <Loader2 size={28} className="mx-auto animate-spin text-navy-light/60" /> : <CloudUpload size={28} className="mx-auto text-navy-light/60" />}
            <p className="mt-2 text-sm font-medium text-navy font-display">Cargar archivo</p>
            <p className="text-sm mt-1 font-body text-navy-light/60">.xlsx o .csv — hacé clic para seleccionar</p>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          {error && <p className="text-sm text-coral font-body inline-flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-body">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/30 px-3 py-1 text-teal-deep"><CheckCircle2 size={14} /> {preview.valid} válidas</span>
            {preview.warnings.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700"><AlertTriangle size={14} /> {preview.warnings.length} advertencias</span>}
            {preview.errors.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1 text-coral-deep"><AlertCircle size={14} /> {preview.errors.length} con error (no se importan)</span>}
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-[13px] font-body">
                <thead className="sticky top-0 bg-surface-low">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-navy-light/60 font-display">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Zona</th>
                    <th className="px-3 py-2">Día / hora</th>
                    <th className="px-3 py-2">Inicio</th>
                    <th className="px-3 py-2">Cupo</th>
                    <th className="px-3 py-2">Cédula dirigente</th>
                    <th className="px-3 py-2">Matrícula</th>
                    <th className="px-3 py-2">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const issue = issueByRow.get(i + 2)
                    return (
                      <tr key={i} className={issue?.kind === 'error' ? 'bg-coral/5' : issue?.kind === 'warning' ? 'bg-amber-50/60' : ''}>
                        <td className="px-3 py-1.5 text-navy-light/50">{i + 2}</td>
                        <td className="px-3 py-1.5 text-navy">{r.plan || '—'}</td>
                        <td className="px-3 py-1.5">{r.zona || 'Todas'}</td>
                        <td className="px-3 py-1.5">{[r.dia, r.horario].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-3 py-1.5">{r.fecha_inicio || '—'}</td>
                        <td className="px-3 py-1.5">{r.cupo || '—'}</td>
                        <td className="px-3 py-1.5">{r.cedula_dirigente || '—'}</td>
                        <td className="px-3 py-1.5">{r.inicio_matricula || r.fin_matricula ? `${r.inicio_matricula ?? '…'} → ${r.fin_matricula ?? '…'}` : '—'}</td>
                        <td className={issue?.kind === 'error' ? 'px-3 py-1.5 text-coral-deep' : 'px-3 py-1.5 text-amber-700'}>{issue?.reason ?? ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-sm text-coral font-body inline-flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}

          <div className="flex justify-between">
            <button type="button" onClick={() => { setStep(1); setPreview(null); setRows([]); setFileName('') }} className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
              Elegir otro archivo
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={busy || preview.valid === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-sm text-white disabled:opacity-50 font-body"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
              Importar {preview.valid} grupo{preview.valid !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="rounded-2xl bg-surface-card p-8 text-center shadow-[var(--shadow-md)] space-y-3">
          <CheckCircle2 size={32} className="mx-auto text-teal-deep" />
          <p className="text-lg font-bold text-navy font-display">{result.inserted} grupo{result.inserted !== 1 ? 's' : ''} importado{result.inserted !== 1 ? 's' : ''}</p>
          {result.warnings.length > 0 && (
            <p className="text-sm text-amber-700 font-body">{result.warnings.length} advertencia{result.warnings.length !== 1 ? 's' : ''} (grupos sin dirigente por cédula sin match).</p>
          )}
          {result.errors.length > 0 && (
            <div className="mx-auto max-w-lg rounded-xl bg-coral/5 px-4 py-3 text-left text-[13px] text-coral-deep font-body">
              {result.errors.slice(0, 10).map(e => <p key={e.row}>Fila {e.row}: {e.reason}</p>)}
              {result.errors.length > 10 && <p>… y {result.errors.length - 10} más.</p>}
            </div>
          )}
          <Link href="/estudios/grupos" className="inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2 text-sm text-white font-body">
            Ver grupos <ChevronRight size={15} />
          </Link>
        </div>
      )}
    </PageContainer>
  )
}
