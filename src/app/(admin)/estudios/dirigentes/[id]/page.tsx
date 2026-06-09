'use client'

import { use, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useDirigentes } from '@/hooks/useDirigentes'
import { useStudies } from '@/hooks/useStudies'
import { useAuth } from '@/hooks/useAuth'
import { useSedes } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { cn } from '@/lib/utils'
import { ChevronLeft, ExternalLink, Users, X, Pencil } from 'lucide-react'
import type { DirigenteGrupo } from '@/lib/dirigentes'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })
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
        <p className="text-[11px] text-navy-light/50 font-body">{fmtDate(g.date)}</p>
      </div>
      <span className="flex items-center gap-1 text-xs text-navy-light/50 font-body shrink-0">
        <Users size={12} /> {g.students_count}
      </span>
      <ExternalLink size={13} className="text-navy-light/30 shrink-0" />
    </Link>
  )
}

export default function DirigenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dirigentes, loading } = useDirigentes()
  const d = dirigentes.find(x => x.member_id === id)

  if (loading) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/50">Cargando…</p>
      </div>
    )
  }

  if (!d) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy font-body">
          <ChevronLeft size={16} /> Dirigentes
        </Link>
        <p className="text-navy-light/60 font-body">Dirigente no encontrado.</p>
      </div>
    )
  }

  const totalStudents = [...d.estudios_activos, ...d.estudios_completados].reduce((s, g) => s + g.students_count, 0)

  return (
    <div className="space-y-5">
      <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Dirigentes
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-base font-display font-extrabold">
            {initials(d.member_name) || '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl text-navy font-display font-extrabold tracking-[-0.02em]">{d.member_name || 'Sin nombre'}</h1>
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium font-body',
                d.status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/50',
              )}>
                {d.status === 'activo' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sm text-navy-light/60 font-body mt-1">
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
            <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display mb-1.5">Estudios que ha impartido</p>
            <div className="flex flex-wrap gap-1.5">
              {d.estudios_habilitados.map(code => <StudyTypeBadge key={code} code={code} size="sm" />)}
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
          <p className="text-sm text-navy-light/40 font-body">No tiene grupos activos.</p>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <h2 className="text-sm text-navy font-display font-extrabold mb-3">Historial de estudios impartidos ({d.estudios_completados.length})</h2>
        {d.estudios_completados.length > 0 ? (
          <div className="space-y-1">{d.estudios_completados.map(g => <GrupoRow key={g.group_id} g={g} />)}</div>
        ) : (
          <p className="text-sm text-navy-light/40 font-body">Sin estudios registrados.</p>
        )}
      </div>
    </div>
  )
}

// ─── Configuración editable del dirigente (estudios que imparte + zonas) ─────────
function DirigenteConfigCard({ memberId }: { memberId: string }) {
  const { studyTypes, leaders } = useStudies()
  const { activeSedes: SEDES } = useSedes()
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'coordinador_dirigentes')

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

  const addStudy = (code: string) => { if (code && !studies.includes(code)) { setStudies([...studies, code]); setSaved(false) } }
  const removeStudy = (code: string) => { setStudies(studies.filter(c => c !== code)); setSaved(false) }
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
    } catch { /* noop */ }
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
        <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Estudios que imparte</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {studies.length === 0 && <span className="text-xs text-navy-light/40 font-body">Ninguno</span>}
          {studies.map(code => (
            <span key={code} className="inline-flex items-center gap-1">
              <StudyTypeBadge code={code} size="sm" />
              {editing && <button onClick={() => removeStudy(code)} className="text-navy-light/40 hover:text-coral"><X size={12} /></button>}
            </span>
          ))}
        </div>
        {editing && (
          <select
            value=""
            onChange={e => addStudy(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body w-full sm:w-auto"
          >
            <option value="">+ Agregar estudio…</option>
            {studyTypes.filter(t => !studies.includes(t.code)).map(t => (
              <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Zonas */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display">Zonas donde da estudios</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {zones.length === 0 && <span className="text-xs text-navy-light/40 font-body">Ninguna</span>}
          {zones.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-low px-2.5 py-0.5 text-xs text-navy font-body">
              {sedeName(id)}
              {editing && <button onClick={() => removeZone(id)} className="text-navy-light/40 hover:text-coral"><X size={11} /></button>}
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
