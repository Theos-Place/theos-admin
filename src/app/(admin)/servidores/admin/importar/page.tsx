'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, Download, Check, CheckCircle2, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { generateCSV } from '@/lib/export'

type PreviewRow = {
  committee: string
  location: string
  title: string
  quantity: number
  description: string
  study_requirement: string
  functions: string
  profile: string
  expires_at: string | null
  is_featured: boolean
}

type ImportResult = {
  inserted: number
  duplicates: number
  unmatched: Array<{ row: number; committee: string; title: string }>
}

// Normaliza para comparar headers sin tildes ni mayúsculas.
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []; let f = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(f); f = '' }
    else f += c
  }
  out.push(f); return out.map(s => s.trim())
}

function parseDate(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  // dd/mm/yyyy o dd-mm-yyyy
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

// Convierte una matriz [header, ...filas] al formato de filas previsualizadas.
function rowsFromAoa(aoa: string[][]): PreviewRow[] {
  if (aoa.length === 0) return []
  const header = aoa[0].map(norm)
  const idx = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const ci = idx('comite'), li = idx('ubicaci'), ti = idx('puesto', 'titulo', 'nombre'),
    qi = idx('cantidad'), di = idx('descrip'), ri = idx('categor', 'requisit'),
    fi = idx('funcion'), pi = idx('perfil'), ei = idx('expira', 'vence'), fe = idx('destacad')
  const at = (cols: string[], i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '')
  return aoa.slice(1)
    .filter(cols => cols.some(c => (c ?? '').trim() !== ''))
    .map(cols => ({
      committee: at(cols, ci),
      location: at(cols, li),
      title: at(cols, ti),
      quantity: Math.max(1, Number(at(cols, qi).replace(/[^\d]/g, '')) || 1),
      description: at(cols, di),
      study_requirement: at(cols, ri),
      functions: at(cols, fi),
      profile: at(cols, pi),
      expires_at: parseDate(at(cols, ei)),
      is_featured: TRUEY.has(norm(at(cols, fe))),
    }))
    .filter(r => r.title && r.committee)
}

async function parseFile(file: File): Promise<PreviewRow[]> {
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    return rowsFromAoa(lines.map(splitCSVLine))
  }
  const buf = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]
  return rowsFromAoa(aoa)
}

