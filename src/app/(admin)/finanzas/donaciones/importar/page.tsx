'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, Download, Check, CheckCircle2, AlertCircle, XCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { generateCSV } from '@/lib/export'

type RowStatus = 'identified' | 'possible' | 'unidentified'

interface PreviewRow {
  cedula: string
  csv_name: string
  identified_name: string | null
  date: string
  amount: number
  status: RowStatus
  confirmed?: boolean
}

const MOCK_MEMBERS_SAMPLE = [
  { cedula: '1-0847-0291', name: 'Alejandro Ruiz Moreno' },
  { cedula: '2-0738-1094', name: 'Sofía Fernández López' },
  { cedula: '3-0492-1857', name: 'Marcos García Vidal' },
  { cedula: '4-0283-7610', name: 'Daniel Torres Blanco' },
  { cedula: '3-0948-2016', name: 'Valeria Sánchez Romero' },
  { cedula: '2-0561-0782', name: 'Carmen Delgado Nieto' },
  { cedula: '5-0371-2948', name: 'Andrés Vargas Solís' },
  { cedula: '6-0182-4073', name: 'María José Rojas Picado' },
  { cedula: '1-1034-6281', name: 'Kevin Arias Mora' },
]

function generateMockRows(): PreviewRow[] {
  const base: PreviewRow[] = [
    { cedula: '1-0847-0291', csv_name: 'RUIZ MORENO ALEJANDRO', identified_name: 'Alejandro Ruiz Moreno', date: '2026-05-05', amount: 50000, status: 'identified' },
    { cedula: '2-0738-1094', csv_name: 'FERNANDEZ LOPEZ SOFIA', identified_name: 'Sofía Fernández López', date: '2026-05-10', amount: 35000, status: 'identified' },
    { cedula: '4-0283-7610', csv_name: 'TORRES BLANCO DANIEL', identified_name: 'Daniel Torres Blanco', date: '2026-05-28', amount: 75000, status: 'identified' },
    { cedula: '2-0561-0782', csv_name: 'DELGADO NIETO CARMEN', identified_name: 'Carmen Delgado Nieto', date: '2026-05-08', amount: 60000, status: 'identified' },
    { cedula: '3-0492-1857', csv_name: 'GARCIA VIDAL MARCOS', identified_name: 'Marcos García Vidal', date: '2026-05-12', amount: 40000, status: 'identified' },
    { cedula: '3-0948-2016', csv_name: 'SANCHEZ ROMERO VALERIA', identified_name: 'Valeria Sánchez Romero', date: '2026-05-03', amount: 30000, status: 'identified' },
    { cedula: '5-0371-2948', csv_name: 'VARGAS SOLIS ANDRES', identified_name: 'Andrés Vargas Solís', date: '2026-05-10', amount: 45000, status: 'identified' },
    { cedula: '6-0182-4073', csv_name: 'ROJAS PICADO MARIA JOSE', identified_name: 'María José Rojas Picado', date: '2026-05-14', amount: 20000, status: 'identified' },
    { cedula: '1-1034-6281', csv_name: 'ARIAS MORA KEVIN', identified_name: 'Kevin Arias Mora', date: '2026-05-15', amount: 55000, status: 'identified' },
    { cedula: '2-0456-7890', csv_name: 'MORA QUESADA ROBERTO', identified_name: 'Roberto Mora Quesada', date: '2026-05-06', amount: 25000, status: 'identified' },
    { cedula: '1-0923-4567', csv_name: 'BRENES ARAYA ANDREA', identified_name: 'Andrea Brenes Araya', date: '2026-05-09', amount: 42000, status: 'identified' },
    { cedula: '3-0567-1234', csv_name: 'CAMPOS SOLANO LUIS', identified_name: 'Luis Campos Solano', date: '2026-05-11', amount: 18000, status: 'identified' },
    { cedula: '4-0891-2345', csv_name: 'HERRERA VEGA PATRICIA', identified_name: 'Patricia Herrera Vega', date: '2026-05-13', amount: 33000, status: 'identified' },
    { cedula: '1-0673-9012', csv_name: 'NUNEZ FALLAS JOSE', identified_name: 'José Núñez Fallas', date: '2026-05-16', amount: 27000, status: 'identified' },
    { cedula: '2-0345-6789', csv_name: 'PORRAS JIMENEZ ANA', identified_name: 'Ana Porras Jiménez', date: '2026-05-17', amount: 52000, status: 'identified' },
    { cedula: '5-0678-3456', csv_name: 'VINDAS MEZA CARLOS', identified_name: 'Carlos Vindas Meza', date: '2026-05-18', amount: 38000, status: 'identified' },
    { cedula: '3-0234-5678', csv_name: 'OBANDO LEON DIANA', identified_name: 'Diana Obando León', date: '2026-05-19', amount: 21000, status: 'identified' },
    // 2 possible matches
    { cedula: '1-0847-0292', csv_name: 'RUIZ MORENO A', identified_name: 'Alejandro Ruiz Moreno', date: '2026-05-20', amount: 15000, status: 'possible' },
    { cedula: '6-0182-4072', csv_name: 'ROJAS PICADO M', identified_name: 'María José Rojas Picado', date: '2026-05-21', amount: 10000, status: 'possible' },
    // 1 unidentified
    { cedula: '9-9999-9999', csv_name: 'DONANTE ANONIMO', identified_name: null, date: '2026-05-22', amount: 150000, status: 'unidentified' },
  ]
  return base
}

