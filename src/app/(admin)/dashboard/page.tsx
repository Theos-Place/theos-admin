'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { eventsInRange } from '@/lib/events/event-views'
import {
  Users, BookOpen, Calendar, DollarSign,
  Heart, Hammer,
  MessageCircle, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, TrendingUp, ArrowUpRight, Eye, EyeOff,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import type { RoleId } from '@/lib/auth/roles'
import { type EventType } from '@/data/event-config'
import { useEvents } from '@/hooks/useEvents'
import { useDashboard } from '@/hooks/useDashboard'
import { landsOnProfile } from '@/lib/auth/home-route'
import { formatTotalsInline, type MoneyTotals } from '@/lib/money'

// Fallback en ceros mientras cargan las stats (evita null checks en el JSX).
const EMPTY_STATS = {
  members: { total: 0, active: 0, new_this_month: 0, without_cedula: 0, duplicates_suggested: 0 },
  studies: { active_groups: 0, active_estudios: 0, active_capacitaciones: 0, students: 0, open_registration: 0, open_requests: 0, closing_soon: 0, without_leader: 0 },
  events: { today: 0, upcoming_this_month: 0, this_week: 0, pending_payments: 0, near_capacity: 0 },
  servers: { active: 0, positions: 0, committees: 0, open_vacancies: 0, pending_applications: 0 },
  finance: { donors_active: 0, pending_refunds: 0, income_this_month: {} as MoneyTotals },
  communications: { sent_this_month: 0, total_recipients: 0, failed: 0 },
}

// ─── Theta pattern ────────────────────────────────────────────────────────────
type ThetaPosition = {
  id: string
  top: string
  size: number
  opacity: number
  left?: string
  right?: string
}

function ThetaSVG({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className="block" style={{ opacity }}>
      <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="10" />
      <rect x="14" y="45" width="72" height="10" fill="white" />
    </svg>
  )
}

const HEADER_THETAS: ThetaPosition[] = [
  { id: 'theta-1', top: '10%', right: '2%',  size: 80,  opacity: 0.05 },
  { id: 'theta-2', top: '5%',  right: '12%', size: 40,  opacity: 0.04 },
  { id: 'theta-3', top: '40%', right: '6%',  size: 120, opacity: 0.03 },
  { id: 'theta-4', top: '0%',  left: '60%',  size: 60,  opacity: 0.04 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVENT_TYPE_COLORS: Record<EventType, string> = {
  charla:      '#EF5554',
  campamento:  '#519DA2',
  social:      '#E9B949',
  capacitacion:'#161440',
}

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatDay(date: Date) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatEventTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}



// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, value, label, delta, sub, color, href,
}: {
  icon: React.ElementType; value: string | number; label: string
  delta?: string; sub?: string; color: string; href: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="block bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)] transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden"
    >
      <div className="absolute top-3 right-3 opacity-[0.07]">
        <Icon size={52} strokeWidth={1.5} color={color} />
      </div>
      <div className="text-3xl font-bold mb-1 font-display" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString('es-CR') : value}
      </div>
      <div className="text-sm text-navy/60 mb-2 font-body">{label}</div>
      {sub && (
        <div className="text-[12px] text-navy/45 font-body">{sub}</div>
      )}
      {delta && (
        <div className="flex items-center gap-1 text-[12px] text-[#3DB97A] font-body">
          <TrendingUp size={12} />
          {delta}
        </div>
      )}
      {hovered && (
        <div className="absolute bottom-3 right-3 text-[11px] font-medium flex items-center gap-1 font-body"
          style={{ color }}>
          Ver detalle <ArrowUpRight size={11} />
        </div>
      )}
    </Link>
  )
}

