'use client'

// DIR-1 · Respuestas del formulario de disponibilidad, AL LADO del estado actual
// del dirigente.
//
// Es SOLO INSUMO: nada de acá actualiza al dirigente. La decisión la toma el
// coordinador y la aplica en la ficha del dirigente — un cambio automático
// movería asignaciones sin criterio humano (decisión de DIR-1).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ClipboardList } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LEADER_STATUS_LABEL, type LeaderStatus } from '@/lib/studies/leader-admin-status'

const VIEW_ROLES = ['coordinador_dirigentes', 'coordinador_estudios', 'direccion', 'admin'] as const

type Row = {
  response_id: string
  submitted_at: string
  member_id: string | null
  member_name: string
  answers: Array<{ label: string; value: string }>
  leader: {
    availability_status: string
    is_active: boolean
    zone_preference: string[]
    qualified_study_codes: string[]
    formation_study_codes: string[]
  } | null
}

type FormOption = { id: string; title: string; responses: number }

export default function DisponibilidadDirigentesPage() {
  const { user, loaded } = useAuth()
  const [forms, setForms] = useState<FormOption[]>([])
  const [formId, setFormId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  const queryKey = formId ?? 'inicial'
  const loading = loadedKey !== queryKey

  useEffect(() => {
    let alive = true
    const u = formId ? `?form_id=${formId}` : ''
    fetch(`/api/studies/dirigentes/disponibilidad${u}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (!alive) return
        setForms(d.forms ?? [])
        setRows(d.rows ?? [])
        if (!formId && d.form_id) setFormId(d.form_id)
      })
      .catch(() => { if (alive) setRows([]) })
      .finally(() => { if (alive) setLoadedKey(queryKey) })
    return () => { alive = false }
  }, [formId, queryKey])

  if (!loaded) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/80">Cargando…</p>
      </div>
    )
  }
  if (!VIEW_ROLES.some(r => (user?.roles ?? []).includes(r))) return <AccessDenied />

  return (
    <div className="space-y-5">
      <Link
        href="/estudios/dirigentes"
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver a dirigentes
      </Link>

      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Disponibilidad de dirigentes
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Lo que respondieron, junto a cómo están hoy. Es insumo para decidir: nada de acá cambia
          al dirigente automáticamente.
        </p>
      </div>

      {forms.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="form-ciclo" className="text-[13px] text-navy-light/80 font-body">Convocatoria:</label>
          <select
            id="form-ciclo"
            value={formId ?? ''}
            onChange={e => setFormId(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          >
            {forms.map(f => (
              <option key={f.id} value={f.id}>{f.title} ({f.responses})</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-navy-light/80 font-body">Cargando…</p>
      ) : forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay formulario de disponibilidad"
          description="Corré el seed (scripts/seed-leader-availability-form.mjs) y mandá la convocatoria por correo."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin respuestas todavía"
          description="Cuando los dirigentes respondan, vas a ver acá su disponibilidad junto a su estado actual."
        />
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.response_id} className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base font-semibold text-navy font-display">
                  {r.member_id ? (
                    <Link href={`/estudios/dirigentes/${r.member_id}`} className="hover:underline">
                      {r.member_name}
                    </Link>
                  ) : r.member_name}
                </p>
                <p className="text-[13px] text-navy-light/80 font-body">{formatDateTime(r.submitted_at)}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Lo que respondió */}
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-2">
                    Lo que respondió
                  </p>
                  <dl className="space-y-1.5">
                    {r.answers.map(a => (
                      <div key={a.label} className="flex flex-col">
                        <dt className="text-[13px] text-navy-light/80 font-body">{a.label}</dt>
                        <dd className="text-sm text-navy font-body">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Cómo está hoy */}
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-2">
                    Estado actual
                  </p>
                  {r.leader ? (
                    <dl className="space-y-1.5">
                      <div>
                        <dt className="text-[13px] text-navy-light/80 font-body">Disponibilidad registrada</dt>
                        <dd className="text-sm font-body">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[13px] font-medium',
                            r.leader.is_active ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy/10 text-navy-light',
                          )}>
                            {LEADER_STATUS_LABEL[r.leader.availability_status as LeaderStatus] ?? r.leader.availability_status}
                            {!r.leader.is_active && ' · inactivo'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-navy-light/80 font-body">Zonas</dt>
                        <dd className="text-sm text-navy font-body">
                          {r.leader.zone_preference.length > 0 ? r.leader.zone_preference.join(', ') : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-navy-light/80 font-body">Estudios que da</dt>
                        <dd className="text-sm text-navy font-body">
                          {r.leader.qualified_study_codes.length > 0 ? r.leader.qualified_study_codes.join(', ') : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-navy-light/80 font-body">En formación</dt>
                        <dd className="text-sm text-navy font-body">
                          {r.leader.formation_study_codes.length > 0 ? r.leader.formation_study_codes.join(', ') : '—'}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-[13px] text-navy-light/80 font-body">
                      Quien respondió no está registrado como dirigente.
                    </p>
                  )}
                  {r.member_id && (
                    <Link
                      href={`/estudios/dirigentes/${r.member_id}`}
                      className="mt-3 inline-block rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                    >
                      Abrir ficha para aplicar cambios
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
