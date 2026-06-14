'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import {
  Users, Clock, AlertTriangle, TrendingUp,
  BookOpen, UserCheck, BarChart2, ListChecks, LayoutList, Inbox,
  GraduationCap, History,
} from 'lucide-react'
import type { StudyDashboardStats } from '@/lib/supabase/queries/studies'

const EMPTY_STATS: StudyDashboardStats = {
  activos:   { niveles: { grupos: 0, estudiantes: 0 }, capacitaciones: { grupos: 0, estudiantes: 0 } },
  historico: { niveles: { grupos: 0, estudiantes: 0 }, capacitaciones: { grupos: 0, estudiantes: 0 } },
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

  // Métricas en curso / histórico — calculadas en la BD (RPC), no client-side.
  const [stats, setStats] = useState<StudyDashboardStats>(EMPTY_STATS)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/dashboard-stats')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setStats(d as StudyDashboardStats) })
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
                className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display"
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
        {/* Left: boxes En curso / Histórico */}
        <div className="space-y-6">
          {/* En curso */}
          <section className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--outline-variant)]">
              <TrendingUp size={16} className="text-coral" />
              <h2 className="text-sm font-semibold text-navy font-display">En curso</h2>
            </div>
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--outline-variant)]">
              <StatRow
                icon={GraduationCap}
                label="Niveles activos"
                hint="N1–N4"
                grupos={stats.activos.niveles.grupos}
                estudiantes={stats.activos.niveles.estudiantes}
              />
              <StatRow
                icon={BookOpen}
                label="Capacitaciones activas"
                hint="Etapa Inicial + Intermedia"
                grupos={stats.activos.capacitaciones.grupos}
                estudiantes={stats.activos.capacitaciones.estudiantes}
              />
            </div>
          </section>

          {/* Histórico */}
          <section className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--outline-variant)]">
              <History size={16} className="text-navy-light/60" />
              <h2 className="text-sm font-semibold text-navy font-display">Histórico</h2>
              <span className="text-[11px] text-navy-light/60 font-body">grupos finalizados</span>
            </div>
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--outline-variant)]">
              <StatRow
                icon={GraduationCap}
                label="Niveles finalizados"
                hint="N1–N4"
                grupos={stats.historico.niveles.grupos}
                estudiantes={stats.historico.niveles.estudiantes}
                muted
              />
              <StatRow
                icon={BookOpen}
                label="Capacitaciones finalizadas"
                hint="Etapa Inicial + Intermedia"
                grupos={stats.historico.capacitaciones.grupos}
                estudiantes={stats.historico.capacitaciones.estudiantes}
                muted
              />
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick access */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/60 mb-3 font-display"
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
                  <Icon size={16} className="text-navy-light/60 group-hover:text-coral transition-colors" />
                  <div>
                    <p className="text-sm text-navy font-medium font-body">
                      {label}
                    </p>
                    <p className="text-[11px] text-navy-light/60">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[10px] tracking-widest uppercase text-navy-light/60 mb-3 font-display"
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
                <p className="text-[12px] text-navy-light/60 text-center py-2 font-body">
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

function StatRow({
  icon: Icon, label, hint, grupos, estudiantes, muted = false,
}: {
  icon: typeof GraduationCap
  label: string
  hint: string
  grupos: number
  estudiantes: number
  muted?: boolean
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={muted ? 'text-navy-light/60' : 'text-coral'} />
        <p className="text-sm font-semibold text-navy font-body">{label}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-navy-light/60 font-body">{hint}</p>
      <div className="mt-3 flex items-baseline gap-2 font-body">
        <span className={`text-3xl font-bold font-display ${muted ? 'text-navy' : 'text-coral'}`}>
          {grupos}
        </span>
        <span className="text-sm text-navy-light/70">grupos</span>
        <span className="text-navy-light/30">·</span>
        <span className="text-xl font-semibold text-navy font-display">{estudiantes}</span>
        <span className="text-sm text-navy-light/70">estudiantes</span>
      </div>
    </div>
  )
}