const IDENTIFIED_COUNT = 17
const POSSIBLE_COUNT = 2
const UNIDENTIFIED_COUNT = 1

export default function ImportarDonacionesPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [updateDonorStatus, setUpdateDonorStatus] = useState(true)
  const [applyFamilyLogic, setApplyFamilyLogic] = useState(false)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setRows(generateMockRows())
    setStep(2)
  }

  function downloadTemplate() {
    generateCSV(
      ['cedula', 'nombre', 'fecha', 'monto'],
      [
        ['1-0847-0291', 'RUIZ MORENO ALEJANDRO', '2026-05-05', '50000'],
        ['2-0738-1094', 'FERNANDEZ LOPEZ SOFIA', '2026-05-10', '35000'],
      ],
      'plantilla-donaciones'
    )
  }

  function confirmPossible(index: number) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, confirmed: true, status: 'identified' } : r))
  }

  function handleConfirmImport() {
    showToast('Importación completada — 20 donaciones procesadas')
    setTimeout(() => router.push('/finanzas/donaciones'), 1800)
  }

  const statusCount = {
    identified: rows.filter(r => r.status === 'identified').length,
    possible: rows.filter(r => r.status === 'possible').length,
    unidentified: rows.filter(r => r.status === 'unidentified').length,
  }

  return (
    <FinanceGuard>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between"
          style={{ background: '#161440', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => step === 1 ? router.push('/finanzas/donaciones') : setStep(s => (s - 1) as 1 | 2 | 3)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.60)' }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Importar donaciones
              </h1>
              <p className="text-[12px] text-white/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                {fileName || 'Cargá el archivo CSV del banco'}
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all"
                  style={{
                    background: step > s ? '#3DB97A' : step === s ? '#EF5554' : 'rgba(255,255,255,0.15)',
                    color: step >= s ? 'white' : 'rgba(255,255,255,0.40)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {step > s ? <Check size={13} /> : s}
                </div>
                <span className="text-[11px] hidden sm:block" style={{ color: step === s ? 'white' : 'rgba(255,255,255,0.40)', fontFamily: 'var(--font-body)' }}>
                  {s === 1 ? 'Cargar' : s === 2 ? 'Previsualizar' : 'Confirmar'}
                </span>
                {idx < 2 && <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.30)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div className="rounded-2xl p-8 space-y-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div
              className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-navy/30 hover:bg-navy/2"
              style={{ borderColor: 'rgba(22,20,64,0.20)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(81,157,162,0.10)' }}>
                <CloudUpload size={32} style={{ color: '#519DA2' }} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
                  Arrastrá el CSV aquí
                </p>
                <p className="text-sm mt-1" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.50)' }}>
                  o hacé clic para seleccionar
                </p>
                <p className="text-[11px] mt-2" style={{ color: 'rgba(22,20,64,0.35)', fontFamily: 'var(--font-body)' }}>
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
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all border"
                style={{ borderColor: 'var(--outline-variant)', color: '#161440', fontFamily: 'var(--font-body)' }}
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Identificados', count: IDENTIFIED_COUNT, color: '#3DB97A', bg: 'rgba(61,185,122,0.10)', Icon: CheckCircle2 },
                { label: 'Posible coincidencia', count: POSSIBLE_COUNT, color: '#E9B949', bg: 'rgba(233,185,73,0.10)', Icon: AlertCircle },
                { label: 'No identificados', count: UNIDENTIFIED_COUNT, color: '#EF5554', bg: 'rgba(239,85,84,0.10)', Icon: XCircle },
              ].map(({ label, count, color, bg, Icon }) => (
                <div key={label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: bg }}>
                  <Icon size={20} style={{ color, flexShrink: 0 }} />
                  <div>
                    <p className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', color }}>{count}</p>
                    <p className="text-[11px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.60)' }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Cédula', 'Nombre del CSV', 'Miembro identificado', 'Fecha', 'Monto', 'Estado'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widest"
                          style={{ fontFamily: 'var(--font-display)', color: 'rgba(22,20,64,0.40)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--outline-variant)' }}>
                        <td className="px-5 py-3">
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.70)' }}>{row.cedula}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>{row.csv_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          {row.status === 'identified' && (
                            <p className="text-[13px] font-medium" style={{ color: '#3DB97A', fontFamily: 'var(--font-body)' }}>
                              ✓ {row.identified_name}
                            </p>
                          )}
                          {row.status === 'possible' && !row.confirmed && (
                            <div className="flex items-center gap-2">
                              <p className="text-[13px]" style={{ color: '#E9B949', fontFamily: 'var(--font-body)' }}>
                                ⚠ {row.identified_name}
                              </p>
                              <button
                                onClick={() => confirmPossible(i)}
                                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                                style={{ background: 'rgba(233,185,73,0.15)', color: '#9B7200', fontFamily: 'var(--font-body)' }}
                              >
                                Confirmar
                              </button>
                            </div>
                          )}
                          {row.status === 'possible' && row.confirmed && (
                            <p className="text-[13px] font-medium" style={{ color: '#3DB97A', fontFamily: 'var(--font-body)' }}>
                              ✓ {row.identified_name} (confirmado)
                            </p>
                          )}
                          {row.status === 'unidentified' && (
                            <p className="text-[13px]" style={{ color: '#EF5554', fontFamily: 'var(--font-body)' }}>
                              ✗ No identificado
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px] whitespace-nowrap" style={{ color: 'rgba(22,20,64,0.60)', fontFamily: 'var(--font-body)' }}>
                            {new Date(row.date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-medium" style={{ color: '#161440', fontFamily: 'var(--font-body)' }}>
                            ₡{row.amount.toLocaleString('es-CR')}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              color: row.status === 'identified' ? '#3DB97A' : row.status === 'possible' ? '#E9B949' : '#EF5554',
                              background: row.status === 'identified' ? 'rgba(61,185,122,0.10)' : row.status === 'possible' ? 'rgba(233,185,73,0.10)' : 'rgba(239,85,84,0.10)',
                            }}
                          >
                            {row.status === 'identified' ? 'Identificado' : row.status === 'possible' ? 'Por confirmar' : 'No identificado'}
                          </span>
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
                className="rounded-full px-6 py-2.5 text-sm text-white font-medium"
                style={{ background: '#EF5554', fontFamily: 'var(--font-body)' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="rounded-2xl p-8 space-y-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="space-y-2">
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: '#161440' }}>
                Resumen de importación
              </p>
              <p className="text-sm" style={{ fontFamily: 'var(--font-body)', color: 'rgba(22,20,64,0.60)' }}>
                Revisá el resumen antes de confirmar
              </p>
            </div>

            <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(22,20,64,0.03)', border: '1px solid rgba(22,20,64,0.08)' }}>
              {[
                { label: 'Archivo', value: fileName || 'donaciones-importadas.csv' },
                { label: 'Total filas', value: '20' },
                { label: 'Identificados', value: `${IDENTIFIED_COUNT + POSSIBLE_COUNT}` },
                { label: 'Sin identificar', value: `${UNIDENTIFIED_COUNT}` },
                { label: 'Monto total', value: `₡${rows.reduce((s, r) => s + r.amount, 0).toLocaleString('es-CR')}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                  <span style={{ color: 'rgba(22,20,64,0.55)' }}>{label}</span>
                  <span className="font-medium" style={{ color: '#161440' }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateDonorStatus}
                  onChange={e => setUpdateDonorStatus(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded"
                  style={{ accentColor: '#161440' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                    Actualizar estado "Donador" en perfiles
                  </p>
                  <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
                    Marcará como donadores a los miembros identificados en esta importación
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyFamilyLogic}
                  onChange={e => setApplyFamilyLogic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded"
                  style={{ accentColor: '#161440' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-body)', color: '#161440' }}>
                    Aplicar lógica familiar
                  </p>
                  <p className="text-[12px]" style={{ color: 'rgba(22,20,64,0.50)', fontFamily: 'var(--font-body)' }}>
                    Agrupa donaciones de miembros del mismo núcleo familiar
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-full border px-5 py-2.5 text-sm transition-colors"
                style={{ borderColor: 'var(--outline-variant)', color: 'rgba(22,20,64,0.70)', fontFamily: 'var(--font-body)' }}
              >
                ← Atrás
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 rounded-full py-2.5 text-sm text-white font-medium transition-all"
                style={{ background: '#3DB97A', fontFamily: 'var(--font-body)' }}
              >
                Confirmar importación
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}
        >
          <Check size={15} style={{ color: '#3DB97A' }} />
          {toast}
        </div>
      )}
    </FinanceGuard>
  )
}
