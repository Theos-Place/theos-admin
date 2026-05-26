'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Users, BookOpen, Calendar, UsersRound, DollarSign,
  MessageCircle, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, TrendingUp, ArrowUpRight, Eye, EyeOff,
  LayoutDashboard, GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMockAuth } from '@/hooks/useMockAuth'
import { usePermissions } from '@/hooks/usePermissions'
import type { RoleId } from '@/data/mock-auth'
import { MOCK_EVENTS, type EventType } from '@/data/mock-events'
import { DASHBOARD_STATS, RECENT_ACTIVITY } from '@/data/mock-dashboard'

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
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ opacity, display: 'block' }}>
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
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  charla:      'Charla',
  campamento:  'Campamento',
  social:      'Social',
  capacitacion:'Capacitación',
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

function capacityColor(pct: number) {
  if (pct < 0.7) return '#3DB97A'
  if (pct < 0.9) return '#E9B949'
  return '#EF5554'
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, value, label, delta, color, href,
}: {
  icon: React.ElementType; value: string | number; label: string
  delta?: string; color: string; href: string
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
      <div className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color }}>
        {typeof value === 'number' ? value.toLocaleString('es-CR') : value}
      </div>
      <div className="text-sm text-[#161440]/60 mb-2" style={{ fontFamily: 'var(--font-body)' }}>{label}</div>
      {delta && (
        <div className="flex items-center gap-1 text-[12px] text-[#3DB97A]" style={{ fontFamily: 'var(--font-body)' }}>
          <TrendingUp size={12} />
          {delta}
        </div>
      )}
      {hovered && (
        <div className="absolute bottom-3 right-3 text-[11px] font-medium flex items-center gap-1"
          style={{ color, fontFamily: 'var(--font-body)' }}>
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
        <span className="text-[13px] text-[#161440]/80" style={{ fontFamily: 'var(--font-body)' }}>{text}</span>
      </div>
      {href && <ChevronRight size={14} className="shrink-0 text-[#161440]/30" />}
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function ModuleCard({
  icon, title, subtitle, rows, href, hrefLabel,
}: {
  icon: string; title: string; subtitle: string
  rows: { label: string; value: string | number; badge?: 'coral' | 'yellow' }[]
  href: string; hrefLabel: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-lg mb-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#161440' }}>
            {icon} {title}
          </div>
          <div className="text-[12px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>{subtitle}</div>
        </div>
      </div>
      <div className="h-px bg-[rgba(22,20,64,0.07)] mb-3" />
      <div className="space-y-2 mb-4">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[13px] text-[#161440]/60" style={{ fontFamily: 'var(--font-body)' }}>{row.label}</span>
            <div className="flex items-center gap-2">
              {row.badge ? (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: row.badge === 'coral' ? '#EF5554' : '#C08A00',
                    background: row.badge === 'coral' ? 'rgba(239,85,84,0.10)' : 'rgba(233,185,73,0.15)',
                    fontFamily: 'var(--font-body)',
                  }}>
                  {typeof row.value === 'number' ? row.value.toLocaleString('es-CR') : row.value}
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-[#161440]" style={{ fontFamily: 'var(--font-body)' }}>
                  {typeof row.value === 'number' ? row.value.toLocaleString('es-CR') : row.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Link href={href}
        className="flex items-center gap-1 text-[12px] font-medium transition-colors hover:opacity-80"
        style={{ color: '#EF5554', fontFamily: 'var(--font-body)' }}>
        {hrefLabel} <ChevronRight size={13} />
      </Link>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loaded, hasRole } = useMockAuth()
  const { can } = usePermissions()

  const [now, setNow] = useState(new Date())
  const [showAmounts, setShowAmounts] = useState(false)
  const [activityCollapsed, setActivityCollapsed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const today = now
  const isAdminOrDir = hasRole('admin', 'direccion')
  const isFinance    = hasRole('admin', 'direccion', 'finanzas')
  const isMember     = !loaded || (user?.roles?.length === 1 && user.roles[0] === 'miembro')

  // Events today and upcoming
  const todayEvents = useMemo(() =>
    MOCK_EVENTS.filter(e => isSameDay(new Date(e.start_at), today))
  , [today])

  const upcomingEvents = useMemo(() =>
    MOCK_EVENTS
      .filter(e => {
        const d = new Date(e.start_at)
        return d > today && d.getTime() - today.getTime() < 1000 * 60 * 60 * 24 * 30
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 5)
  , [today])

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

  // ── Simplified member view ──────────────────────────────────────────────────
  if (isMember) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
        <div className="bg-[#161440] rounded-2xl px-6 py-6 text-white relative overflow-hidden">
          {HEADER_THETAS.map((p) => (
            <div key={p.id} style={{ position: 'absolute', top: p.top, left: p.left, right: p.right }}>
              <ThetaSVG size={p.size} opacity={p.opacity} />
            </div>
          ))}
          <div className="relative">
            <h1 className="text-2xl text-white mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              {getGreeting(today.getHours())}, {user?.name?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-white/50 text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
              {formatDay(today)} · {formatTime(today)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
          <div className="text-lg font-bold text-[#161440] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Mi perfil
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EF5554] flex items-center justify-center text-white font-bold text-lg"
              style={{ fontFamily: 'var(--font-display)' }}>
              {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
            </div>
            <div>
              <div className="font-semibold text-[#161440]" style={{ fontFamily: 'var(--font-body)' }}>{user?.name ?? 'Usuario'}</div>
              <div className="text-[12px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>{user?.email}</div>
            </div>
          </div>
          {user?.member_id && (
            <Link href={`/miembros/${user.member_id}`}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#EF5554]"
              style={{ fontFamily: 'var(--font-body)' }}>
              Ver mi perfil completo <ChevronRight size={13} />
            </Link>
          )}
        </div>

        {upcomingEvents.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
            <div className="text-lg font-bold text-[#161440] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Próximos eventos
            </div>
            <div className="space-y-3">
              {upcomingEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: EVENT_TYPE_COLORS[ev.event_type] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#161440] truncate" style={{ fontFamily: 'var(--font-body)' }}>{ev.name}</div>
                    <div className="text-[11px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>
                      {formatShortDate(ev.start_at)} · {formatEventTime(ev.start_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Full dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-8 space-y-6">

      {/* Header */}
      <div className="bg-[#161440] rounded-2xl px-6 py-5 relative overflow-hidden">
        {HEADER_THETAS.map((p) => (
          <div key={p.id} style={{ position: 'absolute', top: p.top, left: p.left, right: p.right }}>
            <ThetaSVG size={p.size} opacity={p.opacity} />
          </div>
        ))}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl text-white mb-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              {getGreeting(today.getHours())}, {user?.name?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-white/50 text-[13px] mb-1" style={{ fontFamily: 'var(--font-body)' }}>
              {formatDay(today)} · {formatTime(today)}
            </p>
            <p className="text-white/30 text-[12px]" style={{ fontFamily: 'var(--font-body)' }}>
              Theos Place · Sistema Administrativo
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 mt-1">
            {isFinance && (
              <button
                onClick={() => setShowAmounts(v => !v)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] text-white/60 hover:text-white border border-white/15 hover:bg-white/10 transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {showAmounts ? <EyeOff size={13} /> : <Eye size={13} />}
                {showAmounts ? 'Ocultar montos' : 'Mostrar montos'}
              </button>
            )}
            {isAdminOrDir && (
              <Link
                href="/eventos"
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#EF5554', fontFamily: 'var(--font-body)', boxShadow: '0 4px 14px rgba(239,85,84,0.35)' }}
              >
                Check-in rápido →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Módulo 1 — Stats globales */}
      {isAdminOrDir && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}     value={DASHBOARD_STATS.members.total}  label="Miembros"       delta={`+${DASHBOARD_STATS.members.new_this_month}/mes`} color="#161440" href="/miembros" />
          <StatCard icon={BookOpen}  value={DASHBOARD_STATS.studies.active_groups} label="Grupos activos" color="#519DA2" href="/estudios/grupos" />
          <StatCard icon={TrendingUp} value={DASHBOARD_STATS.finance.donors_active} label="Donadores activos" color="#3DB97A" href="/finanzas/donaciones" />
          <StatCard icon={UsersRound} value={DASHBOARD_STATS.servers.active} label="Servidores activos" color="#EF5554" href="/servidores" />
        </div>
      )}

      {/* Módulo 2 — Actividad de hoy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Eventos de hoy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-[#161440] text-base" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Hoy · {formatShortDate(today.toISOString())}
              </div>
              <div className="text-[12px] text-[#161440]/40" style={{ fontFamily: 'var(--font-body)' }}>Eventos programados</div>
            </div>
            <Calendar size={18} className="text-[#161440]/30" />
          </div>

          {todayEvents.length === 0 ? (
            <div className="text-[13px] text-[#161440]/40 py-4 text-center" style={{ fontFamily: 'var(--font-body)' }}>
              No hay eventos programados para hoy
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {todayEvents.map(ev => {
                const pct = ev.registrations.length / ev.max_capacity
                return (
                  <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(22,20,64,0.02)] border border-[rgba(22,20,64,0.04)]">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: EVENT_TYPE_COLORS[ev.event_type] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#161440] truncate" style={{ fontFamily: 'var(--font-body)' }}>{ev.name}</div>
                      <div className="text-[11px] text-[#161440]/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                        {formatEventTime(ev.start_at)} · {ev.location} · {ev.registrations.length} inscritos
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Link href="/eventos"
            className="flex items-center gap-1 text-[12px] font-medium text-[#EF5554]"
            style={{ fontFamily: 'var(--font-body)' }}>
            Ver todos los eventos <ChevronRight size={13} />
          </Link>
        </div>

        {/* Check-ins de hoy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-[#161440] text-base" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Check-ins de hoy
              </div>
              <div className="text-[12px] text-[#161440]/40" style={{ fontFamily: 'var(--font-body)' }}>Asistencias registradas</div>
            </div>
            <CheckCircle2 size={18} className="text-[#3DB97A]/60" />
          </div>

          <div className="text-4xl font-bold text-[#161440] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {totalTodayCheckins.toLocaleString('es-CR')}
          </div>

          {todayCheckins.length > 0 ? (
            <div className="space-y-2 mb-4">
              {todayCheckins.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#161440]/08 flex items-center justify-center text-[11px] font-bold text-[#161440]/60"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-[#161440]/80 truncate" style={{ fontFamily: 'var(--font-body)' }}>{c.name}</span>
                  </div>
                  <span className="text-[11px] text-[#161440]/40 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>{c.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-[#161440]/40 py-2" style={{ fontFamily: 'var(--font-body)' }}>
              Aún no hay check-ins hoy
            </div>
          )}

          <Link href="/eventos"
            className="flex items-center gap-1 text-[12px] font-medium text-[#EF5554]"
            style={{ fontFamily: 'var(--font-body)' }}>
            Ir a check-in <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Módulo 3 — Resumen por módulo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {can('miembros', 'view') && (
          <ModuleCard
            icon="👥" title="Miembros"
            subtitle={`${DASHBOARD_STATS.members.total.toLocaleString('es-CR')} total · ${DASHBOARD_STATS.members.active.toLocaleString('es-CR')} activos`}
            rows={[
              { label: 'Nuevos este mes',         value: `+${DASHBOARD_STATS.members.new_this_month}` },
              { label: 'Sin cédula',               value: DASHBOARD_STATS.members.without_cedula,  badge: 'yellow' },
              { label: 'Duplicados sugeridos',     value: DASHBOARD_STATS.members.duplicates_suggested, badge: 'coral' },
            ]}
            href="/miembros" hrefLabel="Ver miembros →"
          />
        )}

        {can('estudios', 'view') && (
          <ModuleCard
            icon="📚" title="Estudios Bíblicos"
            subtitle={`${DASHBOARD_STATS.studies.active_groups} grupos · ${DASHBOARD_STATS.studies.students} estudiantes`}
            rows={[
              { label: 'En inscripción',          value: DASHBOARD_STATS.studies.open_registration },
              { label: 'Lista de espera N1',       value: DASHBOARD_STATS.studies.waitlist_n1,      badge: 'yellow' },
              { label: 'Por cerrar (30 días)',     value: DASHBOARD_STATS.studies.closing_soon },
              { label: 'Grupos sin dirigente',     value: DASHBOARD_STATS.studies.without_leader,   badge: 'coral' },
            ]}
            href="/estudios/grupos" hrefLabel="Ver estudios →"
          />
        )}

        {can('eventos', 'view') && (
          <ModuleCard
            icon="📅" title="Eventos"
            subtitle={`${DASHBOARD_STATS.events.upcoming_this_month} próximos este mes`}
            rows={[
              { label: 'Esta semana',             value: DASHBOARD_STATS.events.this_week },
              { label: 'Con pago pendiente',      value: DASHBOARD_STATS.events.pending_payments, badge: 'yellow' },
              { label: 'Capacidad > 90%',         value: DASHBOARD_STATS.events.near_capacity,    badge: 'coral' },
            ]}
            href="/eventos" hrefLabel="Ver eventos →"
          />
        )}

        {can('servidores', 'view') && (
          <ModuleCard
            icon="🙌" title="Servidores"
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
              <div>
                <div className="text-lg mb-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#161440' }}>₡ Finanzas</div>
                <div className="text-[12px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>Ingresos este mes</div>
              </div>
            </div>
            <div className="h-px bg-[rgba(22,20,64,0.07)] mb-3" />
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#161440]/60" style={{ fontFamily: 'var(--font-body)' }}>Pagos recibidos</span>
                <span className="text-[13px] font-semibold text-[#161440]" style={{ fontFamily: 'var(--font-body)' }}>
                  {showAmounts
                    ? `₡${DASHBOARD_STATS.finance.income_this_month.toLocaleString('es-CR')}`
                    : '₡ •••,•••'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#161440]/60" style={{ fontFamily: 'var(--font-body)' }}>Donadores activos</span>
                <span className="text-[13px] font-semibold text-[#161440]" style={{ fontFamily: 'var(--font-body)' }}>
                  {DASHBOARD_STATS.finance.donors_active.toLocaleString('es-CR')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#161440]/60" style={{ fontFamily: 'var(--font-body)' }}>Devoluciones pend.</span>
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: '#EF5554', background: 'rgba(239,85,84,0.10)', fontFamily: 'var(--font-body)' }}>
                  {DASHBOARD_STATS.finance.pending_refunds}
                </span>
              </div>
            </div>
            <Link href="/finanzas"
              className="flex items-center gap-1 text-[12px] font-medium text-[#EF5554]"
              style={{ fontFamily: 'var(--font-body)' }}>
              Ver finanzas → <ChevronRight size={13} />
            </Link>
          </div>
        )}

        {can('comunicaciones', 'view') && (
          <ModuleCard
            icon="💬" title="Comunicaciones"
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
          <span className="font-bold text-[#161440]" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Pendientes de tu atención
          </span>
        </div>
        <div className="space-y-2">
          {isFinance && DASHBOARD_STATS.finance.pending_refunds > 0 && (
            <AlertRow level="red" text={`${DASHBOARD_STATS.finance.pending_refunds} devoluciones SINPE pendientes de procesar`} href="/finanzas/devoluciones" />
          )}
          {isAdminOrDir && DASHBOARD_STATS.members.duplicates_suggested > 0 && (
            <AlertRow level="red" text={`${DASHBOARD_STATS.members.duplicates_suggested} perfiles duplicados sugeridos por el sistema`} href="/miembros" />
          )}
          {can('estudios', 'view') && DASHBOARD_STATS.studies.without_leader > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.studies.without_leader} grupos de estudio sin dirigente asignado`} href="/estudios/grupos" />
          )}
          {can('servidores', 'view') && DASHBOARD_STATS.servers.pending_applications > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.servers.pending_applications} aplicaciones de servicio sin revisar`} href="/servidores/aplicaciones" />
          )}
          {can('estudios', 'view') && DASHBOARD_STATS.studies.waitlist_n1 > 0 && (
            <AlertRow level="yellow" text={`${DASHBOARD_STATS.studies.waitlist_n1} personas en lista de espera Nivel 1`} href="/estudios/lista-de-espera" />
          )}
          {can('comunicaciones', 'view') && DASHBOARD_STATS.communications.failed === 0 && (
            <AlertRow level="green" text="Todo al día en comunicaciones" />
          )}
        </div>
      </div>

      {/* Módulo 5 — Próximos eventos */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-[#161440] uppercase tracking-wider text-[11px]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
            Próximos eventos
          </span>
          <Link href="/eventos" className="text-[12px] text-[#EF5554] font-medium" style={{ fontFamily: 'var(--font-body)' }}>
            Ver calendario →
          </Link>
        </div>

        <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />

        {upcomingEvents.length === 0 ? (
          <div className="text-[13px] text-[#161440]/40 py-4 text-center" style={{ fontFamily: 'var(--font-body)' }}>
            No hay eventos próximos este mes
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(ev => {
              const pct = ev.registrations.length / ev.max_capacity
              const barColor = capacityColor(pct)
              const isNearFull = pct >= 0.9
              return (
                <div key={ev.id} className="flex items-center gap-4">
                  <div className="text-[11px] text-[#161440]/50 w-20 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                    {formatShortDate(ev.start_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#161440] truncate" style={{ fontFamily: 'var(--font-body)' }}>
                        {ev.name}
                      </span>
                      {isNearFull && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(239,85,84,0.10)', color: '#EF5554', fontFamily: 'var(--font-body)' }}>
                          casi lleno
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(22,20,64,0.07)] overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                      </div>
                      <span className="text-[11px] text-[#161440]/50 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                        {ev.registrations.length}/{ev.max_capacity}
                      </span>
                    </div>
                  </div>
                  <div className="text-[12px] text-[#161440]/50 shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
                    {formatEventTime(ev.start_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
              <Clock size={15} className="text-[#161440]/40" />
              <span className="font-bold text-[#161440]" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Actividad reciente
              </span>
            </div>
            <ChevronRight size={16} className={cn('text-[#161440]/30 transition-transform', activityCollapsed ? '' : 'rotate-90')} />
          </button>

          {!activityCollapsed && (
            <div className="px-5 pb-5">
              <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
              <div className="space-y-3">
                {RECENT_ACTIVITY.map(item => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                      style={{ background: '#161440', fontFamily: 'var(--font-display)' }}>
                      {item.actor_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#161440]/80 leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
                        <span className="font-semibold text-[#161440]">{item.actor}</span>{' '}
                        {item.action}{' '}
                        {item.resource_url ? (
                          <Link href={item.resource_url} className="text-[#519DA2] hover:underline">
                            {item.resource}
                          </Link>
                        ) : item.resource}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#161440]/40 shrink-0 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
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
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="font-bold text-[#161440] uppercase tracking-wider text-[11px] mb-4"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
          Mis grupos
        </div>
        <div className="h-px bg-[rgba(22,20,64,0.07)] mb-4" />
        <div className="space-y-3 mb-3">
          {[
            { name: 'Nivel 4 — San José B', participants: 10, total: 12, week: 6, weeks: 10 },
            { name: 'Nivel 2 — Heredia A',  participants: 8,  total: 12, week: 3, weeks: 11 },
          ].map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[rgba(22,20,64,0.02)] border border-[rgba(22,20,64,0.04)]">
              <div>
                <div className="text-[13px] font-semibold text-[#161440]" style={{ fontFamily: 'var(--font-body)' }}>{g.name}</div>
                <div className="text-[11px] text-[#161440]/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                  {g.participants}/{g.total} participantes · Semana {g.week}/{g.weeks}
                </div>
              </div>
              <Link href="/estudios/grupos"
                className="text-[12px] font-medium text-[#EF5554] shrink-0"
                style={{ fontFamily: 'var(--font-body)' }}>
                Ver grupo →
              </Link>
            </div>
          ))}
        </div>
        <div className="text-[12px] text-[#E9B949] font-medium" style={{ fontFamily: 'var(--font-body)' }}>
          3 evaluaciones pendientes de recibir
        </div>
      </div>
    )
  }

  if (hasRole('lider_comite')) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="font-bold text-[#161440] uppercase tracking-wider text-[11px] mb-4"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
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
              <div className="text-[11px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>{s.label}</div>
              <div className="text-[15px] font-bold text-[#161440]" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <Link href="/servidores"
          className="flex items-center gap-1 text-[12px] font-medium text-[#EF5554]"
          style={{ fontFamily: 'var(--font-body)' }}>
          Gestionar mi comité → <ChevronRight size={13} />
        </Link>
      </div>
    )
  }

  if (hasRole('coordinador_estudios', 'coordinador_dirigentes')) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[rgba(22,20,64,0.06)]">
        <div className="font-bold text-[#161440] uppercase tracking-wider text-[11px] mb-4"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
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
              <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-[#161440]/50" style={{ fontFamily: 'var(--font-body)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] px-2 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(239,85,84,0.10)', color: '#EF5554', fontFamily: 'var(--font-body)' }}>
            1 evaluación baja (≤2)
          </span>
          <Link href="/estudios/dirigentes"
            className="text-[12px] font-medium text-[#EF5554]"
            style={{ fontFamily: 'var(--font-body)' }}>
            Ver dirigentes →
          </Link>
        </div>
      </div>
    )
  }

  return null
}
