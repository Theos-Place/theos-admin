'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import {
  Users, Clock, AlertTriangle, TrendingUp,
  BookOpen, UserCheck, BarChart2, ListChecks, LayoutList, Inbox,
} from 'lucide-react'

function formatSchedule(days: string[], time: string) {
  return `${days.join('/')} ${time}`
}

const QUICK_ACCESS = [
  { href: '/estudios/grupos',       label: 'Grupos',           icon: LayoutList, desc: 'Ver y gestionar grupos' },
  { href: '/estudios/plan',         label: 'Plan de Estudios', icon: BookOpen,   desc: 'Tipos de estudio' },
  { href: '/estudios/dirigentes',   label: 'Dirigentes',       icon: UserCheck,  desc: 'Perfil de líderes' },
  { href: '/estudios/solicitudes',  label: 'Solicitudes',      icon: Inbox,      desc: 'Reubicaciones, grupos y espera' },
  { href: '/estudios/analisis',     label: 'Análisis',         icon: BarChart2,  desc: 'Demanda por bloque' },
]

export default function EstudiosPage() {
  const { groups } = useStudies()

  // Solicitudes abiertas (reubicaciones + unirse a grupo + grupo nuevo).
  // El endpoint exige rol de coordinación: con 403 el conteo queda en 0.
  const [openRequests, setOpenRequests] = useState(0)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenRequests(d.count ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const activeGroups        = useMemo(() => groups.filter(g => g.status === 'en_matricula' || g.status === 'en_curso'), [groups])
  const openGroups          = useMemo(() => groups.filter(g => g.status === 'en_matricula'), [groups])
  const inProgressGroups    = useMemo(() => groups.filter(g => g.status === 'en_curso'), [groups])
  // Sin dirigente: flag derivado (leader_id null) sobre grupos no finalizados.
  const pendingLeaderGroups = useMemo(() => groups.filter(g => !g.leader_id && g.status !== 'finalizado'), [groups])
  const closingSoon = useMemo(() => {
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return inProgressGroups.filter(g => {
      if (!g.end_date) return false
      const end = new Date(g.end_date)
      return end <= in30 && end >= now
    })
  }, [inProgressGroups])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          Estudios Bíblicos
        </h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">
          {activeGroups.length} grupos activos en este período
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Grupos en inscripción', value: openGroups.length,     icon: Users,        color: 'text-teal-deep' },
          { label: 'Grupos en curso',       value: inProgressGroups.length, icon: TrendingUp, color: 'text-navy' },
          { label: 'Solicitudes abiertas',  value: openRequests,          icon: Inbox,        color: 'text-amber-600' },
          { label: 'Por cerrar (30 días)',  value: closingSoon.length,    icon: AlertTriangle, color: 'text-coral' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-start justify-between">
              <p
                className="text-[10px] tracking-widest uppercase text-navy-light/40 font-display"
              >
                {label}
              </p>
              <Icon size={16} className={color} />
            </div>
            <p
              className={`mt-2 text-3xl font-bold font-display ${color}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: Active groups table */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]">
            <h2
              className="text-sm font-semibold text-navy font-display"
            >
              Grupos activos
            </h2>
            <Link
              href="/estudios/grupos"
              className="text-[12px] text-coral hover:text-coral-deep transition-colors font-body"
            >
              Ver todos →
            </Link>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Estudio', 'Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeGroups.slice(0, 10).map(group => (
                  <tr
                    key={group.id}
                    className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                  >
                    <td className="px-4 py-3">
                      <StudyTypeBadge code={group.study_type_id} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                      {group.leader_name ?? <span className="text-amber-600 text-[11px]">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-light/70 font-body">
                      {sedeLabel(group.zone)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-navy-light/60 font-body">
                      {formatSchedule(group.schedule_days, group.schedule_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy font-body">
                      {group.participants.filter(p => p.status !== 'withdrawn').length}/{group.max_capacity}
                    </td>
                    <td className="px-4 py-3">
                      <GroupStatusBadge status={group.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/estudios/grupos/${group.id}`}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-low border transition-colors border-[var(--outline-variant)] font-body"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {activeGroups.slice(0, 10).map((group, i, arr) => (
              <li key={group.id} style={i < arr.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
                <Link href={`/estudios/grupos/${group.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-surface-low">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StudyTypeBadge code={group.study_type_id} size="sm" />
                      <GroupStatusBadge status={group.status} />
                    </div>
                    <p className="text-sm text-navy font-body truncate">
                      {group.leader_name ?? <span className="text-amber-600">Sin asignar</span>}
                    </p>
                    <p className="text-[12px] text-navy-light/60 font-body truncate">
                      {sedeLabel(group.zone)} · {formatSchedule(group.schedule_days, group.schedule_time)} · {group.participants.filter(p => p.status !== 'withdrawn').length}/{group.max_capacity}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick access */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-3 font-display"
            >
              Accesos rápidos
            </h3>
            <div className="space-y-1">
              {QUICK_ACCESS.map(({ href, label, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors group"
                >
                  <Icon size={16} className="text-navy-light/50 group-hover:text-coral transition-colors" />
                  <div>
                    <p className="text-sm text-navy font-medium font-body">
                      {label}
                    </p>
                    <p className="text-[11px] text-navy-light/50">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-3 font-display"
            >
              Alertas
            </h3>
            <div className="space-y-2">
              {pendingLeaderGroups.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-amber-700 font-body">
                    <strong>{pendingLeaderGroups.length}</strong> grupo{pendingLeaderGroups.length > 1 ? 's' : ''} sin dirigente asignado
                  </p>
                </div>
              )}
              {closingSoon.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-coral/5 px-3 py-2.5">
                  <Clock size={14} className="text-coral mt-0.5 shrink-0" />
                  <p className="text-[12px] text-coral font-body">
                    <strong>{closingSoon.length}</strong> grupo{closingSoon.length > 1 ? 's' : ''} cierran en los próximos 30 días
                  </p>
                </div>
              )}
              {openRequests > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-navy/5 px-3 py-2.5">
                  <ListChecks size={14} className="text-navy mt-0.5 shrink-0" />
                  <p className="text-[12px] text-navy font-body">
                    <strong>{openRequests}</strong> solicitud{openRequests > 1 ? 'es' : ''} de estudios abierta{openRequests > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {pendingLeaderGroups.length === 0 && closingSoon.length === 0 && openRequests === 0 && (
                <p className="text-[12px] text-navy-light/40 text-center py-2 font-body">
                  Sin alertas activas
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