export default function ImportarPuestosPage() {
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

  function downloadTemplate() {
    generateCSV(
      ['comite', 'ubicacion', 'puesto', 'cantidad', 'descripcion', 'categoria', 'funciones', 'perfil', 'expiracion', 'destacado'],
      [
        ['PRO OESTE', 'Edificio Meridiano Escazú', 'Colaborador de Finanzas', '2', 'Administramos y cuidamos el dinero confiado a Theos', 'Discípulos 1', 'Agradeciendo a cada persona que dona, registrando aportes y conciliando cuentas', 'Honradas y ordenadas', '2026-07-07', 'TRUE'],
        ['ANTARES', 'Plaza Antares, San Pedro', 'Anfitrión de Bienvenida', '4', 'Recibe y orienta a los asistentes', 'N4 completado', 'Saludar, orientar, repartir material', 'Persona extrovertida y servicial', '2026-12-31', 'FALSE'],
      ],
      'plantilla-puestos',
    )
  }

  async function handleConfirmImport() {
    if (importing || rows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/servers/positions/import', {
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

  if (loaded && !hasRole(...SERVICE_ADMIN_ROLES)) return <AccessDenied />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-navy shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step === 1 ? router.push('/servidores/admin') : setStep(s => (s - 1) as 1 | 2 | 3))}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-white/60"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold">Importar puestos</h1>
            <p className="text-[12px] text-white/70 mt-0.5 font-body">{fileName || 'Cargá el archivo .xlsx o .csv'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold font-display"
                style={{
                  background: step > s ? '#3DB97A' : step === s ? '#EF5554' : 'rgba(255,255,255,0.15)',
                  color: step >= s ? 'white' : 'rgba(255,255,255,0.40)',
                }}
              >
                {step > s ? <Check size={13} /> : s}
              </div>
              <span className="text-[11px] hidden sm:block font-body" style={{ color: step === s ? 'white' : 'rgba(255,255,255,0.40)' }}>
                {s === 1 ? 'Cargar' : s === 2 ? 'Previsualizar' : 'Resultado'}
              </span>
              {idx < 2 && <ChevronRight size={14} className="text-white/30" />}
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
              <p className="text-base font-bold font-display text-navy">Subí el archivo de puestos</p>
              <p className="text-sm mt-1 font-body text-navy-light/60">.xlsx o .csv — hacé clic para seleccionar</p>
              <p className="text-[11px] mt-2 text-navy-light/70 font-body">
                Columnas: comité, ubicación, puesto, cantidad, descripción, categoría, funciones, perfil, expiración, destacado
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[var(--outline-variant)] text-navy font-body"
            >
              <Download size={15} /> Descargar plantilla CSV
            </button>
            <p className="text-[11px] text-navy-light/70 font-body text-center max-w-md">
              <strong>categoria</strong> = nivel de estudio requerido ·{' '}
              <strong>expiracion</strong> = fecha YYYY-MM-DD ·{' '}
              <strong>destacado</strong> = TRUE/FALSE. El comité se matchea por nombre contra los comités de la BD.
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
              <p className="text-[11px] font-body text-navy-light/60">puestos válidos en el archivo (con comité y puesto)</p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {['Comité', 'Puesto', 'Ubicación', 'Cant.', 'Categoría', 'Destacado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest font-display text-navy-light/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--outline-variant)]">
                      <td className="px-4 py-2.5 text-[13px] text-navy font-body">{r.committee}</td>
                      <td className="px-4 py-2.5 text-[13px] text-navy font-body">{r.title}</td>
                      <td className="px-4 py-2.5 text-[12px] text-navy-light/70 font-body">{r.location || '—'}</td>
                      <td className="px-4 py-2.5 text-[13px] text-navy font-body">{r.quantity}</td>
                      <td className="px-4 py-2.5 text-[12px] text-navy-light/70 font-body">{r.study_requirement || '—'}</td>
                      <td className="px-4 py-2.5 text-[12px] font-body">{r.is_featured ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && (
              <p className="px-4 py-3 text-[12px] text-navy-light/60 font-body border-t border-[var(--outline-variant)]">
                Mostrando 100 de {rows.length}. Se importarán todas.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleConfirmImport}
              disabled={importing || rows.length === 0}
              className="rounded-full px-6 py-2.5 text-sm text-white font-medium bg-coral disabled:opacity-50 font-body"
            >
              {importing ? 'Importando…' : `Importar ${rows.length} puestos`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && result && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Insertados', count: result.inserted, color: '#3DB97A', bg: 'rgba(61,185,122,0.10)' },
              { label: 'Duplicados (omitidos)', count: result.duplicates, color: '#E9B949', bg: 'rgba(233,185,73,0.12)' },
              { label: 'Sin comité', count: result.unmatched.length, color: '#EF5554', bg: 'rgba(239,85,84,0.10)' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: bg }}>
                <p className="text-2xl font-extrabold font-display" style={{ color }}>{count}</p>
                <p className="text-[12px] font-body text-navy-light/70">{label}</p>
              </div>
            ))}
          </div>

          {result.unmatched.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
              <div className="px-4 py-3 border-b border-[var(--outline-variant)] flex items-center gap-2">
                <AlertCircle size={15} className="text-coral" />
                <p className="text-[12px] font-semibold text-navy font-body">Filas sin comité (revisá el nombre contra los comités de la BD)</p>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Fila', 'Comité del archivo', 'Puesto'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-display text-navy-light/60">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.unmatched.map((u, i) => (
                      <tr key={i} className="border-b border-[var(--outline-variant)]">
                        <td className="px-4 py-2 text-[12px] text-navy-light/70 font-body">{u.row}</td>
                        <td className="px-4 py-2 text-[13px] text-coral font-body">{u.committee || '—'}</td>
                        <td className="px-4 py-2 text-[13px] text-navy font-body">{u.title}</td>
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
            <button onClick={() => router.push('/servidores/admin')}
              className="rounded-full px-5 py-2.5 text-sm text-white bg-navy font-body">
              Volver a mantenimiento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
