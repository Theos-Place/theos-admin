'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import type { StudyGroup, StudyType } from '@/types/study'
import { toDomainStudyGroup, toDomainStudyType } from '@/lib/studies/adapter'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle, Users, Trash2 } from 'lucide-react'
import { getInitials, toYmdLocal, formatDate } from '@/lib/format'
import { textoDeBorrado } from '@/lib/studies/correccion-de-asistencia'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'

/**
 * Pasar lista — y, con `?sesion=<id>`, CORREGIR una lista ya pasada.
 *
 * Es la MISMA pantalla, no una segunda. Corregir es volver a marcar a la
 * misma gente con los mismos botones: con una pantalla aparte, el día que se
 * agregue un participante o cambie el criterio de quién aparece en la lista,
 * una de las dos se queda atrás. Lo único que cambia en modo corrección es
 * de dónde salen los valores iniciales, el verbo del botón y que aparece
 * «Borrar esta sesión» (pedido de Floriana, 2026-10-07).
 */
export default function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const sesionId = useSearchParams().get('sesion')
  const corrigiendo = !!sesionId
  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [studyType, setStudyType] = useState<StudyType | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const todayYmd = toYmdLocal(new Date()) // hora local, no UTC (después de las 6 pm difieren)
  const [sessionDate, setSessionDate] = useState(todayYmd)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Cuántas marcas tiene la sesión que se está corrigiendo: el aviso de
   *  borrado lo necesita para decir qué se lleva por delante. */
  const [marcasPrevias, setMarcasPrevias] = useState(0)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)

  // Carga el grupo real y su plan de estudio.
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/studies/groups/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch('/api/studies/plans').then(r => (r.ok ? r.json() : [])),
    ]).then(([g, plans]) => {
      if (!alive) return
      const domainGroup = g ? toDomainStudyGroup(g) : null
      setGroup(domainGroup)
      if (domainGroup && Array.isArray(plans)) {
        const plan = plans.find((p: { code: string }) => p.code === domainGroup.study_type_id)
        setStudyType(plan ? toDomainStudyType(plan) : null)
      }
      const init: Record<string, boolean> = {}
      domainGroup?.participants.filter(p => p.status === 'enrolled').forEach(p => { init[p.member_id] = false })
      setAttendance(init)
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  /**
   * Modo corrección: los valores iniciales salen de la sesión guardada.
   *
   * Corre DESPUÉS del efecto de arriba y pisa su `init` a propósito: ese deja
   * a todo el mundo en ausente, que es lo correcto al pasar lista nueva y
   * sería un desastre acá — abrir la corrección y guardar sin tocar nada
   * borraría la asistencia entera.
   *
   * Quien tiene marca queda como está; a quien NO la tiene se le deja en
   * ausente nada más como valor del botón: la diferencia entre «ausente» y
   * «sin registro» la resuelve el endpoint comparando contra lo guardado.
   */
  useEffect(() => {
    if (!sesionId) return
    let alive = true
    fetch(`/api/studies/groups/${id}/sessions`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        const ses = (d.sesiones ?? []).find((x: { id: string }) => x.id === sesionId)
        if (!ses) { setError('Esa sesión ya no existe.'); return }
        setSessionDate(String(ses.date).slice(0, 10))
        const mias = (d.marcas ?? []).filter((m: { session_id: string }) => m.session_id === sesionId)
        setMarcasPrevias(mias.length)
        setAttendance(prev => {
          const next = { ...prev }
          for (const m of mias as Array<{ member_id: string; present: boolean }>) {
            next[m.member_id] = m.present
          }
          return next
        })
      })
      .catch(() => { if (alive) setError('No se pudo cargar la sesión.') })
    return () => { alive = false }
  }, [id, sesionId])

  const enrolled = group?.participants.filter(p => p.status === 'enrolled') ?? []

  if (loading) {
    return <div className="flex items-center justify-center min-h-60"><p className="text-sm text-navy-light/80 font-body">Cargando…</p></div>
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/grupos" className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy">
          <ChevronLeft size={16} /> Grupos
        </Link>
        <p className="text-navy-light/80 font-body">Grupo no encontrado.</p>
      </div>
    )
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const sessionNum = group.current_week + 1

  function markAll() {
    const all: Record<string, boolean> = {}
    enrolled.forEach(p => { all[p.member_id] = true })
    setAttendance(all)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const marcas = enrolled.map(p => ({ member_id: p.member_id, present: attendance[p.member_id] ?? false }))
      const res = corrigiendo
        ? await fetch(`/api/studies/groups/${id}/sessions/${sesionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_date: sessionDate, marcas }),
          })
        : await fetch(`/api/studies/groups/${id}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_date: sessionDate,
              notes: notes.trim() || null,
              attendance: marcas,
            }),
          })
      if (!res.ok) {
        // El endpoint explica POR QUÉ cuando el motivo le sirve a quien está
        // mirando; «Error interno» no, y para eso está el texto genérico.
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || `HTTP ${res.status}`)
      }
      setSaved(true)
    } catch (err) {
      console.error('No se pudo guardar la asistencia:', err)
      setError(err instanceof Error && !/^HTTP /.test(err.message)
        ? err.message
        : 'No se pudo guardar la asistencia. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleBorrar() {
    if (borrando || !sesionId) return
    setBorrando(true)
    setError(null)
    try {
      const res = await fetch(`/api/studies/groups/${id}/sessions/${sesionId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.push(`/estudios/grupos/${id}`)
    } catch (err) {
      console.error('No se pudo borrar la sesión:', err)
      setError('No se pudo borrar la sesión. Intentá de nuevo.')
      setConfirmandoBorrado(false)
    } finally {
      setBorrando(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <CheckCircle size={48} className="text-teal-deep mx-auto" />
          <p className="text-xl font-bold text-navy font-display">
            {corrigiendo ? 'Asistencia corregida' : 'Asistencia guardada'}
          </p>
          <p className="text-sm text-navy-light/80 font-body">
            {presentCount} de {enrolled.length} participantes presentes.
          </p>
          <Link
            href={`/estudios/grupos/${id}`}
            className="inline-block rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors mt-2"
          >
            Volver al grupo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/estudios/grupos/${id}`}
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver al grupo
      </Link>

      {/* Header */}
      <div>
        <h1
          className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
        >
          {corrigiendo ? 'Corregir la lista' : 'Pasar lista'}
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          {group.study_type_id} — {sedeLabel(group.zone)}
        </p>
        {/* Fecha editable (default hoy, sin futuro): permite registrar una
            sesión pasada que quedó sin pasar lista ese día. */}
        <label className="mt-1 flex items-center gap-2 text-sm text-navy-light/80 font-body">
          Fecha de la sesión
          <input
            type="date"
            value={sessionDate}
            max={todayYmd}
            onChange={e => setSessionDate(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          />
        </label>
        {corrigiendo && (
          /* Que quede dicho que esto PISA lo que ya estaba. Al abrir desde la
             lista de sesiones no es obvio: la pantalla se ve igual que la de
             pasar lista nueva. */
          <p className="mt-2 text-[13px] text-navy-light/80 font-body">
            Estás corrigiendo la lista del <strong>{formatDate(sessionDate)}</strong>.
            Lo que guardés reemplaza lo que había.
          </p>
        )}
      </div>

      {/* Herramienta de una acción: lista a la izquierda, resumen + notas a la derecha. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Participant list */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="divide-y border-[var(--outline-variant)]">
            {enrolled.map(p => {
              const present = attendance[p.member_id] ?? false
              return (
                <div
                  key={p.member_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-low transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy shrink-0">
                    {getInitials(p.member_name)}
                  </div>
                  <span
                    className="flex-1 text-sm text-navy font-body"
                  >
                    {p.member_name}
                  </span>
                  <button
                    onClick={() => setAttendance(prev => ({ ...prev, [p.member_id]: !prev[p.member_id] }))}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                      present
                        ? 'bg-teal-deep text-white'
                        : 'bg-surface-low text-navy-light/80 hover:bg-surface-card',
                      'font-display',
                    )}
                  >
                    {present ? 'Presente' : 'Ausente'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel: sesión, contador, notas y guardado */}
        <div className="space-y-5 lg:sticky lg:top-6">
          {/* Session info & counter */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p
                  className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                >
                  Sesión {sessionNum} de {studyType?.weeks ?? '?'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p
                    className="text-2xl font-bold text-coral font-display"
                  >
                    {presentCount} / {enrolled.length}
                  </p>
                  <p className="text-[13px] text-navy-light/80 font-body">presentes</p>
                </div>
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                >
                  <Users size={14} /> Marcar todos presentes
                </button>
              </div>
            </div>
          </div>

          {/* Las notas solo se piden al pasar lista nueva: la corrección no
              las manda y mostrar el campo vacío haría creer que se borran. */}
          {!corrigiendo && (
          <div className="space-y-1">
            <label htmlFor="notas-de-la-sesion"
              className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display"
            >
              Notas de la sesión
            </label>
            <textarea id="notas-de-la-sesion"
              className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
              rows={3}
              placeholder="Temas tratados, observaciones del grupo, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          )}

          {error && <p className="text-[13px] text-coral font-body" role="alert">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {saving
              ? 'Guardando…'
              : corrigiendo ? 'Guardar la corrección' : 'Guardar asistencia'}
          </button>

          {corrigiendo && (
            /* Borrar vive ACÁ y no en la lista de sesiones: para llegar hay
               que haber abierto la sesión y visto a quién tiene marcado. Un
               botón de basurero en una fila de tabla se aprieta sin leer. */
            <button
              onClick={() => setConfirmandoBorrado(true)}
              className="flex items-center gap-1.5 text-[13px] text-coral hover:text-coral-deep transition-colors font-body"
            >
              <Trash2 size={14} aria-hidden="true" /> Borrar esta sesión
            </button>
          )}
        </div>
      </div>

      {confirmandoBorrado && (
        <Modal onClose={() => setConfirmandoBorrado(false)} titleId="borrar-sesion">
          <h2 id="borrar-sesion" className="text-lg font-bold text-navy font-display">
            Borrar la sesión
          </h2>
          <p className="mt-2 text-sm text-navy-light/80 font-body">
            {textoDeBorrado({ session_date: formatDate(sessionDate), marcas: Array(marcasPrevias).fill(0) })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variante="fantasma" onClick={() => setConfirmandoBorrado(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBorrar} disabled={borrando}>
              {borrando ? 'Borrando…' : 'Sí, borrarla'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

