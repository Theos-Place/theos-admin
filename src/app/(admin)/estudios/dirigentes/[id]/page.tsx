'use client'

import { use, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useDirigentes } from '@/hooks/useDirigentes'
import { useStudies } from '@/hooks/useStudies'
import { useAuth } from '@/hooks/useAuth'
import { useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { groupCodesForDisplay, studySelectOptions, expandSelectionValue } from '@/lib/studies/study-grouping'
import { cn } from '@/lib/utils'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { ChevronLeft, ExternalLink, Users, X, Pencil, Info } from 'lucide-react'
import type { DirigenteGrupo } from '@/lib/dirigentes'
import { getInitials } from '@/lib/format'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })
}

/** Label de sección con tooltip accesible (visible en hover y foco de teclado). */
function SectionLabel({ text, tooltip }: { text: string; tooltip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">{text}</span>
      <button
        type="button"
        aria-label={tooltip}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-navy-light/70 hover:text-navy transition-colors"
      >
        <Info size={11} />
      </button>
      {show && (
        <span className="absolute bottom-full left-0 mb-1.5 w-max max-w-[260px] rounded-md bg-navy px-2.5 py-1.5 text-[12px] normal-case tracking-normal text-white z-50 shadow-[var(--shadow-md)] font-body">
          {tooltip}
        </span>
      )}
    </span>
  )
}