function AlertRow({
  level, text, href,
}: {
  level: 'red' | 'yellow' | 'green'; text: string; href?: string
}) {
  const colors = {
    red:    { dot: '#EF5554', bg: 'rgba(239,85,84,0.06)' },
    yellow: { dot: '#E9B949', bg: 'rgba(233,185,73,0.06)' },
    green:  { dot: '#3DB97A', bg: 'rgba(61,185,122,0.06)' },
  }
  const c = colors[level]
  const inner = (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ background: c.bg }}>
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.dot }} />
        <span className="text-[13px] text-navy/80 font-body">{text}</span>
      </div>
      {href && <ChevronRight size={14} className="shrink-0 text-navy/60" />}
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function ModuleCard({
  icon: Icon, title, subtitle, rows, href, hrefLabel,
}: {
  icon: React.ElementType; title: string; subtitle: string
  rows: { label: string; value: string | number; badge?: 'coral' | 'yellow'; href?: string }[]
  href: string; hrefLabel: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-low text-navy">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-lg mb-0.5 font-display font-extrabold text-navy">{title}</div>
            <div className="text-[12px] text-navy/70 font-body">{subtitle}</div>
          </div>
        </div>
      </div>
      <div className="h-px bg-[rgba(22,20,64,0.07)] mb-3" />
      <div className="space-y-2 mb-4">
        {rows.map((row, i) => {
          const valueEl = row.badge ? (
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full font-body"
              style={{
                color: row.badge === 'coral' ? '#EF5554' : '#C08A00',
                background: row.badge === 'coral' ? 'rgba(239,85,84,0.10)' : 'rgba(233,185,73,0.15)',
              }}>
              {typeof row.value === 'number' ? row.value.toLocaleString('es-CR') : row.value}
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-navy font-body">
              {typeof row.value === 'number' ? row.value.toLocaleString('es-CR') : row.value}
            </span>
          )
          return row.href ? (
            <Link key={i} href={row.href} className="flex items-center justify-between rounded-lg -mx-1 px-1 py-0.5 hover:bg-surface-low transition-colors">
              <span className="text-[13px] text-coral font-body">{row.label} →</span>
              <div className="flex items-center gap-2">{valueEl}</div>
            </Link>
          ) : (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[13px] text-navy/60 font-body">{row.label}</span>
              <div className="flex items-center gap-2">{valueEl}</div>
            </div>
          )
        })}
      </div>
      <Link href={href}
        className="flex items-center gap-1 text-[12px] font-medium transition-colors hover:opacity-80 text-coral font-body">
        {hrefLabel} <ChevronRight size={13} />
      </Link>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loaded, hasRole } = useAuth()
  const { can, getScope } = usePermissions()
  // SEC-1: los KPIs y la actividad exigen alcance más allá de 'own' — mismo
  // criterio del payload recortado del API. can() no mira scope, por eso el
  // helper; el rol miembro ni siquiera dispara los fetches.
  const isMemberOnly = !loaded || landsOnProfile(user?.roles ?? [])
  const canScope = (m: string) => can(m, 'view') && getScope(m) !== 'own'
  const { events } = useEvents({}, { enabled: loaded && !isMemberOnly && can('eventos', 'view') })
  const { stats, activity: RECENT_ACTIVITY } = useDashboard({ enabled: loaded && !isMemberOnly })
  const DASHBOARD_STATS = { ...EMPTY_STATS, ...(stats ?? {}) }

  const [now, setNow] = useState(new Date())
  const [showAmounts, setShowAmounts] = useState(false)
  const [activityCollapsed, setActivityCollapsed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Landing del encargado_eventos puro (sin otros roles de mayor alcance): su
  // pantalla de inicio es el check-in, no el dashboard.
  const router = useRouter()
  useEffect(() => {
    if (!loaded) return
    const roles = user?.roles ?? []
    const onlyEncargado = roles.filter(r => r !== 'miembro').length === 1 && roles.includes('encargado_eventos')
    if (onlyEncargado) { router.replace('/eventos/checkin'); return }
    // SEC-1 (ampliado 2026-07-29): miembro, dirigente y líder de comité NO
    // tienen dashboard — su página default es su PERFIL (sus herramientas
    // viven en el sidebar: Grupos / Servidores).
    if (landsOnProfile(roles) && user?.member_id) {
      router.replace(`/miembros/${user.member_id}`)
    }
  }, [loaded, user, router])

  const today = now
  const isAdminOrDir = hasRole('admin', 'direccion')
  const isFinance    = hasRole('admin', 'direccion', 'finanzas')
  const isMember     = isMemberOnly

  // Events today and upcoming — EXPANDIENDO recurrentes (las charlas de hoy son
  // ocurrencias del evento padre; no existen como fila con la fecha de hoy).
  const todayEvents = useMemo(() => {
    const start = new Date(today); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    return eventsInRange(events, start, end)
  }, [events, today])

  // Today check-ins (mock last 5)
  const todayCheckins = useMemo(() => {
    const all: { name: string; time: string }[] = []
    for (const ev of todayEvents) {
      for (const c of ev.checkins.slice(0, 5)) {
        all.push({ name: c.member_name, time: formatEventTime(ev.start_at) })
      }
    }
    return all.slice(0, 5)
  }, [todayEvents])

  const totalTodayCheckins = todayEvents.reduce((s, e) => s + e.checkins.length, 0)

  if (!loaded) return null

  // SEC-1: miembro puro no tiene dashboard (el effect de arriba lo manda a
  // su perfil); no se pinta nada mientras redirige.
  if (isMember) return null

  // ── Full dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6">

      {/* Header */}
      <div className="bg-navy rounded-2xl px-4 sm:px-6 py-5 relative overflow-hidden">
        {HEADER_THETAS.map((p) => (
          <div key={p.id} className="absolute" style={{ top: p.top, left: p.left, right: p.right }}>
            <ThetaSVG size={p.size} opacity={p.opacity} />
          </div>
        ))}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl text-white mb-0.5 font-display font-extrabold">
              {getGreeting(today.getHours())}, {user?.name?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-white/70 text-[13px] mb-1 font-body">
              {formatDay(today)} · {formatTime(today)}
            </p>
            <p className="text-white/70 text-[12px] font-body">
              Theos Place · Sistema Administrativo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0 sm:mt-1">
            {isFinance && (
              <button
                onClick={() => setShowAmounts(v => !v)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] text-white/60 hover:text-white border border-white/15 hover:bg-white/10 transition-all font-body"
              >
                {showAmounts ? <EyeOff size={13} /> : <Eye size={13} />}
                {showAmounts ? 'Ocultar montos' : 'Mostrar montos'}
              </button>
            )}
            {isAdminOrDir && (
              <Link
                href="/eventos"
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 bg-coral font-body shadow-[0_4px_14px_rgba(239,85,84,0.35)]"
              >
                Check-in rápido →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Módulo 1 — Stats globales */}
      {isAdminOrDir && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users}     value={DASHBOARD_STATS.members.total}  label="Miembros"       delta={`+${DASHBOARD_STATS.members.new_this_month}/mes`} color="#161440" href="/miembros" />
          <StatCard icon={BookOpen}  value={DASHBOARD_STATS.studies.active_estudios} label="Estudios activos" sub="Niveles N1–N4" color="#519DA2" href="/estudios/grupos" />
          <StatCard icon={GraduationCap} value={DASHBOARD_STATS.studies.active_capacitaciones} label="Capacitaciones activas" sub="Resto de grupos" color="#9B7FD4" href="/estudios/grupos" />
          <StatCard icon={Heart} value={DASHBOARD_STATS.finance.donors_active} label="Donadores activos" color="#3DB97A" href="/finanzas/donaciones" />
          <StatCard icon={Hammer} value={DASHBOARD_STATS.servers.active} label="Servidores activos" sub={`${DASHBOARD_STATS.servers.positions.toLocaleString('es-CR')} puestos ocupados`} color="#EF5554" href="/servidores" />
        </div>
      )}

      {/* Módulo 2 — Actividad de hoy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Eventos de hoy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-navy text-base font-display font-extrabold">
                Hoy · {formatShortDate(today.toISOString())}
              </div>
              <div className="text-[12px] text-navy/70 font-body">Eventos programados</div>
            </div>
            <Calendar size={18} className="text-navy/60" />
          </div>

          {todayEvents.length === 0 ? (
            <div className="text-[13px] text-navy/70 py-4 text-center font-body">
              No hay eventos programados para hoy
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {todayEvents.map(ev => {
                return (
                  <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(22,20,64,0.02)] border border-[rgba(22,20,64,0.04)]">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: EVENT_TYPE_COLORS[ev.event_type] ?? '#161440' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-navy truncate font-body">{ev.name}</div>
                      <div className="text-[11px] text-navy/70 mt-0.5 font-body">
                        {formatEventTime(ev.start_at)} · {ev.location} · {ev.registrations.length} inscritos
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Link href="/eventos"
            className="flex items-center gap-1 text-[12px] font-medium text-coral font-body">
            Ver todos los eventos <ChevronRight size={13} />
          </Link>
        </div>

        {/* Check-ins de hoy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-navy text-base font-display font-extrabold">
                Check-ins de hoy
              </div>
              <div className="text-[12px] text-navy/70 font-body">Asistencias registradas</div>
            </div>
            <CheckCircle2 size={18} className="text-[#3DB97A]/60" />
          </div>

          <div className="text-4xl font-bold text-navy mb-4 font-display">
            {totalTodayCheckins.toLocaleString('es-CR')}
          </div>

          {todayCheckins.length > 0 ? (
            <div className="space-y-2 mb-4">
              {todayCheckins.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#161440]/08 flex items-center justify-center text-[11px] font-bold text-navy/60 font-display">
                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-navy/80 truncate font-body">{c.name}</span>
                  </div>
                  <span className="text-[11px] text-navy/70 shrink-0 font-body">{c.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-navy/70 py-2 font-body">
              Aún no hay check-ins hoy
            </div>
          )}

          <Link href="/eventos"
            className="flex items-center gap-1 text-[12px] font-medium text-coral font-body">
            Ir a check-in <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Módulo 3 — Resumen por módulo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {canScope('miembros') && (
          <ModuleCard
            icon={Users} title="Miembros"
            subtitle={`${DASHBOARD_STATS.members.total.toLocaleString('es-CR')} total · ${DASHBOARD_STATS.members.active.toLocaleString('es-CR')} activos`}
            rows={[
              { label: 'Nuevos este mes',         value: `+${DASHBOARD_STATS.members.new_this_month}` },
              { label: 'Sin cédula',               value: DASHBOARD_STATS.members.without_cedula,  badge: 'yellow' },
              { label: 'Duplicados sugeridos',     value: DASHBOARD_STATS.members.duplicates_suggested, badge: 'coral', href: '/miembros/duplicados' },
            ]}
            href="/miembros" hrefLabel="Ver miembros →"
          />
        )}

        {canScope('estudios') && (
          <ModuleCard
            icon={BookOpen} title="Estudios Bíblicos"
            subtitle={`${DASHBOARD_STATS.studies.active_estudios} estudios · ${DASHBOARD_STATS.studies.active_capacitaciones} capacitaciones · ${DASHBOARD_STATS.studies.students} estudiantes`}
            rows={[
              { label: 'En inscripción',          value: DASHBOARD_STATS.studies.open_registration },
              { label: 'Solicitudes abiertas',       value: DASHBOARD_STATS.studies.open_requests,    badge: 'yellow' },
              { label: 'Por cerrar (30 días)',     value: DASHBOARD_STATS.studies.closing_soon, href: '/estudios/grupos?filter=closing_soon' },
              { label: 'Grupos sin dirigente',     value: DASHBOARD_STATS.studies.without_leader,   badge: 'coral', href: '/estudios/grupos?filter=without_leader' },
            ]}
            href="/estudios/grupos" hrefLabel="Ver estudios →"
          />
        )}

        {canScope('eventos') && (
          <ModuleCard
            icon={Calendar} title="Eventos"
            subtitle={`${DASHBOARD_STATS.events.upcoming_this_month} próximos este mes`}
            rows={[
              { label: 'Esta semana',             value: DASHBOARD_STATS.events.this_week },
              { label: 'Con pago pendiente',      value: DASHBOARD_STATS.events.pending_payments, badge: 'yellow' },
              { label: 'Capacidad > 90%',         value: DASHBOARD_STATS.events.near_capacity,    badge: 'coral' },
            ]}
            href="/eventos" hrefLabel="Ver eventos →"
          />
        )}

        {canScope('servidores') && (
          <ModuleCard
            icon={Hammer} title="Servidores"
            subtitle={`${DASHBOARD_STATS.servers.active} activos en ${DASHBOARD_STATS.servers.committees} comités`}
            rows={[
              { label: 'Vacantes abiertas',       value: DASHBOARD_STATS.servers.open_vacancies },
              { label: 'Aplicaciones pend.',      value: DASHBOARD_STATS.servers.pending_applications, badge: 'coral' },
            ]}
            href="/servidores" hrefLabel="Ver servidores →"
          />
        )}

        {isFinance && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-low text-navy">
                  <DollarSign size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-lg mb-0.5 font-display font-extrabold text-navy">Finanzas</div>
                  <div className="text-[12px] text-navy/70 font-body">Ingresos este mes</div>
                </div>
              </div>
            </div>
            <div className="h-px bg-[rgba(22,20,64,0.07)] mb-3" />
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-navy/60 font-body">Pagos recibidos</span>
                <span className="text-[13px] font-semibold text-navy font-body">
                  {/* INT-3: una línea por moneda; hoy todo es CRC, así que se ve una. */}
                  {showAmounts
                    ? formatTotalsInline(DASHBOARD_STATS.finance.income_this_month)
                    : '₡ •••,•••'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-navy/60 font-body">Donadores activos</span>
                <span className="text-[13px] font-semibold text-navy font-body">
                  {DASHBOARD_STATS.finance.donors_active.toLocaleString('es-CR')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-navy/60 font-body">Devoluciones pend.</span>
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full text-coral bg-[rgba(239,85,84,0.10)] font-body">
                  {DASHBOARD_STATS.finance.pending_refunds}
                </span>
              </div>
            </div>
            <Link href="/finanzas"
              className="flex items-center gap-1 text-[12px] font-medium text-coral font-body">
              Ver finanzas → <ChevronRight size={13} />
            </Link>
          </div>
        )}

        {canScope('comunicaciones') && (
          <ModuleCard
            icon={MessageCircle} title="Comunicaciones"
            subtitle="Mensajes enviados"
            rows={[
              { label: 'Enviados este mes',       value: DASHBOARD_STATS.communications.sent_this_month },
              { label: 'Destinatarios',           value: DASHBOARD_STATS.communications.total_recipients.toLocaleString('es-CR') },
              { label: 'Mensajes fallidos',       value: DASHBOARD_STATS.communications.failed },
            ]}
            href="/comunicaciones/nueva" hrefLabel="Nueva comunicación →"
          />
        )}
      </div>

      {/* Módulo 4 — Alertas */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-[#E9B949]" />
          <span className="font-bold text-navy font-display font-extrabold">
            Pendientes de tu atención
          </span>
        </div>
        <div className="space-y-2">
          {isFinance && DASHBOARD_STATS.finance.pending_refunds > 0 && (
            <AlertRow level="red" text={`${DASHBOARD_STATS.finance.pending_refunds} devoluciones SINPE pendientes de procesar`} href="/finanzas/devoluciones" />
          )}
          {isAdminOrDir && DASHBOARD_STATS.members.duplicates_suggested > 0 && (
            <AlertRow level="red" text={`${DASHBOARD_STATS.members.duplicates_suggested} perfiles duplicados sugeridos por el sistema`} href="/miembros/duplicados" />
          )}
          {canScope('estudios') && DASHBOARD_STATS.studies.closing_soon > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.studies.closing_soon} grupos de estudio prontos a cerrar (próximos 30 días)`} href="/estudios/grupos?filter=closing_soon" />
          )}
          {canScope('estudios') && DASHBOARD_STATS.studies.without_leader > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.studies.without_leader} grupos de estudio sin dirigente asignado`} href="/estudios/grupos?filter=without_leader" />
          )}
          {canScope('servidores') && DASHBOARD_STATS.servers.pending_applications > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.servers.pending_applications} aplicaciones de servicio sin revisar`} href="/servidores/aplicaciones" />
          )}
          {canScope('estudios') && DASHBOARD_STATS.studies.open_requests > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.studies.open_requests} solicitud${DASHBOARD_STATS.studies.open_requests !== 1 ? 'es' : ''} de estudios abierta${DASHBOARD_STATS.studies.open_requests !== 1 ? 's' : ''}`} href="/estudios/solicitudes" />
          )}
          {canScope('comunicaciones') && DASHBOARD_STATS.communications.failed === 0 && (
            <AlertRow level="green" text="Todo al día en comunicaciones" />
          )}
        </div>
      </div>

      {/* Módulo 6 — Vista específica por rol */}
      <RoleSpecificModule hasRole={hasRole} />

      {/* Módulo 7 — Actividad reciente (solo admin/dirección) */}
      {isAdminOrDir && (
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(22,20,64,0.06)]">
          <button
            onClick={() => setActivityCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-navy/70" />
              <span className="font-bold text-navy font-display font-extrabold">
                Actividad reciente
              </span>
            </div>
            <ChevronRight size={16} className={cn('text-navy/60 transition-transform', activityCollapsed ? '' : 'rotate-90')} />
          </button>

          {!activityCollapsed && (
            <div className="px-5 pb-5">
              <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
              <div className="space-y-3">
                {RECENT_ACTIVITY.map(item => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5 bg-navy font-display">
                      {item.actor_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-navy/80 leading-snug font-body">
                        <span className="font-semibold text-navy">{item.actor}</span>{' '}
                        {item.action}{' '}
                        {item.resource_url ? (
                          <Link href={item.resource_url} className="text-[#519DA2] hover:underline">
                            {item.resource}
                          </Link>
                        ) : item.resource}
                      </p>
                    </div>
                    <span className="text-[11px] text-navy/70 shrink-0 mt-0.5 font-body">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Role-specific module ─────────────────────────────────────────────────────
function RoleSpecificModule({ hasRole }: { hasRole: (...ids: RoleId[]) => boolean }) {
  if (hasRole('dirigente')) {
    return <DirigenteGroupsModule />
  }

  if (hasRole('lider_comite')) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="font-bold text-navy uppercase text-[11px] mb-4 font-display tracking-[0.08em]">
          Mi comité — Bienvenida
        </div>
        <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            { label: 'Servidores activos', value: '12' },
            { label: 'Próximo evento',     value: 'Dom 18 may' },
            { label: 'Vacantes abiertas',  value: '2' },
            { label: 'Aplicaciones pend.', value: '3' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-[11px] text-navy/70 font-body">{s.label}</div>
              <div className="text-[15px] font-bold text-navy font-display">{s.value}</div>
            </div>
          ))}
        </div>
        <Link href="/servidores"
          className="flex items-center gap-1 text-[12px] font-medium text-coral font-body">
          Gestionar mi comité → <ChevronRight size={13} />
        </Link>
      </div>
    )
  }

  if (hasRole('coordinador_estudios', 'coordinador_dirigentes')) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="font-bold text-navy uppercase text-[11px] mb-4 font-display tracking-[0.08em]">
          Resumen de dirigentes
        </div>
        <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
        <div className="grid grid-cols-3 gap-4 mb-3">
          {[
            { label: 'Activos',         value: '47', color: '#3DB97A' },
            { label: 'En descanso',     value: '8',  color: '#E9B949' },
            { label: 'Disponibles',     value: '3',  color: '#519DA2' },
          ].map((s, i) => (
            <div key={i} className="text-center p-3 rounded-xl bg-[rgba(22,20,64,0.02)]">
              <div className="text-2xl font-bold mb-0.5 font-display" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-navy/70 font-body">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] px-2 py-1 rounded-full font-semibold bg-[rgba(239,85,84,0.10)] text-coral font-body">
            1 evaluación baja (≤2)
          </span>
          <Link href="/estudios/dirigentes"
            className="text-[12px] font-medium text-coral font-body">
            Ver dirigentes →
          </Link>
        </div>
      </div>
    )
  }

  return null
}


// ─── SEC-1: "Mis grupos" del dirigente con datos REALES ──────────────────────
// El bloque anterior era mock hardcodeado y "Ver grupo" abría la lista general.
// GET /api/studies/groups ya viene filtrado a los grupos del dirigente
// (leader/co-leader) y el link deep-linkea al detalle.
function DirigenteGroupsModule() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string | null; enrolled: number; max: number | null; week: number | null }>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/groups?status=en_matricula&status=en_curso')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive) return
        const rows = Array.isArray(d) ? d : (d?.groups ?? [])
        setGroups(rows.map((g: { id: string; name: string | null; enrollment_counts?: { enrolled?: number }; max_students: number | null; current_week: number | null }) => ({
          id: g.id, name: g.name,
          enrolled: g.enrollment_counts?.enrolled ?? 0,
          max: g.max_students, week: g.current_week,
        })))
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading || groups.length === 0) return null
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
      <div className="font-bold text-navy uppercase text-[11px] mb-4 font-display tracking-[0.08em]">
        Mis grupos
      </div>
      <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
      <div className="space-y-3 mb-3">
        {groups.map(g => (
          <div key={g.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[rgba(22,20,64,0.02)] border border-[rgba(22,20,64,0.04)]">
            <div>
              <div className="text-[13px] font-semibold text-navy font-body">{g.name ?? 'Grupo'}</div>
              <div className="text-[11px] text-navy/70 mt-0.5 font-body">
                {g.enrolled}{g.max ? `/${g.max}` : ''} participantes{g.week ? ` · Semana ${g.week}` : ''}
              </div>
            </div>
            <Link href={`/estudios/grupos/${g.id}`}
              className="text-[12px] font-medium text-coral shrink-0 font-body">
              Ver grupo →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
