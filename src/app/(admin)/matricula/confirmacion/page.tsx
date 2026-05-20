'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, GraduationCap, MessageCircle } from 'lucide-react'
import { MOCK_GROUPS, STUDY_TYPES } from '@/data/mock-studies'
import { STUDY_CATALOG } from '@/data/study-catalog'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles',
  J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

function formatDays(days: string[]): string {
  const labels = days.map(d => DAY_LABELS[d] ?? d)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`
  return labels.slice(0, -1).join(', ') + ' y ' + labels[labels.length - 1]
}

export default function ConfirmacionPage() {
  const searchParams = useSearchParams()
  const groupId  = searchParams.get('group') ?? ''
  const studyCode = searchParams.get('study') ?? ''

  const group = useMemo(() => MOCK_GROUPS.find(g => g.id === groupId), [groupId])
  const study = useMemo(() => STUDY_CATALOG.find(s => s.code === studyCode), [studyCode])
  const studyType = useMemo(() => STUDY_TYPES.find(s => s.code === studyCode), [studyCode])

  if (!group || !study) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          No se encontró la información de la matrícula.
        </p>
        <Link
          href="/matricula"
          className="rounded-xl bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Volver al portal
        </Link>
      </div>
    )
  }

  const zoneName = group.zone.charAt(0).toUpperCase() + group.zone.slice(1)
  const schedule = `${formatDays(group.schedule_days)} ${group.schedule_time}`

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div
        className="rounded-2xl p-8 text-center space-y-6"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        {/* Ícono de éxito */}
        <div className="flex justify-center">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(112,189,194,0.15)' }}
          >
            <CheckCircle2 size={32} className="text-teal-deep" />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-1">
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            ¡Matrícula confirmada!
          </h1>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Tu solicitud fue recibida y está siendo procesada
          </p>
        </div>

        {/* Detalle de la inscripción */}
        <div
          className="rounded-xl text-left overflow-hidden"
          style={{ border: '1px solid var(--outline-variant)' }}
        >
          <div
            className="px-4 py-2.5 border-b"
            style={{ background: 'var(--surface-low)', borderColor: 'var(--outline-variant)' }}
          >
            <p className="text-[11px] font-semibold text-navy-light/50 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
              Quedaste inscrito/a en
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--outline-variant)' }}>
            {[
              { label: 'Estudio',   value: `${study.code} — ${study.name}` },
              { label: 'Grupo',     value: `${zoneName} — ${schedule}` },
              { label: 'Dirigente', value: group.leader_name ?? 'Por asignar' },
              { label: 'Inicio',    value: formatDate(group.start_date) },
              { label: 'Duración',  value: `${study.weeks} semanas` },
              ...(studyType?.requires_payment && studyType.cost
                ? [{ label: 'Costo', value: `₡${studyType.cost.toLocaleString('es-CR')}` }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-2.5" style={{ borderColor: 'var(--outline-variant)' }}>
                <span className="w-20 text-[11px] text-navy-light/40 uppercase tracking-wider shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
                  {label}
                </span>
                <span className="text-[13px] font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mensaje de seguimiento */}
        <div
          className="flex items-start gap-2.5 rounded-xl px-3 py-3 text-left"
          style={{ background: 'rgba(112,189,194,0.1)', border: '1px solid rgba(81,157,162,0.2)' }}
        >
          <MessageCircle size={14} className="text-teal-deep shrink-0 mt-0.5" />
          <p className="text-[12px] text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
            Recibirás un mensaje de WhatsApp con los detalles del grupo y el próximo paso del proceso.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          <Link
            href="/matricula"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <GraduationCap size={14} />
            Matricular otro
          </Link>
          <Link
            href="/miembros"
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver mi perfil
          </Link>
        </div>
      </div>
    </div>
  )
}
