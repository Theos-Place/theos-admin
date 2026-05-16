'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { STUDY_TYPES, MOCK_GROUPS } from '@/data/mock-studies'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { WeekProgressBar } from '@/components/studies/WeekProgressBar'
import { sedeLabel } from '@/data/mock-sedes'
import { ChevronLeft, Archive, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCost(cost: number) {
  if (cost === 0) return 'Gratis'
  return `₡${cost.toLocaleString('es-CR')}`
}

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-coral" />
          <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Archivar estudio
          </h3>
        </div>
        <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
          Al archivar este tipo de estudio no podrás crear nuevos grupos con él. Los grupos existentes no se ven afectados.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
          >
            Sí, archivar
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CurriculoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const study = STUDY_TYPES.find(s => s.id === id)
  const [showArchive, setShowArchive] = useState(false)
  const [archived, setArchived] = useState(false)

  const relatedGroups = MOCK_GROUPS.filter(g => g.study_type_id === id)

  if (!study) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/curriculo" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Volver
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Tipo de estudio no encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {showArchive && (
        <ConfirmModal
          onConfirm={() => { setArchived(true); setShowArchive(false) }}
          onCancel={() => setShowArchive(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/estudios/curriculo"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            Currículo
          </Link>
        </div>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StudyTypeBadge code={study.code} size="md" />
          <div>
            <h1
              className="text-2xl text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {study.name}
            </h1>
            <p className="text-sm text-navy-light/60 capitalize" style={{ fontFamily: 'var(--font-body)' }}>
              Etapa: {study.stage === 'niveles' ? 'Niveles' : study.stage === 'inicial' ? 'Inicial' : 'Intermedia'}
              {archived && <span className="ml-2 text-amber-600 text-[11px] font-medium">[ARCHIVADO]</span>}
            </p>
          </div>
        </div>
        {!archived && (
          <button
            onClick={() => setShowArchive(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Archive size={14} />
            Archivar estudio
          </button>
        )}
      </div>

      {/* Config card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[10px] tracking-widest uppercase text-navy-light/40"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Configuración
          </h2>
          <button className="flex items-center gap-1 text-[12px] text-navy-light/50 hover:text-coral transition-colors">
            <Edit3 size={13} />
            Editar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Código',       value: study.code },
            { label: 'Semanas',      value: `${study.weeks} semanas` },
            { label: 'Costo',        value: formatCost(study.cost) },
            { label: 'Prerequisito', value: study.prerequisite ?? 'Ninguno' },
            { label: 'Próximo estudio', value: study.next_study_id ?? '—' },
            { label: 'Calificación', value: study.requires_grade ? 'Sí' : 'No' },
            { label: 'Pago',         value: study.requires_payment ? 'Requerido' : 'Gratuito' },
            { label: 'Transición automática', value: study.auto_promote ? 'Sí' : 'No' },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p
                className="text-[10px] tracking-widest uppercase text-navy-light/40"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {label}
              </p>
              <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <p
            className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Compromisos requeridos
          </p>
          <CommitmentIcons
            donor={study.req_donor}
            server={study.req_server}
            charlas={study.req_attendee}
            size={16}
          />
        </div>
      </div>

      {/* Related groups */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          <h2
            className="text-sm font-semibold text-navy"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Grupos con este tipo ({relatedGroups.length})
          </h2>
        </div>

        {relatedGroups.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              No hay grupos registrados con este tipo de estudio.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Dirigente', 'Zona', 'Horario', 'Participantes', 'Semana', 'Estado'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relatedGroups.map(g => (
                  <tr
                    key={g.id}
                    className="hover:bg-surface-low transition-colors"
                    style={{ borderBottom: '1px solid var(--outline-variant)' }}
                  >
                    <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {g.leader_name ?? <span className="text-amber-600 text-[11px]">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                      {sedeLabel(g.zone)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                      {g.schedule_days.join('/')} {g.schedule_time}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {g.participants.filter(p => p.status !== 'withdrawn').length}/{g.max_capacity}
                    </td>
                    <td className="px-4 py-3">
                      <WeekProgressBar current={g.current_week} total={study.weeks} className="w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <GroupStatusBadge status={g.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
