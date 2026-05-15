'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import {
  MapPin,
  BookOpen,
  Users,
  Phone,
  Mail,
  Heart,
  Briefcase,
  Building,
  User,
  Edit2,
  Lock,
  ChevronDown,
  ChevronUp,
  Star,
  UserPlus,
  UserMinus,
  Smartphone,
  MessageCircle,
  Check,
  ArrowRight,
} from 'lucide-react'
import { mockMembers } from '@/data/mock-members'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(firstName: string, lastName: string) {
  return (firstName[0] + lastName[0]).toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n)
}

function calculateAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function qrCells(id: string): boolean[] {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 49 }, (_, i) => ((n + i * 17 + i) % 7) < 4)
}

function getStudyWeek(memberId: string, totalWeeks: number): number {
  const n = memberId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return (n % (totalWeeks - 2)) + 2
}

function studyStageColor(stage: string): string {
  if (stage === 'niveles') return 'bg-navy/10 text-navy'
  if (stage === 'inicial') return 'bg-teal-soft/30 text-teal-deep'
  return 'bg-coral-soft/20 text-coral'
}

const AVATAR_COLORS = ['bg-navy', 'bg-coral', 'bg-teal-deep', 'bg-navy-light']
function avatarColor(id: string) {
  return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]
}

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'personal', label: 'Info Personal' },
  { id: 'participacion', label: 'Participación' },
  { id: 'familia', label: 'Familia' },
  { id: 'pase', label: 'Pase Digital' },
]

const TYPE_BADGE: Record<string, string> = {
  Charla: 'bg-navy/10 text-navy',
  Campamento: 'bg-teal-soft/30 text-teal-deep',
  'Actividad Social': 'bg-coral-soft/20 text-coral',
  United: 'bg-navy-light/10 text-navy-light',
}

const ATTENDANCE_BADGE: Record<string, string> = {
  servidor: 'bg-coral-soft/20 text-coral',
  participante: 'bg-surface-low text-navy-light/70',
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  editable = true,
}: {
  icon: React.ReactNode
  label: string
  value: string
  editable?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 text-navy-light/40 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] uppercase tracking-wider text-navy-light/40 mb-0.5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </p>
        <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
          {value || '—'}
        </p>
      </div>
      {editable ? (
        <button
          className="rounded-lg p-1.5 text-navy-light/20 hover:text-coral hover:bg-surface-low transition-all"
          aria-label="Editar"
        >
          <Edit2 size={13} strokeWidth={1.75} />
        </button>
      ) : (
        <div className="rounded-lg p-1.5 text-navy-light/20">
          <Lock size={13} strokeWidth={1.75} />
        </div>
      )}
    </div>
  )
}

function SectionAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--outline-variant)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 bg-surface-card hover:bg-surface-low transition-colors"
      >
        <span
          className="text-sm font-medium text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} strokeWidth={1.75} className="text-navy-light/50" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.75} className="text-navy-light/50" />
        )}
      </button>
      {open && <div className="bg-surface-card">{children}</div>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MiembroDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const member = mockMembers.find(m => m.id === id)
  if (!member) notFound()

  const [activeTab, setActiveTab] = useState('resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [revealDonations, setRevealDonations] = useState(false)
  const [openSections, setOpenSections] = useState({
    estudios: true,
    servicio: false,
    eventos: false,
    donaciones: false,
  })

  function changeTab(tab: string) {
    setActiveTab(tab)
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Derived
  const currentStudyEntry = member.current_study
    ? STUDY_CATALOG.find(s => s.code === member.current_study)
    : null

  const currentWeek = currentStudyEntry
    ? getStudyWeek(member.id, currentStudyEntry.weeks)
    : 0

  const activeService = member.service_history.find(s => s.status === 'activo')

  const lastStudyCode = member.completed_studies[member.completed_studies.length - 1]
  const lastStudyEntry = lastStudyCode ? STUDY_CATALOG.find(s => s.code === lastStudyCode) : null

  const hasFinanceRole = true // demo

  return (
    <div className="space-y-4">
      {/* ── Header Card ── */}
      <div
        className="rounded-2xl bg-surface-card p-5"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-lg',
              avatarColor(member.id)
            )}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            {initials(member.first_name, member.last_name)}
          </div>

          {/* Name + details */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl text-navy leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {member.first_name} {member.last_name}
            </h1>
            <p className="mt-0.5 text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>
              {member.cedula} · Se unió el {formatDate(member.join_date)}
            </p>

            {/* Badges */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs',
                  member.status === 'active'
                    ? 'bg-teal-soft/50 text-teal-deep'
                    : 'bg-surface-low text-navy-light/50'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span
                  className={cn(
                    'mr-1.5 h-1.5 w-1.5 rounded-full',
                    member.status === 'active' ? 'bg-teal-deep' : 'bg-navy-light/30'
                  )}
                />
                {member.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              {member.is_donor && (
                <span
                  className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Donador
                </span>
              )}
              {member.is_server && (
                <span
                  className="rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-xs text-teal-deep"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Servidor
                </span>
              )}
              {member.es_dirigente && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs text-navy"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <Star size={10} strokeWidth={2} />
                  Dirigente
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Editar
            </button>
            <button
              className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              Comunicar
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                ···
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-card py-1 z-20"
                  style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline-variant)' }}
                >
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-navy-light/70 hover:bg-surface-low transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Desactivar perfil
                  </button>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-navy-light/70 hover:bg-surface-low transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Fusionar duplicado
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="sticky top-0 z-10 rounded-2xl bg-surface-card overflow-x-auto"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={cn(
                'px-5 py-3.5 text-sm whitespace-nowrap transition-all relative',
                activeTab === tab.id
                  ? 'text-navy font-medium'
                  : 'text-navy-light/50 hover:text-navy'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-coral rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}

      {/* TAB: Resumen */}
      {activeTab === 'resumen' && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-2xl bg-surface-card p-4"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-coral" strokeWidth={1.75} />
                <span
                  className="text-[10px] uppercase tracking-wider text-navy-light/50"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Sede
                </span>
              </div>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                {member.sede}
              </p>
            </div>

            <div
              className="rounded-2xl bg-surface-card p-4"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-teal-deep" strokeWidth={1.75} />
                <span
                  className="text-[10px] uppercase tracking-wider text-navy-light/50"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Nivel actual
                </span>
              </div>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                {currentStudyEntry
                  ? currentStudyEntry.name
                  : lastStudyEntry
                  ? lastStudyEntry.name
                  : 'Sin estudios'}
              </p>
            </div>

            <div
              className="rounded-2xl bg-surface-card p-4"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-navy" strokeWidth={1.75} />
                <span
                  className="text-[10px] uppercase tracking-wider text-navy-light/50"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Servicio
                </span>
              </div>
              <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                {activeService ? activeService.committee : 'Ninguno'}
              </p>
            </div>
          </div>

          {/* Study progress */}
          {currentStudyEntry && (
            <div
              className="rounded-2xl bg-surface-card p-5"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p
                    className="text-sm font-medium text-navy"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                  >
                    {currentStudyEntry.name}
                  </p>
                  <p className="text-xs text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                    Semana {currentWeek} de {currentStudyEntry.weeks}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs',
                    studyStageColor(currentStudyEntry.stage)
                  )}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {STUDY_STAGES[currentStudyEntry.stage as keyof typeof STUDY_STAGES].label}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-low overflow-hidden">
                <div
                  className="h-full rounded-full bg-coral transition-all"
                  style={{ width: `${(currentWeek / currentStudyEntry.weeks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed studies */}
          {member.completed_studies.length > 0 && (
            <div
              className="rounded-2xl bg-surface-card p-5"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <h3
                className="text-sm font-medium text-navy mb-3"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                Estudios completados
              </h3>
              <div className="space-y-2">
                {member.completed_studies.slice(-5).map(code => {
                  const entry = STUDY_CATALOG.find(s => s.code === code)
                  return (
                    <div key={code} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-lg px-2 py-0.5 text-[10px] font-medium',
                          entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/50'
                        )}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {code}
                      </span>
                      <span className="flex-1 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                        {entry ? entry.name : code}
                      </span>
                      <Check size={13} className="text-teal-deep" strokeWidth={2.5} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent attendance */}
          {member.attendance_history.length > 0 && (
            <div
              className="rounded-2xl bg-surface-card p-5"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <h3
                className="text-sm font-medium text-navy mb-3"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                Asistencia reciente
              </h3>
              <div className="space-y-2">
                {member.attendance_history.slice(0, 5).map((ev, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                        {ev.name}
                      </p>
                      <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                        {formatDate(ev.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px]',
                          TYPE_BADGE[ev.type] ?? 'bg-surface-low text-navy-light/50'
                        )}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {ev.type}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px]',
                          ATTENDANCE_BADGE[ev.attendance_type] ?? 'bg-surface-low text-navy-light/50'
                        )}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {ev.attendance_type === 'servidor' ? 'Servidor' : 'Participante'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Info Personal */}
      {activeTab === 'personal' && (
        <div
          className="rounded-2xl bg-surface-card p-5"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {/* Non-editable: name + cedula */}
          <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--outline-variant)' }}>
            <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Nombre completo" value={`${member.first_name} ${member.last_name}`} editable={false} />
            <InfoRow icon={<Lock size={15} strokeWidth={1.75} />} label="Cédula" value={member.cedula} editable={false} />
          </div>

          <div className="grid grid-cols-2 gap-x-8">
            {/* Contacto */}
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-navy-light/40 mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Contacto
              </p>
              <InfoRow icon={<Phone size={15} strokeWidth={1.75} />} label="Teléfono" value={member.phone} />
              <InfoRow icon={<Mail size={15} strokeWidth={1.75} />} label="Correo" value={member.email} />
              <InfoRow icon={<MapPin size={15} strokeWidth={1.75} />} label="Dirección" value={member.address} />
            </div>

            {/* Datos personales */}
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-navy-light/40 mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Datos personales
              </p>
              <InfoRow
                icon={<User size={15} strokeWidth={1.75} />}
                label="Edad"
                value={`${calculateAge(member.birth_date)} años · ${formatDate(member.birth_date)}`}
              />
              <InfoRow
                icon={<User size={15} strokeWidth={1.75} />}
                label="Género"
                value={
                  member.gender === 'masculino'
                    ? 'Masculino'
                    : member.gender === 'femenino'
                    ? 'Femenino'
                    : 'No indica'
                }
              />
              <InfoRow icon={<Heart size={15} strokeWidth={1.75} />} label="Estado civil" value={member.marital_status} />
              <InfoRow icon={<Briefcase size={15} strokeWidth={1.75} />} label="Profesión" value={member.profession} />
              <InfoRow icon={<Building size={15} strokeWidth={1.75} />} label="Lugar de trabajo" value={member.workplace} />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Participación */}
      {activeTab === 'participacion' && (
        <div className="space-y-3">
          {/* Historial de estudios */}
          <SectionAccordion
            title="Historial de estudios"
            open={openSections.estudios}
            onToggle={() => toggleSection('estudios')}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    {['Estudio', 'Inicio', 'Fin', 'Estado'].map(col => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {member.completed_studies.map((code, i) => {
                    const entry = STUDY_CATALOG.find(s => s.code === code)
                    const yearOffset = member.completed_studies.length - i
                    const startYear = 2025 - yearOffset
                    return (
                      <tr
                        key={code}
                        style={i < member.completed_studies.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                        className="hover:bg-surface-low transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px]',
                                entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/50'
                              )}
                              style={{ fontFamily: 'var(--font-mono)' }}
                            >
                              {code}
                            </span>
                            <span className="text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                              {entry ? entry.name : code}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                          Ene {startYear}
                        </td>
                        <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                          {entry ? `${entry.weeks} sem.` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="rounded-full bg-teal-soft/30 px-2.5 py-0.5 text-xs text-teal-deep"
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            Completado
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {member.current_study && (
                    <tr className="hover:bg-surface-low transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px]',
                              currentStudyEntry ? studyStageColor(currentStudyEntry.stage) : 'bg-surface-low text-navy-light/50'
                            )}
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {member.current_study}
                          </span>
                          <span className="text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                            {currentStudyEntry ? currentStudyEntry.name : member.current_study}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                        2025
                      </td>
                      <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                        —
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="rounded-full bg-coral-soft/20 px-2.5 py-0.5 text-xs text-coral"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          En curso
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionAccordion>

          {/* Historial de servicio */}
          <SectionAccordion
            title="Historial de servicio"
            open={openSections.servicio}
            onToggle={() => toggleSection('servicio')}
          >
            {member.service_history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Sin historial de servicio
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Puesto', 'Comité', 'Desde', 'Hasta', 'Estado'].map(col => (
                        <th
                          key={col}
                          className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {member.service_history.map((s, i) => (
                      <tr
                        key={i}
                        className="hover:bg-surface-low transition-colors"
                        style={i < member.service_history.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                      >
                        <td className="px-4 py-2.5 text-navy" style={{ fontFamily: 'var(--font-body)' }}>{s.position}</td>
                        <td className="px-4 py-2.5 text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{s.committee}</td>
                        <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>{formatDate(s.from)}</td>
                        <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                          {s.to ? formatDate(s.to) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs',
                              s.status === 'activo'
                                ? 'bg-teal-soft/30 text-teal-deep'
                                : 'bg-surface-low text-navy-light/50'
                            )}
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            {s.status === 'activo' ? 'Activo' : 'Finalizado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionAccordion>

          {/* Asistencia a eventos */}
          <SectionAccordion
            title="Asistencia a eventos"
            open={openSections.eventos}
            onToggle={() => toggleSection('eventos')}
          >
            {member.attendance_history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Sin registros de asistencia
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                      {['Evento', 'Tipo', 'Fecha', 'Asistencia'].map(col => (
                        <th
                          key={col}
                          className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {member.attendance_history.map((ev, i) => (
                      <tr
                        key={i}
                        className="hover:bg-surface-low transition-colors"
                        style={i < member.attendance_history.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                      >
                        <td className="px-4 py-2.5 text-navy" style={{ fontFamily: 'var(--font-body)' }}>{ev.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              TYPE_BADGE[ev.type] ?? 'bg-surface-low text-navy-light/50'
                            )}
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            {ev.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-navy-light/50 text-xs whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                          {formatDate(ev.date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              ATTENDANCE_BADGE[ev.attendance_type] ?? 'bg-surface-low text-navy-light/50'
                            )}
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            {ev.attendance_type === 'servidor' ? 'Servidor' : 'Participante'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionAccordion>

          {/* Donaciones */}
          <SectionAccordion
            title="Donaciones"
            open={openSections.donaciones}
            onToggle={() => toggleSection('donaciones')}
          >
            {hasFinanceRole ? (
              <div>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--outline-variant)' }}
                >
                  <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                    {member.donations.length} registros
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealDonations(r => !r)}
                    className="rounded-lg border px-3 py-1 text-xs text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    {revealDonations ? 'Ocultar montos' : 'Mostrar montos'}
                  </button>
                </div>
                {member.donations.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                    Sin registros de donaciones
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                          {['Fecha', 'Descripción', 'Monto'].map(col => (
                            <th
                              key={col}
                              className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {member.donations.map((d, i) => (
                          <tr
                            key={i}
                            className="hover:bg-surface-low transition-colors"
                            style={i < member.donations.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                          >
                            <td className="px-4 py-2.5 text-navy-light/50 text-xs whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                              {formatDate(d.date)}
                            </td>
                            <td className="px-4 py-2.5 text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                              {d.description}
                            </td>
                            <td
                              className="px-4 py-2.5 text-right tabular-nums"
                              style={{ fontFamily: revealDonations ? 'var(--font-mono)' : 'var(--font-body)', fontSize: '13px' }}
                            >
                              {revealDonations ? (
                                <span className="text-navy">{formatAmount(d.amount)}</span>
                              ) : (
                                <span className="text-navy-light/30 tracking-widest">••••••</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-6">
                <Lock size={16} className="text-navy-light/30" strokeWidth={1.75} />
                <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  No tenés permisos para ver esta información.
                </p>
              </div>
            )}
          </SectionAccordion>
        </div>
      )}

      {/* TAB: Familia */}
      {activeTab === 'familia' && (
        <div
          className="rounded-2xl bg-surface-card p-5"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-medium text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Núcleo familiar
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                <UserPlus size={14} strokeWidth={1.75} />
                Vincular familiar
              </button>
              <button
                type="button"
                disabled={member.family_members.length === 0}
                className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-low hover:text-coral"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                <UserMinus size={14} strokeWidth={1.75} />
                Desvincular
              </button>
            </div>
          </div>

          {member.family_members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserPlus size={32} className="text-navy-light/20 mb-3" strokeWidth={1.25} />
              <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                No hay familiares vinculados
              </p>
              <p className="text-xs text-navy-light/30 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
                Usá el botón de arriba para vincular un familiar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {member.family_members.map((fm) => (
                <div
                  key={fm.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                  >
                    {fm.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {fm.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {fm.relation}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px]',
                          fm.status === 'active'
                            ? 'bg-teal-soft/20 text-teal-deep'
                            : 'bg-surface-low text-navy-light/40'
                        )}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {fm.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-navy-light/30" strokeWidth={1.75} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Pase Digital */}
      {activeTab === 'pase' && (
        <div className="flex flex-col items-center gap-5">
          {/* Wallet Card */}
          <div className="bg-navy rounded-2xl p-6 w-full max-w-xs">
            {/* Logo */}
            <div className="flex items-baseline gap-0.5 mb-4">
              <span
                className="text-lg text-white"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                Theos
              </span>
              <span
                className="text-lg text-coral"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
              >
                PLACE
              </span>
            </div>

            {/* Member ID */}
            <p
              className="text-xs text-white/40 mb-1"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              #{member.id.padStart(6, '0')}
            </p>

            {/* Name */}
            <p
              className="text-white text-base leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              {member.first_name}
            </p>
            <p
              className="text-white/60 text-sm mb-5"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              {member.last_name}
            </p>

            {/* QR Grid 7×7 */}
            <div className="grid grid-cols-7 gap-0.5 w-fit mb-4">
              {qrCells(member.id).map((filled, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-4 w-4 rounded-[2px]',
                    filled ? 'bg-white' : 'bg-navy-ink'
                  )}
                />
              ))}
            </div>

            {/* Pass status */}
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs',
                member.wallet_pass_status === 'active'
                  ? 'bg-teal/20 text-teal'
                  : 'bg-white/10 text-white/40'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {member.wallet_pass_status === 'active' ? 'Pase activo' : 'No generado'}
            </span>
          </div>

          {/* Status badge below */}
          <p
            className={cn(
              'text-xs',
              member.wallet_pass_status === 'active' ? 'text-teal-deep' : 'text-navy-light/40'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {member.wallet_pass_status === 'active'
              ? 'Pase digital activo y válido'
              : 'El pase aún no ha sido generado'}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {member.wallet_pass_status === 'not_generated' && (
              <button
                type="button"
                className="w-full rounded-full bg-coral py-2.5 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
                style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
              >
                Generar pase
              </button>
            )}
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Smartphone size={14} strokeWidth={1.75} />
              Enviar a Apple Wallet
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Smartphone size={14} strokeWidth={1.75} />
              Enviar a Google Wallet
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <MessageCircle size={14} strokeWidth={1.75} />
              Reenviar por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
