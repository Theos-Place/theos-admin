'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/hooks/useGroup'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { GROUP_ADMIN_ROLES, STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { sedeLabel } from '@/lib/sedes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge, NoLeaderBadge, LeaderTrainingBadge, VirtualGroupBadge } from '@/components/studies/GroupStatusBadge'
import { WeekProgressBar } from '@/components/studies/WeekProgressBar'
import { cn } from '@/lib/utils'
import { ChevronLeft, Plus, MessageCircle, Send, Edit2, Trash2, Users, Lock } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'
import { getInitials } from '@/lib/format'
import { LeaderContact } from '@/components/studies/LeaderContact'
import { StudyReceiptModal } from '@/components/finance/StudyReceiptModal'
import { StudyRequestActions } from '@/components/studies/StudyRequestActions'
import { ResolverInscripcion } from '@/components/studies/ResolverInscripcion'
import { LeaderFeedbackPanel } from '@/components/studies/LeaderFeedbackPanel'
import { withdrawReasonError } from '@/lib/studies/close-payload'

/** GRU-2 · Resumen legible de la restricción de audiencia del grupo. El detalle
 *  no viaja en el listado (solo el flag), así que se pide acá. */
function GroupRestrictionNote({ groupId }: { groupId: string }) {
  const [info, setInfo] = useState<{ summary: string; count: number | null } | null>(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/studies/groups/${groupId}/restriction`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo && d?.summary) setInfo({ summary: d.summary, count: d.count ?? null }) })
      .catch(() => { /* sin resumen: no se pinta nada */ })
    return () => { vivo = false }
  }, [groupId])
  if (!info) return null
  return (
    <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
      <Lock size={13} className="mt-0.5 shrink-0" />
      <span>
        Solo para: <strong className="text-navy">{info.summary}</strong>
        {info.count !== null && (
          <span className="text-navy-light/80"> · {info.count.toLocaleString('es-CR')} {info.count === 1 ? 'persona cumple' : 'personas cumplen'}</span>
        )}
      </span>
    </p>
  )
}

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-teal-deep' : pct >= 40 ? 'bg-amber-400' : 'bg-coral'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface-low overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] text-navy-light/80 font-body">{pct}%</span>
    </div>
  )
}

function AddMemberModal({ groupId, studyName, enrolledIds, onClose, onEnrolled }: {
  groupId: string
  /** Nombre del estudio, para el modal del comprobante. */
  studyName: string
  enrolledIds: Set<string>
  onClose: () => void
  onEnrolled: () => void
}) {
  const toast = useToast()
  const { roles } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; first_name: string; last_name: string; cedula: string | null }[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  // GRU-2: si la persona no cumple la restricción de audiencia del grupo, el
  // staff puede matricularla igual — pero confirmándolo, y queda registrado.
  const puedeSaltarRestriccion = roles.some(r => (STUDY_ADMIN_ROLES as readonly string[]).includes(r))
  const [restriccion, setRestriccion] = useState<{ memberId: string; nombre: string; motivo: string } | null>(null)
  // El comprobante SIEMPRE se pide (2026-08-06): también cuando matricula el
  // staff. La matrícula ya quedó hecha; esto es el pago, que va por su carril.
  const [comprobante, setComprobante] = useState<{ enrollmentId: string; amount: number; currency: string | null } | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let alive = true
    const t = setTimeout(() => {
      // /lookup: editor_grupos_estudio no tiene el módulo miembros y no podía
      // buscar a quién agregar al grupo (bug 2026-08-04).
      fetch(`/api/members/lookup?search=${encodeURIComponent(q)}&pageSize=6`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => { if (alive) setResults(d.members ?? []) })
        .catch(() => { if (alive) setResults([]) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  async function enroll(memberId: string, overrideRestriccion = false) {
    setAdding(memberId)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          ...(overrideRestriccion ? { override_restriccion: true } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.code === 'restriccion_grupo' && puedeSaltarRestriccion) {
        const m = results.find(x => x.id === memberId)
        setRestriccion({
          memberId,
          nombre: m ? `${m.first_name} ${m.last_name}` : 'Esta persona',
          motivo: String(data?.error ?? ''),
        })
        setAdding(null)
        return
      }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      onEnrolled()
      if (data?.requires_payment && data?.enrollment_id) {
        setComprobante({ enrollmentId: data.enrollment_id, amount: Number(data.amount ?? 0), currency: data.currency ?? null })
        setAdding(null)
        return   // el modal del comprobante reemplaza al de búsqueda
      }
      onClose()
    } catch (err) {
      console.error('No se pudo inscribir al miembro:', err)
      toast(err instanceof Error && err.message ? err.message : 'No se pudo inscribir al miembro en el grupo. Intentá de nuevo.', 'error')
      setAdding(null)
    }
  }

  // Comprobante de la matrícula recién hecha.
  if (comprobante) {
    return (
      <StudyReceiptModal
        enrollmentId={comprobante.enrollmentId}
        studyName={studyName}
        amount={comprobante.amount}
        currency={comprobante.currency}
        onDone={() => { setComprobante(null); onClose() }}
      />
    )
  }

  // Confirmación del override: dice QUÉ restricción se está saltando.
  if (restriccion) {
    return (
      <Modal onClose={() => setRestriccion(null)} titleId="override-restriccion-title" width={440}>
        <div className="p-6 space-y-4">
          <h3 id="override-restriccion-title" className="text-base font-bold text-navy font-display">
            {restriccion.nombre} no cumple la restricción del grupo
          </h3>
          <p className="text-[13px] text-navy-light/80 font-body">
            {restriccion.motivo} ¿Matricularla de todas formas? Queda registrado quién lo autorizó.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { const id = restriccion.memberId; setRestriccion(null); enroll(id, true) }}
              className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Matricular de todas formas
            </button>
            <button
              onClick={() => setRestriccion(null)}
              className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} titleId="anadir-miembro-title" width={384}>
      <div className="p-5 space-y-4">
        <h3 id="anadir-miembro-title" className="font-semibold text-navy font-display">
          Añadir miembro
        </h3>
        <input
          autoFocus
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          placeholder="Buscar por nombre o cédula..."
          aria-label="Buscar por nombre o cédula"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map(m => {
            const already = enrolledIds.has(m.id)
            return (
              <button
                key={m.id}
                disabled={already || adding === m.id}
                onClick={() => enroll(m.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-low text-left transition-colors disabled:opacity-50"
              >
                <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy shrink-0">
                  {getInitials(`${m.first_name} ${m.last_name}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy font-body">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-[13px] text-navy-light/80">{m.cedula ?? 'Sin cédula'}</p>
                </div>
                {already && <span className="text-[13px] text-navy-light/80">Ya inscrito</span>}
                {adding === m.id && <span className="text-[13px] text-navy-light/80">…</span>}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

/** Envío REAL vía el módulo de comunicaciones (correo + notificación interna
 *  a los participantes activos). El botón está gateado por
 *  can('comunicaciones','create') — los endpoints exigen ese rol. */
function SendMessageModal({ groupName, memberIds, onClose }: {
  groupName: string
  memberIds: string[]
  onClose: () => void
}) {
  const [subject, setSubject] = useState(`Grupo ${groupName}`)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const createRes = await fetch('/api/communications/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          kind: 'transactional',
          subject,
          body: msg,
          body_format: 'text',
          segment_label: `Grupo · ${groupName}`,
          total_recipients: memberIds.length,
          smtp_config_id: null,
          whatsapp_config_id: null,
        }),
      })
      if (!createRes.ok) throw new Error()
      const { id } = await createRes.json()
      const recipients = memberIds.flatMap(mid => [
        { member_id: mid, channel: 'email', recipient: '' },
        { member_id: mid, channel: 'interna', recipient: '' },
      ])
      const sendRes = await fetch(`/api/communications/messages/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      })
      if (!sendRes.ok) {
        const d = await sendRes.json().catch(() => null)
        throw new Error(d?.error)
      }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo enviar el mensaje. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Modal onClose={onClose} titleId="mensaje-enviado-title" width={384}>
        <div className="p-6 text-center space-y-3">
          <Send size={32} className="text-teal-deep mx-auto" />
          <p id="mensaje-enviado-title" className="font-semibold text-navy font-display">Mensaje enviado</p>
          <p className="text-sm text-navy-light/80 font-body">
            Se envió a {memberIds.length} participante{memberIds.length !== 1 ? 's' : ''} (correo + notificación).
            Podés ver el estado en Comunicaciones.
          </p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors">
            Cerrar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} titleId="enviar-mensaje-grupo-title" width={384}>
      <div className="p-5 space-y-4">
        <h3 id="enviar-mensaje-grupo-title" className="font-semibold text-navy font-display">Enviar mensaje al grupo</h3>
        <p className="text-sm text-navy-light/80 font-body">
          Va por correo y notificación interna a {memberIds.length} participante{memberIds.length !== 1 ? 's' : ''} activo{memberIds.length !== 1 ? 's' : ''}.
        </p>
        <input
          aria-label="Asunto"
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
        <textarea
          aria-label="Mensaje"
          className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 resize-none font-body"
          rows={4}
          placeholder="Escribe tu mensaje..."
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />
        {error && <p className="text-sm text-coral font-body" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={!msg.trim() || !subject.trim() || memberIds.length === 0 || sending}
            className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function GrupoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { group, studyTypes, refetch, loading } = useGroup(id)
  const { can } = usePermissions()
  const { user: actor } = useAuth()
  const toast = useToast()
  // El envío usa los endpoints de comunicaciones, que exigen ese rol.
  const canSendMessage = can('comunicaciones', 'create')
  // Crear/editar/eliminar grupos: STUDY_ADMIN + editor_grupos_estudio.
  const canManageGroups = (actor?.roles ?? []).some(r => (GROUP_ADMIN_ROLES as string[]).includes(r))
  // SEC-1: 'member'/'none' = vista de solo lectura (miembro inscrito viendo SU
  // grupo): sin añadir/desinscribir, sin links a perfiles ajenos, sin editar
  // el link de WhatsApp. El server ya recorta el roster a su propia inscripción.
  const readOnly = group?.viewer_scope === 'member' || group?.viewer_scope === 'none'
  const [activeTab, setActiveTab] = useState('participantes')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSendMessage, setShowSendMessage] = useState(false)
  const [withdrawTarget, setWithdrawTarget] = useState<{ member_id: string; member_name: string } | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState(false)
  // EST-14: el motivo del retiro es obligatorio. Antes se mandaba hardcodeado
  // 'Desinscrito desde el grupo', así que los retiros quedaban sin el porqué.
  const [withdrawReason, setWithdrawReason] = useState('')
  const motivoInvalido = withdrawReasonError(withdrawReason)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeWarn, setActiveWarn] = useState<string | null>(null)

  // Eliminar grupo (regla global de borrado): el server responde 409 si hay
  // personas activas → se muestra el ActiveWarningModal; si no, se borra y volvemos.
  async function confirmDeleteGroup() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/studies/groups/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (res.status === 409) { setDeleteOpen(false); setActiveWarn(body?.error ?? 'El grupo tiene personas activas.'); return }
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo eliminar')
      toast('Grupo eliminado.', 'success')
      router.push('/estudios/grupos')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar el grupo.', 'error')
    } finally { setDeleting(false) }
  }

  async function confirmWithdraw() {
    if (!withdrawTarget || withdrawing) return
    if (withdrawReasonError(withdrawReason)) return
    setWithdrawing(true)
    setWithdrawError(false)
    try {
      const res = await fetch(`/api/studies/groups/${id}/enrollments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: withdrawTarget.member_id, reason: withdrawReason.trim() }),
      })
      if (!res.ok) throw new Error()
      setWithdrawTarget(null)
      refetch()
    } catch {
      setWithdrawError(true)
    } finally {
      setWithdrawing(false)
    }
  }

  // null = sin guardado local en esta sesión; se muestra el valor del servidor
  // (que llega async — un useState inicial quedaría vacío).
  const [waSaved, setWaSaved] = useState<string | null>(null)
  const waUrl = waSaved ?? group?.whatsapp_group_url ?? ''
  const [waInput, setWaInput] = useState('')
  const [waSaving, setWaSaving] = useState(false)
  const [waError, setWaError] = useState(false)

  async function saveWhatsappUrl() {
    if (!waInput.trim() || waSaving) return
    setWaSaving(true)
    setWaError(false)
    try {
      const res = await fetch(`/api/studies/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_group_url: waInput.trim() }),
      })
      if (!res.ok) throw new Error()
      setWaSaved(waInput.trim())
      setWaInput('')
    } catch {
      setWaError(true)
    } finally {
      setWaSaving(false)
    }
  }
  const [sessions, setSessions] = useState<Array<{ id: string; date: string; topic: string | null; present: number; total: number }>>([])

  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/studies/groups/${id}/sessions`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) setSessions(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setSessions([]) })
    return () => { alive = false }
  }, [id])

  if (loading) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/80">Cargando…</p>
      </div>
    )
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

  const studyType = studyTypes.find(s => s.id === group.study_type_id) ?? null
  const enrolled = group.participants.filter(p => p.status !== 'withdrawn')
  // GRU-3: ¿llegó contacto? Solo llega si quien mira gestiona el grupo.
  const hayContactoDirigente = Boolean(
    group.leader_phone || group.leader_email || group.co_leader_phone || group.co_leader_email,
  )
  const tabs = ['información', 'participantes', 'asistencia', 'comunicaciones']
  const tabLabels: Record<string, string> = {
    participantes: 'Participantes',
    asistencia: 'Asistencia',
    comunicaciones: 'Comunicaciones',
    información: 'Información',
  }

  return (
    <div className="space-y-5">
      {/* AUD-1 · Encabezado para lectores de pantalla: esta pantalla no
          tiene un título visible (se identifica por la barra superior y las
          insignias), y sin <h1> no hay punto de entrada para orientarse. */}
      <h1 className="sr-only">{group.name ?? 'Detalle del grupo'}</h1>
      {showAddMember && (
        <AddMemberModal
          groupId={id}
          studyName={studyType?.name ?? group?.study_type_id ?? 'el estudio'}
          enrolledIds={new Set((group?.participants ?? []).map(p => p.member_id))}
          onClose={() => setShowAddMember(false)}
          onEnrolled={refetch}
        />
      )}
      {withdrawTarget && (
        <Modal onClose={() => setWithdrawTarget(null)} titleId="desinscribir-titulo" width={400}>
          <div className="p-5 space-y-4">
            <h3 id="desinscribir-titulo" className="font-semibold text-navy font-display">Desinscribir participante</h3>
            <p className="text-sm text-navy-light/80 font-body">
              ¿Desinscribir a <strong>{withdrawTarget.member_name}</strong> de este grupo?
              Quedará como retirado y conservará su historial.
            </p>
            <div>
              <label htmlFor="withdraw-reason" className="block text-[13px] font-medium text-coral font-body mb-1">
                Motivo del retiro <span aria-hidden>*</span>
              </label>
              <textarea
                id="withdraw-reason"
                rows={2}
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                placeholder="Ej.: se mudó de zona, cambió de horario de trabajo, motivos de salud…"
                aria-required="true"
                aria-invalid={!!motivoInvalido && withdrawReason.length > 0 ? true : undefined}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none placeholder:text-navy-light/80"
              />
              {/* La razón por la que no se puede seguir, visible antes de
                  apretar: un botón gris sin explicación es una pared. */}
              {motivoInvalido && withdrawReason.length > 0 && (
                <p className="mt-1 text-[13px] text-coral font-body">{motivoInvalido}</p>
              )}
            </div>
            {withdrawError && (
              <p className="text-sm text-coral font-body" role="alert">
                No se pudo desinscribir. Intentá de nuevo.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmWithdraw}
                disabled={withdrawing || !!motivoInvalido}
                className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
              >
                {withdrawing ? 'Desinscribiendo…' : 'Desinscribir'}
              </button>
              <button
                onClick={() => setWithdrawTarget(null)}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      <DeleteConfirmModal
        open={deleteOpen}
        title="Eliminar grupo"
        description={`Vas a eliminar el grupo "${group.name ?? ''}". Esta acción no se puede deshacer. Escribí "eliminar" para confirmar.`}
        loading={deleting}
        onConfirm={confirmDeleteGroup}
        onCancel={() => setDeleteOpen(false)}
      />
      <ActiveWarningModal
        open={!!activeWarn}
        title="No se puede eliminar el grupo"
        message={activeWarn ?? ''}
        onClose={() => setActiveWarn(null)}
      />

      {showSendMessage && (
        <SendMessageModal
          groupName={group.name ?? 'de estudio'}
          memberIds={[...new Set(enrolled.map(p => p.member_id).filter((m): m is string => Boolean(m)))]}
          onClose={() => setShowSendMessage(false)}
        />
      )}

      {/* Back */}
      <Link
        href="/estudios/grupos"
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Grupos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StudyTypeBadge code={group.study_type_id} name={studyType?.name} size="md" />
              <GroupStatusBadge status={group.status} />
              {group.is_leader_training && <LeaderTrainingBadge modality={group.training_modality} />}
              {group.is_virtual && <VirtualGroupBadge />}
              {!group.leader_id && group.status !== 'finalizado' && <NoLeaderBadge />}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-navy-light/80 font-body">
              {/* GRU-3: con contacto, el nombre se muestra en LeaderContact
                  (abajo) junto al teléfono y el correo — no dos veces. */}
              {!hayContactoDirigente && (
                <>
                  <span>Dirigente: <strong className="text-navy">{group.leader_name ?? 'Sin asignar'}</strong></span>
                  {group.co_leader_name && (
                    <span>Co-dirigente: <strong className="text-navy">{group.co_leader_name}</strong></span>
                  )}
                </>
              )}
              <span>Zona: <strong className="text-navy">{sedeLabel(group.zone)}</strong></span>
              <span>Horario: <strong className="text-navy">{group.schedule_days.join('/')} {group.schedule_time}</strong></span>
            </div>

            {/* GRU-3 · Contacto accionable del dirigente y del co-dirigente.
                Datos personales: el API solo los manda a quien gestiona el grupo. */}
            <LeaderContact personas={[
              { rol: 'Dirigente', nombre: group.leader_name, phone: group.leader_phone, email: group.leader_email },
              { rol: 'Co-dirigente', nombre: group.co_leader_name ?? null, phone: group.co_leader_phone, email: group.co_leader_email },
            ]} />
            {/* Retroalimentación: solo tiene sentido con el grupo cerrado. El
                panel decide qué mostrar según quién mira. */}
            {group.status === 'finalizado' && !readOnly && (
              <div className="pt-1"><LeaderFeedbackPanel groupId={group.id} /></div>
            )}
            {/* GRU-2: a quién se le ofrece este grupo. Solo se pinta si hay
                restricción — un grupo abierto no necesita decir nada. */}
            {group.has_restriction && <GroupRestrictionNote groupId={group.id} />}
            {studyType && group.current_week > 0 && group.status !== 'finalizado' && (
              <WeekProgressBar current={group.current_week} total={studyType.weeks} className="w-48" />
            )}
          </div>
          {(canManageGroups || group.viewer_scope === 'leader') && (
            <div className="flex gap-2">
              {/* El cierre también es del DIRIGENTE del grupo (2026-08-20);
                  editar/eliminar siguen siendo solo de gestión. */}
              {group.status === 'en_curso' && (
                <Link
                  href={`/estudios/grupos/${id}/cierre`}
                  className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
                >
                  Cierre de estudio
                </Link>
              )}
              {canManageGroups && (<>
              <Link
                href={`/estudios/grupos/${id}/editar`}
                className="rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors flex items-center border-[var(--outline-variant)] font-body"
                aria-label="Editar grupo"
              >
                <Edit2 size={14} />
              </Link>
              <button
                onClick={() => setDeleteOpen(true)}
                className="rounded-xl border px-3.5 py-2 text-sm text-coral hover:bg-coral/10 transition-colors flex items-center border-coral/30 font-body"
                aria-label="Eliminar grupo"
              >
                <Trash2 size={14} />
              </button>
              </>)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--outline-variant)] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm transition-all border-b-2 -mb-px shrink-0 whitespace-nowrap',
              activeTab === t
                ? 'border-coral text-coral font-medium'
                : 'border-transparent text-navy-light/80 hover:text-navy',
              'font-body',
            )}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Tab: Participantes */}
      {activeTab === 'participantes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/80 font-body">
              {enrolled.length} inscritos de {group.max_capacity} lugares
            </p>
            {/* REU-2 · Para el estudiante que abre SU grupo y se da cuenta de
                que se matriculó en el equivocado. El flujo ya existía enterrado
                en una pestaña del perfil; acá está donde se necesita. */}
            {readOnly && actor?.member_id && (
              <StudyRequestActions memberId={actor.member_id} only="relocation" variant="link" />
            )}
            {/* Matricular a OTRA persona es de los perfiles de estudios, no del
                dirigente (decisión 2026-08-27). Y no era solo un botón de más:
                sin STUDY_ADMIN_ROLES, resolveOnBehalf IGNORA el member_id que se
                manda y se queda con el del actor — así que el dirigente elegía a
                alguien y el servidor lo matriculaba a ÉL, sin error. */}
            {canManageGroups && (
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[13px] text-white hover:bg-coral-deep transition-colors"
            >
              <Plus size={12} /> Añadir miembro
            </button>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)] overflow-x-auto">
            <table className="w-full border-collapse min-w-[480px]">
              <thead>
                <tr>
                  {['Nombre', 'Estado', 'Asistencia', studyType?.requires_grade ? 'Nota' : '', 'Acciones'].filter(Boolean).map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.participants.map(p => (
                  <tr
                    key={p.member_id}
                    className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy">
                          {getInitials(p.member_name)}
                        </div>
                        <span className="text-sm text-navy font-body">
                          {p.member_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {group.status === 'finalizado' ? (
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-medium',
                          p.status === 'withdrawn' ? 'bg-surface-low text-navy-light/80'
                            : p.result === 'reprobado' ? 'bg-coral/15 text-coral'
                            : 'bg-teal-soft/30 text-teal-deep'
                        )}>
                          {p.status === 'withdrawn' ? 'Retirado' : p.result === 'reprobado' ? 'Reprobó' : 'Aprobado'}
                        </span>
                      ) : (
                        <span className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-medium',
                          p.status === 'enrolled' ? 'bg-teal-soft/30 text-teal-deep' :
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-surface-low text-navy-light/80'
                        )}>
                          {p.status === 'enrolled' ? 'Inscrito' : p.status === 'pending' ? 'Pendiente' : 'Retirado'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBar pct={p.attendance_pct} />
                    </td>
                    {studyType?.requires_grade && (
                      <td className="px-4 py-3 text-sm text-navy-light/80 font-body">
                        {p.grade ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Inscripción que quedó sin resultado al cerrarse el
                            grupo. Solo lo ven los roles que pueden resolverla. */}
                        {p.status === 'en_revision' && (
                          <ResolverInscripcion
                            groupId={id}
                            memberId={p.member_id}
                            memberName={p.member_name}
                            onResuelto={() => refetch()}
                          />
                        )}
                        {!readOnly && group.status !== 'finalizado' && p.status !== 'withdrawn' && (
                          <button
                            onClick={() => { setWithdrawError(false); setWithdrawReason(''); setWithdrawTarget({ member_id: p.member_id, member_name: p.member_name }) }}
                            className="rounded-lg px-2 py-1 text-[11px] text-coral border border-coral/20 hover:bg-coral/5 transition-colors font-body"
                          >
                            Desinscribir
                          </button>
                        )}
                        {!readOnly && (
                        <Link
                          href={`/miembros/${p.member_id}`}
                          className="rounded-lg px-2 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                        >
                          Perfil
                        </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WhatsApp section */}
          <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <h3
              className="text-[11px] tracking-widest uppercase text-navy-light/80 mb-3 font-display"
            >
              Grupo de WhatsApp
            </h3>
            {waUrl ? (
              <div className="flex items-center gap-3">
                <MessageCircle size={16} className="text-teal-deep" />
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-teal-deep hover:underline font-body">
                  Ver grupo de WhatsApp
                </a>
              </div>
            ) : group.status === 'finalizado' || readOnly ? (
              <p className="text-sm text-navy-light/80 font-body">
                {group.status === 'finalizado' ? 'Grupo finalizado — sin grupo de WhatsApp.' : 'Sin grupo de WhatsApp todavía.'}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-navy-light/80 font-body">
                  Crea el grupo en WhatsApp y pega el link de invitación aquí.
                </p>
                <div className="flex gap-2">
                  <input
                    aria-label="Link de invitación de WhatsApp"
                    className="flex-1 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                    placeholder="https://chat.whatsapp.com/..."
                    value={waInput}
                    onChange={e => setWaInput(e.target.value)}
                  />
                  <button
                    onClick={saveWhatsappUrl}
                    disabled={!waInput.trim() || waSaving}
                    className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
                  >
                    {waSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {waError && (
                  <p className="text-sm text-coral font-body" role="alert">
                    No se pudo guardar el link. Intentá de nuevo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Asistencia */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/estudios/grupos/${id}/asistencia`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            >
              <Users size={14} /> Pasar lista hoy
            </Link>
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)] overflow-x-auto">
            {sessions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-navy-light/80 font-body">
                  No tenemos asistencia registrada para este grupo.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Sesión', 'Fecha', 'Asistencia'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr
                      key={s.id}
                      className="hover:bg-surface-low transition-colors border-b border-[var(--outline-variant)]"
                    >
                      <td className="px-4 py-3 text-sm text-navy font-body">
                        Sesión {i + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/80 font-body">
                        {new Date(s.date).toLocaleDateString('es-CR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy font-body">
                        {s.present}/{s.total} presentes
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Comunicaciones */}
      {activeTab === 'comunicaciones' && (
        <div className="space-y-4">
          {canSendMessage && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowSendMessage(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
              >
                <Send size={14} /> Enviar mensaje
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
            <EmptyState
              icon={MessageCircle}
              title={canSendMessage
                ? 'Los mensajes enviados desde acá quedan registrados en el módulo de Comunicaciones'
                : 'El envío de mensajes requiere el rol de comunicaciones'}
            />
          </div>
        </div>
      )}

      {/* Tab: Información */}
      {activeTab === 'información' && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tipo de estudio', value: `${group.study_type_id} — ${studyType?.name}` },
              { label: 'Zona', value: sedeLabel(group.zone) },
              { label: 'Días', value: group.schedule_days.join(', ') },
              { label: 'Horario', value: group.schedule_time },
              { label: 'Ubicación', value: group.location },
              { label: 'Capacidad máxima', value: `${group.max_capacity} personas` },
              { label: 'Fecha de inicio', value: group.start_date },
              { label: 'Fecha de cierre', value: group.end_date ?? '—' },
              { label: 'Semana actual', value: group.status === 'finalizado' ? 'N/A' : `${group.current_week} de ${studyType?.weeks ?? '?'}` },
              { label: 'Dirigente', value: group.leader_name ?? 'Sin asignar' },
              { label: 'Co-dirigente', value: group.co_leader_name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p
                  className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
                >
                  {label}
                </p>
                <p className="text-sm text-navy font-body">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Cambiar dirigente también es de estudios: un dirigente no se
              reasigna su propio grupo. Además el link lleva a /editar, que ya
              exige el permiso — así que al dirigente lo mandaba a una pantalla
              donde no puede hacer nada. */}
          {canManageGroups && group.status !== 'finalizado' && (
            <div className="flex gap-2 pt-2 border-t border-[var(--outline-variant)]">
              <Link
                href={`/estudios/grupos/${id}/editar`}
                className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
              >
                Cambiar dirigente
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
