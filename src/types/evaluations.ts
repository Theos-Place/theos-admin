// DIR-5 · Tiquete de evaluación del dirigente. Un tiquete por GRUPO.
import type { EvaluationWindowStatus } from '@/lib/studies/evaluation-window'

export type EvaluationTicketStatus =
  | 'open' | 'in_review' | 'escalated' | 'resolved' | 'rejected'

export type EvaluationTicketHistoryEntry = {
  from_status: EvaluationTicketStatus | null
  to_status: EvaluationTicketStatus
  notes: string | null
  changed_by_name: string | null
  created_at: string
}

export type EvaluationTicket = {
  id: string
  /** El tablero compartido pide member_id/member_name. Acá son los del
   *  DIRIGENTE: es a quien se está evaluando y por quien uno busca. */
  member_id: string
  member_name: string
  /** Un solo tipo, pero el tablero lo necesita para sus tabs. */
  request_type: 'leader_evaluation'
  reason: string | null
  status: EvaluationTicketStatus
  review_notes: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  history: EvaluationTicketHistoryEntry[]

  // ── Del grupo ──────────────────────────────────────────────────────────────
  group_id: string
  group_name: string | null
  plan_name: string | null
  co_leader_name: string | null

  // ── Participación (números, nunca quién dijo qué) ──────────────────────────
  /** Cuántas evaluaciones se recibieron. */
  responses: number
  /** Cuántas personas podían contestar (matriculadas, sin las que desertaron). */
  expected: number

  // ── Ventana ────────────────────────────────────────────────────────────────
  feedback_requested_at: string | null
  window_status: EvaluationWindowStatus
  days_left: number

  // ── Envío al dirigente (EST-13) ────────────────────────────────────────────
  released_at: string | null
  sent_at: string | null
  sent_by_name: string | null
}

/** Fila de la lista de participación. Deliberadamente NO trae respuestas:
 *  saber quién contestó es gestión; saber qué contestó cada quien rompe el
 *  anonimato que sostiene todo este proceso. */
export type EvaluationParticipant = {
  member_id: string
  member_name: string
  responded: boolean
}
