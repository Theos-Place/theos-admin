'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { toYmdLocal } from '@/lib/format'
import {
  Users, Clock, AlertTriangle, TrendingUp,
  BookOpen, UserCheck, BarChart2, ListChecks, LayoutList, Inbox,
  GraduationCap, History, Megaphone, CloudUpload, ArrowLeftRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import type { StudyDashboardStats } from '@/lib/supabase/queries/studies'

const EMPTY_COUNT = { grupos: 0, inscripciones: 0, unicos: 0 }
const EMPTY_STATS: StudyDashboardStats = {
  activos:   { niveles: { ...EMPTY_COUNT }, capacitaciones: { ...EMPTY_COUNT } },
  historico: { niveles: { ...EMPTY_COUNT }, capacitaciones: { ...EMPTY_COUNT } },
  campanas:  { ...EMPTY_COUNT },
}

const QUICK_ACCESS = [
  { href: '/estudios/grupos',       label: 'Grupos',           icon: LayoutList, desc: 'Ver y gestionar grupos' },
  { href: '/estudios/plan',         label: 'Plan de Estudios', icon: BookOpen,   desc: 'Tipos de estudio' },
  { href: '/estudios/dirigentes',   label: 'Dirigentes',       icon: UserCheck,  desc: 'Perfil de líderes' },
  { href: '/estudios/solicitudes',  label: 'Solicitudes',      icon: Inbox,      desc: 'Reubicaciones, grupos y espera' },
  // REU-2: la cola de CAMBIOS DE GRUPO tiene su propia entrada. El conteo
  // general mezcla reubicaciones con intereses (informativos), y lo que hay que
  // atender es la gente esperando un cambio.
  { href: '/estudios/solicitudes?tab=relocation', label: 'Cambios de grupo', icon: ArrowLeftRight, desc: 'Reubicaciones pendientes' },
  { href: '/estudios/analisis',     label: 'Análisis',         icon: BarChart2,  desc: 'Demanda por bloque' },
]

export default function EstudiosPage() {
  const { groups } = useStudies('groups')
  const { user } = useAuth()
  const canImport = (user?.roles ?? []).some(r => (STUDY_ADMIN_ROLES as readonly string[]).includes(r) || r === 'admin')

  // Solicitudes abiertas (reubicaciones + unirse a grupo + grupo nuevo).
  // El endpoint exige rol de coordinación: con 403 el conteo queda en 0.
  const [openRequests, setOpenRequests] = useState(0)
  const [openRelocations, setOpenRelocations] = useState(0)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenRequests(d.count ?? 0) })
      .catch(() => {})
    fetch('/api/studies/requests?count=relocation')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenRelocations(d.count ?? 0) })
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
  // Mismo criterio EXACTO que el conteo del dashboard (`closing_soon`) y que el
  // filtro `closing_soon` del API de grupos: ends_at no nulo, entre hoy y +30
  // días, sin contar los ya finalizados (si ya cerró, no está "por cerrar"). Así
  // el número del box coincide con la lista al hacer clic. Comparación por
  // fecha (slice 10) para evitar drift.
  const closingSoon = useMemo(() => {
    // QA 2026-07-17: fecha LOCAL del navegador (CR), no UTC — toISOString()
    // corría la ventana un día entre 6pm y medianoche.
    const todayStr = toYmdLocal(new Date())
    const in30Str = toYmdLocal(new Date(Date.now() + 30 * 86400000))
    return groups.filter(g => {
      if (!g.end_date || g.status === 'finalizado') return false
      const d = g.end_date.slice(0, 10)
      return d >= todayStr && d <= in30Str
    })
  }, [groups])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Estudios Bíblicos
          </h1>
          <p className="mt-1 text-sm text-navy-light/80 font-body">
            {activeGroups.length} grupos activos en este período
          </p>
        </div>
        {/* EST-2: import masivo de grupos — mismo guard que crear grupos (el
            server re-valida con STUDY_ADMIN_ROLES). */}
        {canImport && (
          <Link
            href="/estudios/importar"
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-4 py-2 text-sm text-navy hover:bg-surface-low transition-colors font-body"
          >
            <CloudUpload size={15} /> Importar grupos
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Grupos en inscripción', value: openGroups.length,     icon: Users,        color: 'text-teal-deep' },
          { label: 'Grupos en curso',       value: inProgressGroups.length, icon: TrendingUp, color: 'text-navy' },
          { label: 'Solicitudes abiertas',  value: openRequests,          icon: Inbox,        color: 'text-amber-600' },
          { label: 'Por cerrar (30 días)',  value: closingSoon.length,    icon: AlertTriangle, color: 'text-coral', href: '/estudios/grupos?filter=closing_soon' },
        ].map(({ label, value, icon: Icon, color, href }) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  {label}
                </p>
                <Icon size={16} className={color} />
              </div>
              <p className={`mt-2 text-3xl font-bold font-display ${color}`}>{value}</p>
            </>
          )
          return href ? (
            <Link
              key={label}
              href={href}
              className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors block"
            >
              {inner}
            </Link>
          ) : (
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              {inner}
            </div>
          )
        })}
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
                inscripciones={stats.activos.niveles.inscripciones}
                unicos={stats.activos.niveles.unicos}
              />
              <StatRow
                icon={BookOpen}
                label="Capacitaciones activas"
                hint="Etapa Inicial + Intermedia"
                grupos={stats.activos.capacitaciones.grupos}
                inscripciones={stats.activos.capacitaciones.inscripciones}
                unicos={stats.activos.capacitaciones.unicos}
              />
            </div>
          </section>

          {/* Histórico */}
          <section className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--outline-variant)]">
              <History size={16} className="text-navy-light/80" />
              <h2 className="text-sm font-semibold text-navy font-display">Histórico</h2>
              <span className="text-[13px] text-navy-light/80 font-body">grupos finalizados</span>
            </div>
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--outline-variant)]">
              <StatRow
                icon={GraduationCap}
                label="Niveles finalizados"
                hint="N1–N4"
                grupos={stats.historico.niveles.grupos}
                inscripciones={stats.historico.niveles.inscripciones}
                unicos={stats.historico.niveles.unicos}
                muted
              />
              <StatRow
                icon={BookOpen}
                label="Capacitaciones finalizadas"
                hint="Etapa Inicial + Intermedia"
                grupos={stats.historico.capacitaciones.grupos}
                inscripciones={stats.historico.capacitaciones.inscripciones}
                unicos={stats.historico.capacitaciones.unicos}
                muted
              />
            </div>
          </section>

          {/* Campañas (histórico) */}
          <section className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--outline-variant)]">
              <Megaphone size={16} className="text-purple-700" />
              <h2 className="text-sm font-semibold text-navy font-display">Campañas</h2>
              <span className="text-[13px] text-navy-light/80 font-body">histórico</span>
            </div>
            <div className="grid sm:grid-cols-1">
              <StatRow
                icon={Megaphone}
                label="Campañas"
                hint="Transformados, Tiempo para Soñar, etc."
                grupos={stats.campanas.grupos}
                inscripciones={stats.campanas.inscripciones}
                unicos={stats.campanas.unicos}
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
              className="text-[11px] tracking-widest uppercase text-navy-light/80 mb-3 font-display"
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
                  <Icon size={16} className="text-navy-light/80 group-hover:text-coral transition-colors" />
                  <div className="min-w-0">
                    <p className="text-sm text-navy font-medium font-body inline-flex items-center gap-1.5">
                      {label}
                      {href.includes('tab=relocation') && openRelocations > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[11px] text-white">
                          {openRelocations}
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-navy-light/80">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[11px] tracking-widest uppercase text-navy-light/80 mb-3 font-display"
            >
              Alertas
            </h3>
            <div className="space-y-2">
              {pendingLeaderGroups.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-amber-700 font-body">
                    <strong>{pendingLeaderGroups.length}</strong> grupo{pendingLeaderGroups.length > 1 ? 's' : ''} sin dirigente asignado
                  </p>
                </div>
              )}
              {closingSoon.length > 0 && (
                <Link
                  href="/estudios/grupos?filter=closing_soon"
                  className="flex items-start gap-2 rounded-xl bg-coral/5 px-3 py-2.5 hover:bg-coral/10 transition-colors"
                >
                  <Clock size={14} className="text-coral mt-0.5 shrink-0" />
                  <p className="text-[13px] text-coral font-body">
                    <strong>{closingSoon.length}</strong> grupo{closingSoon.length > 1 ? 's' : ''} cierran en los próximos 30 días
                  </p>
                </Link>
              )}
              {openRequests > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-navy/5 px-3 py-2.5">
                  <ListChecks size={14} className="text-navy mt-0.5 shrink-0" />
                  <p className="text-[13px] text-navy font-body">
                    <strong>{openRequests}</strong> solicitud{openRequests > 1 ? 'es' : ''} de estudios abierta{openRequests > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {pendingLeaderGroups.length === 0 && closingSoon.length === 0 && openRequests === 0 && (
                <p className="text-[13px] text-navy-light/80 text-center py-2 font-body">
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
  icon: Icon, label, hint, grupos, inscripciones, unicos, muted = false,
}: {
  icon: typeof GraduationCap
  label: string
  hint: string
  grupos: number
  inscripciones: number
  unicos: number
  muted?: boolean
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={muted ? 'text-navy-light/80' : 'text-coral'} />
        <p className="text-sm font-semibold text-navy font-body">{label}</p>
      </div>
      <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">{hint}</p>
      <div className="mt-3 flex items-baseline gap-2 font-body">
        <span className={`text-3xl font-bold font-display ${muted ? 'text-navy' : 'text-coral'}`}>
          {grupos}
        </span>
        <span className="text-sm text-navy-light/80">grupos</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 font-body text-sm">
        <span className="font-semibold text-navy font-display">{inscripciones.toLocaleString('es-CR')}</span>
        <span className="text-navy-light/80">inscripciones</span>
        <span className="text-navy-light/40">·</span>
        <span className="font-semibold text-navy font-display">{unicos.toLocaleString('es-CR')}</span>
        <span className="text-navy-light/80">estudiantes únicos</span>
      </div>
    </div>
  )
}