function GrupoRow({ g }: { g: DirigenteGrupo }) {
  return (
    <Link
      href={`/estudios/grupos/${g.group_id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors"
    >
      <StudyTypeBadge code={g.plan_code} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-navy font-body truncate">{g.group_name}</p>
        <p className="text-[12px] text-navy-light/70 font-body">{fmtDate(g.date)}</p>
      </div>
      <span className="flex items-center gap-1 text-xs text-navy-light/70 font-body shrink-0">
        <Users size={12} /> {g.students_count}
      </span>
      <ExternalLink size={13} className="text-navy-light/70 shrink-0" />
    </Link>
  )
}

/** Toggle manual de estado del dirigente (activo/inactivo). Pide confirmación
 *  explicando el efecto (activar = agrega al Comité de Dirigentes + rol dirigente;
 *  desactivar = lo saca del comité + quita el rol). No permite desactivar a quien
 *  tiene un grupo en curso/abierto (punto 1): muestra ActiveWarningModal. */
function StatusToggle({ memberId, memberName, active, onChanged }: { memberId: string; memberName: string; active: boolean; onChanged: () => void }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [warn, setWarn] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const who = memberName || 'este dirigente'
  async function apply() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/studies/dirigentes/${memberId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      })
      if (res.status === 409) { setConfirm(false); setWarn(true); return }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setConfirm(false)
      onChanged()
    } catch (e) {
      console.error('No se pudo cambiar el estado:', e)
      toast(e instanceof Error ? e.message : `No se pudo ${active ? 'desactivar' : 'activar'} al dirigente. Intentá de nuevo.`, 'error')
    }
    finally { setSaving(false) }
  }
  return (
    <>
    <ActiveWarningModal
      open={warn}
      title="No se puede desactivar"
      message="Este dirigente tiene un grupo en curso o abierto. Cerrá o reasigná esos grupos antes de marcarlo inactivo."
      onClose={() => setWarn(false)}
    />
    {confirm && (
      <Modal onClose={() => setConfirm(false)} titleId="confirm-estado-title" width={400}>
        <div className="p-6 space-y-4">
          <h3 id="confirm-estado-title" className="text-base font-bold text-navy font-display">
            {active ? 'Desactivar dirigente' : 'Activar dirigente'}
          </h3>
          <p className="text-sm text-navy-light/70 font-body leading-relaxed">
            {active ? (
              <>Al desactivar a <strong className="text-navy">{who}</strong> se lo va a <strong className="text-navy">quitar del Comité de Dirigentes</strong> y va a <strong className="text-navy">perder el rol de dirigente</strong>. Su historial de estudios se conserva.</>
            ) : (
              <>Al activar a <strong className="text-navy">{who}</strong> se lo va a <strong className="text-navy">agregar al Comité de Dirigentes</strong> y se le va a <strong className="text-navy">asignar el rol de dirigente</strong>.</>
            )}
          </p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setConfirm(false)} disabled={saving} className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            <button onClick={apply} disabled={saving} className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
              {saving ? 'Aplicando…' : (active ? 'Sí, desactivar' : 'Sí, activar')}
            </button>
          </div>
        </div>
      </Modal>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Desactivar dirigente' : 'Activar dirigente'}
      onClick={() => setConfirm(true)}
      disabled={saving}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span className={cn('relative inline-block h-5 w-9 rounded-full transition-colors shrink-0', active ? 'bg-[#3DB97A]' : 'bg-navy-light/25')}>
        <span className={cn('absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform', active ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      <span className="text-[12px] text-navy-light/70 font-body">{active ? 'Activo' : 'Inactivo'}</span>
    </button>
    </>
  )
}

export default function DirigenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dirigentes, loading, refetch } = useDirigentes()
  const { hasRole } = useAuth()
  const canToggle = hasRole('admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios')
  const d = dirigentes.find(x => x.member_id === id)

  if (loading) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/70">Cargando…</p>
      </div>
    )
  }

  if (!d) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/70 hover:text-navy font-body">
          <ChevronLeft size={16} /> Dirigentes
        </Link>
        <p className="text-navy-light/70 font-body">Dirigente no encontrado.</p>
      </div>
    )
  }

  const totalStudents = [...d.estudios_activos, ...d.estudios_completados].reduce((s, g) => s + g.students_count, 0)

  return (
    <div className="space-y-5">
      <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/70 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Dirigentes
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-base font-display font-extrabold">
            {getInitials(d.member_name) || '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl text-navy font-display font-extrabold tracking-[-0.02em]">{d.member_name || 'Sin nombre'}</h1>
              {canToggle ? (
                <StatusToggle memberId={d.member_id} memberName={d.member_name} active={d.status === 'activo'} onChanged={refetch} />
              ) : (
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[12px] font-medium font-body',
                  d.status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/70',
                )}>
                  {d.status === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
              )}
            </div>
            <p className="text-sm text-navy-light/70 font-body mt-1">
              {d.total_grupos} grupos liderados · {d.total_activos} activos · {totalStudents} estudiantes en total
            </p>
            <Link href={`/miembros/${d.member_id}`} className="inline-flex items-center gap-1 text-xs text-coral hover:text-coral-deep transition-colors font-body mt-2">
              Ver perfil del miembro <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Estudios habilitados */}
        {d.estudios_habilitados.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5">
              <SectionLabel text="Formación de estudios" tooltip="Estudios que el dirigente está capacitado para dar" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <GroupedStudyBadges codes={d.estudios_habilitados} />
            </div>
          </div>
        )}
      </div>

      {/* Configuración del dirigente */}
      <DirigenteConfigCard memberId={d.member_id} />

      {/* Estudios activos */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <h2 className="text-sm text-navy font-display font-extrabold mb-3">Dando ahora ({d.estudios_activos.length})</h2>
        {d.estudios_activos.length > 0 ? (
          <div className="space-y-1">{d.estudios_activos.map(g => <GrupoRow key={g.group_id} g={g} />)}</div>
        ) : (
          <p className="text-sm text-navy-light/70 font-body">No tiene grupos activos.</p>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <h2 className="text-sm text-navy font-display font-extrabold mb-3">Historial de estudios impartidos ({d.estudios_completados.length})</h2>
        {d.estudios_completados.length > 0 ? (
          <div className="space-y-1">{d.estudios_completados.map(g => <GrupoRow key={g.group_id} g={g} />)}</div>
        ) : (
          <p className="text-sm text-navy-light/70 font-body">Sin estudios registrados.</p>
        )}
      </div>
    </div>
  )
}

// Badges de estudios con N1–N4 colapsados en "Niveles" y DIS1–3 en "Discípulos"
// (presentación). En edición, la X quita el grupo completo (todos sus códigos).
function GroupedStudyBadges({ codes, editing, onRemove }: { codes: string[]; editing?: boolean; onRemove?: (codes: string[]) => void }) {
  const badges = groupCodesForDisplay(codes, c => c)
  return (
    <>
      {badges.map(b => b.value.startsWith('GRP:') ? (
        <span key={b.value} className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[12px] text-navy font-body font-semibold">
          {b.label}
          {editing && onRemove && <button onClick={() => onRemove(b.codes)} className="text-navy-light/70 hover:text-coral"><X size={11} /></button>}
        </span>
      ) : (
        <span key={b.value} className="inline-flex items-center gap-1">
          <StudyTypeBadge code={b.codes[0]} size="sm" />
          {editing && onRemove && <button onClick={() => onRemove(b.codes)} className="text-navy-light/70 hover:text-coral"><X size={12} /></button>}
        </span>
      ))}
    </>
  )
}

// ─── Configuración editable del dirigente (estudios que imparte + zonas) ─────────
function DirigenteConfigCard({ memberId }: { memberId: string }) {
  const toast = useToast()
  const { studyTypes, leaders } = useStudies('plans', 'leaders')
  const { activeSedes: SEDES } = useSedes()
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'direccion', 'coordinador_dirigentes')

  const leader = useMemo(() => leaders.find(l => l.member_id === memberId), [leaders, memberId])
  const [studies, setStudies] = useState<string[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [init, setInit] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Inicializa una sola vez con los datos del dirigente (si existen).
  useEffect(() => {
    if (init) return
    if (leaders.length === 0) return
    setStudies(leader?.qualified_studies ?? [])
    setZones(leader?.zone_preference ?? [])
    setInit(true)
  }, [leaders, leader, init])

  // Agregar/quitar acepta un value de opción (grupo 'GRP:*' o code) y opera sobre
  // todos los códigos reales que representa — el modelo sigue por estudio individual.
  const addStudy = (value: string) => {
    if (!value) return
    setStudies(prev => Array.from(new Set([...prev, ...expandSelectionValue(value)])))
    setSaved(false)
  }
  const removeCodes = (codes: string[]) => {
    const drop = new Set(codes)
    setStudies(prev => prev.filter(c => !drop.has(c)))
    setSaved(false)
  }
  const addZone = (id: string) => { if (id && !zones.includes(id)) { setZones([...zones, id]); setSaved(false) } }
  const removeZone = (id: string) => { setZones(zones.filter(z => z !== id)); setSaved(false) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/studies/dirigentes/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualified_study_codes: studies, zone_preference: zones }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setEditing(false)
    } catch {
      toast('No se pudo guardar la configuración del dirigente (estudios y zonas). Intentá de nuevo.', 'error')
    }
    finally { setSaving(false) }
  }

  function cancel() {
    setStudies(leader?.qualified_studies ?? [])
    setZones(leader?.zone_preference ?? [])
    setEditing(false)
  }

  const sedeName = (id: string) => SEDES.find(s => s.id === id)?.name ?? id

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-navy font-display font-extrabold">Configuración del dirigente</h2>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            <Pencil size={12} /> Editar perfil de dirigente
          </button>
        )}
      </div>

      {/* Estudios que imparte */}
      <div className="space-y-2">
        <SectionLabel text="Disponibilidad de estudios" tooltip="Estudios que el dirigente está dispuesto a dar en este momento" />
        <div className="flex flex-wrap gap-1.5 items-center">
          {studies.length === 0 && <span className="text-xs text-navy-light/70 font-body">Ninguno</span>}
          <GroupedStudyBadges codes={studies} editing={editing} onRemove={removeCodes} />
        </div>
        {editing && (
          <select
            value=""
            onChange={e => addStudy(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body w-full sm:w-auto"
          >
            <option value="">+ Agregar estudio…</option>
            {studySelectOptions(studyTypes).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Zonas */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">Zonas donde da estudios</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {zones.length === 0 && <span className="text-xs text-navy-light/70 font-body">Ninguna</span>}
          {zones.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-low px-2.5 py-0.5 text-xs text-navy font-body">
              {sedeName(id)}
              {editing && <button onClick={() => removeZone(id)} className="text-navy-light/70 hover:text-coral"><X size={11} /></button>}
            </span>
          ))}
        </div>
        {editing && (
          <select
            value=""
            onChange={e => addZone(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body w-full sm:w-auto"
          >
            <option value="">+ Agregar zona…</option>
            {SEDES.filter(s => !zones.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button onClick={cancel} disabled={saving} className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            Cancelar
          </button>
        </div>
      )}
      {saved && !editing && <span className="text-xs text-[#3DB97A] font-body">Guardado ✓</span>}
    </div>
  )
}
