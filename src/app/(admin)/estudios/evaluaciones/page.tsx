'use client'

/**
 * DIR-5 · Cola de evaluaciones del dirigente.
 *
 * Un tiquete por grupo. Antes esta revisión existía (el panel del detalle del
 * grupo, EST-13) pero había que entrar grupo por grupo para saber si había algo
 * que revisar. Acá se ve todo junto y con estado.
 *
 * Lo que NO hace, a propósito: mostrar quién dijo qué. La lista de participación
 * dice quiénes contestaron; el compilado dice qué se contestó. Nunca lo mismo.
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Lock, Loader2, ExternalLink, Send, Users, Link2, Check, Clock,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/shared/Toast'
import { RequestBoard } from '@/components/shared/RequestBoard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import { MIN_RESPUESTAS_PARA_MOSTRAR } from '@/lib/studies/leader-feedback'
import { formatDate } from '@/lib/format'
import type { EvaluationTicket, EvaluationParticipant } from '@/types/evaluations'

const TABS = [{ key: 'leader_evaluation', label: 'Evaluaciones' }]
const TYPE_LABEL: Record<string, string> = { leader_evaluation: 'Evaluación' }

/** Detalle de un tiquete: números, ventana, participación y el envío. */
function TicketDetail({
  t, onUpdated,
}: {
  t: EvaluationTicket
  onUpdated: (updated: EvaluationTicket) => void
}) {
  const toast = useToast()
  const [participants, setParticipants] = useState<EvaluationParticipant[] | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const encuestaUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/estudios/grupos/${t.group_id}/evaluar`

  useEffect(() => {
    if (!showParticipants || participants) return
    let alive = true
    fetch(`/api/evaluations/tickets/${t.id}/participants`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) setParticipants(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setParticipants([]) })
    return () => { alive = false }
  }, [showParticipants, participants, t.id])

  async function enviar() {
    setSending(true)
    try {
      const res = await fetch(`/api/evaluations/tickets/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo enviar')
      onUpdated(body as EvaluationTicket)
      toast(`Resumen enviado (${body?.sent ?? 0} destinatario${body?.sent === 1 ? '' : 's'})`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo enviar', 'error')
    } finally {
      setSending(false)
    }
  }

  const tasa = t.expected > 0 ? Math.round((t.responses / t.expected) * 100) : null
  const pocas = t.responses < MIN_RESPUESTAS_PARA_MOSTRAR

  return (
    <div className="space-y-3">
      {/* Grupo y números */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-navy/6 px-3 py-1 text-[13px] text-navy font-body">
          {t.plan_name ?? 'Sin plan'}{t.group_name ? ` · ${t.group_name}` : ''}
        </span>
        <span className="rounded-full bg-navy/6 px-3 py-1 text-[13px] text-navy font-body">
          {t.responses} de {t.expected} respondieron
          {tasa !== null ? ` (${tasa}%)` : ''}
        </span>
        {t.co_leader_name && (
          <span className="rounded-full bg-navy/6 px-3 py-1 text-[13px] text-navy font-body">
            Co-dirigente: {t.co_leader_name}
          </span>
        )}
      </div>

      {/* Ventana */}
      <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
        <Clock size={13} aria-hidden="true" />
        {t.window_status === 'abierta'
          ? `Se aceptan respuestas ${t.days_left} día${t.days_left === 1 ? '' : 's'} más.`
          : t.window_status === 'cerrada'
            ? 'El período de respuestas ya cerró.'
            : 'A este grupo todavía no se le pidió la evaluación.'}
      </p>

      {pocas && (
        <p className="rounded-xl bg-[rgba(233,185,73,0.12)] px-3 py-2 text-[13px] text-[#A8821F] font-body">
          Con menos de {MIN_RESPUESTAS_PARA_MOSTRAR} respuestas, al dirigente no se le muestran
          los comentarios: con tan pocas, quién los escribió deja de ser anónimo.
        </p>
      )}

      {/* Acciones sobre el compilado */}
      <div className="flex flex-wrap gap-2 items-center">
        <Link
          href={`/estudios/grupos/${t.group_id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Ver el compilado
        </Link>

        <button
          type="button"
          onClick={() => setShowParticipants(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors"
        >
          <Users size={13} aria-hidden="true" />
          {showParticipants ? 'Ocultar participación' : 'Quién contestó'}
        </button>

        {/* El link de la encuesta, para reenviárselo a quien falta. Es por
            grupo: el dirigente y el estudio salen de la ruta, no se preguntan. */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(encuestaUrl).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 2000) },
              () => toast('No se pudo copiar el enlace', 'error'),
            )
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 px-4 py-1.5 text-[13px] text-navy font-body hover:bg-navy/5 transition-colors"
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar enlace de la encuesta'}
        </button>

        <button
          type="button"
          onClick={enviar}
          disabled={sending || t.responses === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-1.5 text-[13px] text-white font-body hover:bg-navy-ink transition-colors disabled:opacity-60"
        >
          {sending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
          {t.sent_at ? 'Reenviar al dirigente' : 'Enviar al dirigente'}
        </button>
      </div>

      {t.sent_at && (
        <p className="text-[13px] text-navy-light/80 font-body">
          Enviado el {formatDate(t.sent_at)}{t.sent_by_name ? ` por ${t.sent_by_name}` : ''}.
        </p>
      )}

      {/* Participación: nombres SIN respuestas. Nunca se cruzan. */}
      {showParticipants && (
        <div className="rounded-xl bg-surface-low px-3 py-2.5">
          {participants === null ? (
            <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Cargando…
            </p>
          ) : participants.length === 0 ? (
            <p className="text-[13px] text-navy-light/80 font-body">
              No hay matriculados registrados en este grupo.
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body mb-1.5">
                Quiénes contestaron — sin sus respuestas
              </p>
              <ul className="space-y-0.5">
                {participants.map(p => (
                  <li key={p.member_id} className="flex items-center gap-1.5 text-[13px] font-body">
                    {p.responded
                      ? <Check size={13} className="text-success shrink-0" aria-hidden="true" />
                      : <span className="w-[13px] shrink-0" aria-hidden="true" />}
                    <span className={p.responded ? 'text-navy' : 'text-navy-light/80'}>
                      {p.member_name}
                    </span>
                    <span className="sr-only">{p.responded ? 'contestó' : 'no contestó'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function EvaluacionesPage() {
  const { user, loaded, hasRole } = useAuth()
  const [tickets, setTickets] = useState<EvaluationTicket[]>([])
  const [loading, setLoading] = useState(true)

  const allowed = hasRole(...EVALUATION_ROLES)

  useEffect(() => {
    if (!allowed) return
    let alive = true
    fetch('/api/evaluations/tickets')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setTickets(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) { setTickets([]); setLoading(false) } })
    return () => { alive = false }
  }, [allowed])

  const onUpdated = useCallback((updated: EvaluationTicket) => {
    setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)))
  }, [])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-navy-light/80" />
      </div>
    )
  }

  if (user && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/6 mb-4">
          <Lock size={22} className="text-navy-light/80" />
        </div>
        <p className="text-base font-semibold text-navy font-display mb-1">Acceso restringido</p>
        <p className="text-sm text-navy-light/80 font-body max-w-sm">
          Las evaluaciones de dirigentes son material sensible: solo entra el comité
          de evaluaciones y la coordinación de dirigentes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-navy px-6 py-5 shadow-card">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Evaluaciones de dirigentes
        </h1>
        <p className="mt-1 text-sm text-white/80 font-body">
          Un tiquete por grupo. Se revisa el compilado acá antes de que le llegue al dirigente.
        </p>
      </div>

      <RequestBoard
        requests={tickets}
        loading={loading}
        tabs={TABS}
        typeLabel={TYPE_LABEL}
        endpointBase="/api/evaluations/tickets"
        assigneesUrl="/api/evaluations/tickets/assignees"
        allowEscalate
        onUpdated={onUpdated}
        closeBlockedReason={t =>
          t.window_status === 'abierta'
            ? `Se puede cerrar en ${t.days_left} día${t.days_left === 1 ? '' : 's'}, cuando venza el plazo de respuestas.`
            : null}
        renderDetails={t => <TicketDetail t={t} onUpdated={onUpdated} />}
      />
    </div>
  )
}
