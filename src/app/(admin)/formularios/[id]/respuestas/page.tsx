'use client'

import { useMemo, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { type FormResponse, type FormTemplate } from '@/types/forms'
import { toDomainFormTemplate, toDomainFormResponse } from '@/lib/forms/adapter'
import { ResponseSummaryChart } from '@/components/forms/ResponseSummaryChart'
import { cn } from '@/lib/utils'
import { ChevronLeft, Download, X, ChevronRight } from 'lucide-react'

function exportToCSV(form: FormTemplate | null, responses: FormResponse[]) {
  if (!form) return
  const dataFields = form.fields.filter(f => f.type !== 'section')
  const headers = ['Miembro', 'Fecha', ...dataFields.map(f => f.label)]
  const rows = responses.map(r => [
    r.member_name,
    new Date(r.submitted_at).toLocaleDateString('es-CR'),
    ...dataFields.map(f => {
      const ans = r.answers[f.id]
      return Array.isArray(ans) ? ans.join(', ') : String(ans ?? '')
    }),
  ])
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${form.name.replace(/\s+/g, '-')}-respuestas.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function RespuestasPage() {
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<FormTemplate | null>(null)
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [detailResponse, setDetailResponse] = useState<FormResponse | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/forms/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/forms/${id}/responses`).then(r => (r.ok ? r.json() : [])),
    ]).then(([f, rs]) => {
      if (!alive) return
      setForm(f ? toDomainFormTemplate(f) : null)
      setResponses(Array.isArray(rs) ? rs.map(toDomainFormResponse) : [])
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  const dataFields = (form?.fields ?? []).filter(f => f.type !== 'section')

  type ChartData = { field: FormTemplate['fields'][number]; items: { label: string; count: number; total: number }[]; average: number | undefined }

  // Build summary data for chartable fields (hook antes de cualquier return condicional)
  const summaryCharts = useMemo((): ChartData[] => {
    return dataFields
      .filter(f => ['scale', 'radio', 'select', 'yes_no', 'checkbox'].includes(f.type))
      .flatMap(f => {
        const allAnswers = responses.map(r => r.answers[f.id]).filter(v => v !== undefined && v !== null && v !== '') as (string | string[] | number)[]

        if (f.type === 'scale') {
          const min = f.scale_min ?? 1
          const max = f.scale_max ?? 5
          const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
          const items = nums.map(n => ({
            label: String(n),
            count: allAnswers.filter(a => Number(a) === n).length,
            total: allAnswers.length,
          }))
          const avg = allAnswers.length > 0
            ? allAnswers.reduce((sum: number, a) => sum + Number(a), 0) / allAnswers.length
            : 0
          return { field: f, items, average: avg }
        }

        if (f.type === 'yes_no') {
          const items = ['Sí', 'No'].map(v => ({
            label: v,
            count: allAnswers.filter(a => a === v).length,
            total: allAnswers.length,
          }))
          return { field: f, items, average: undefined }
        }

        if (f.type === 'radio' || f.type === 'select') {
          const opts = f.options ?? []
          const items = opts.map(o => ({
            label: o,
            count: allAnswers.filter(a => a === o).length,
            total: allAnswers.length,
          }))
          return { field: f, items, average: undefined }
        }

        if (f.type === 'checkbox') {
          const opts = f.options ?? []
          const flat = allAnswers.flatMap(a => Array.isArray(a) ? a : [a])
          const items = opts.map(o => ({
            label: o,
            count: flat.filter(v => v === o).length,
            total: allAnswers.length,
          }))
          return { field: f, items, average: undefined }
        }

        return null
      })
      .filter((c): c is ChartData => c !== null)
  }, [dataFields, responses])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Cargando…</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Formulario no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/formularios"
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors mb-2"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={15} />
            Formularios
          </Link>
          <h1 className="text-2xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {form.name}
          </h1>
          <p className="text-sm text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            {responses.length} respuesta{responses.length !== 1 ? 's' : ''} · {dataFields.length} campos
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/formularios/${id}`}
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Editar formulario
          </Link>
          <button
            type="button"
            onClick={() => exportToCSV(form, responses)}
            className="flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      {responses.length === 0 ? (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Este formulario todavía no tiene respuestas.
          </p>
          <Link
            href={`/formularios/${id}/preview`}
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Ver vista previa
          </Link>
        </div>
      ) : (
        <>
          {/* Summary charts */}
          {summaryCharts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {summaryCharts.map(chart => (
                <div
                  key={chart.field.id}
                  className="rounded-2xl p-5"
                  style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
                >
                  <ResponseSummaryChart
                    title={chart.field.label}
                    items={chart.items}
                    average={chart.average}
                    type={chart.field.type === 'yes_no' ? 'yes_no' : 'bar'}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Individual responses table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--outline-variant)' }}>
              <p className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Respuestas individuales
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Miembro', 'Fecha de envío', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/40"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((resp, idx) => (
                    <tr
                      key={resp.id}
                      className={cn(
                        'hover:bg-navy/5 transition-colors',
                        idx % 2 === 1 ? 'bg-surface-low/40' : ''
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                              {resp.member_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                            </span>
                          </div>
                          <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{resp.member_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                        {new Date(resp.submitted_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailResponse(resp)}
                          className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-low transition-colors"
                          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                        >
                          Ver detalle
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail modal */}
      {detailResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy-ink/40 backdrop-blur-sm">
          <div
            className="h-full w-full max-w-md overflow-y-auto"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-card)' }}>
              <div>
                <p className="text-sm font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                  {detailResponse.member_name}
                </p>
                <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  {new Date(detailResponse.submitted_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button type="button" onClick={() => setDetailResponse(null)}>
                <X size={18} className="text-navy-light/40" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {dataFields.map(f => {
                const ans = detailResponse.answers[f.id]
                const displayAns = ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)
                  ? <span className="italic text-navy-light/30">Sin respuesta</span>
                  : Array.isArray(ans)
                  ? ans.join(', ')
                  : String(ans)

                return (
                  <div key={f.id} className="space-y-1">
                    <p className="text-[11px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                      {f.label}
                    </p>
                    <p className="text-sm text-navy leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                      {displayAns}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
