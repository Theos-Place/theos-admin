import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resumenDeEvaluaciones, type TiqueteParaElResumen } from '@/lib/studies/digest-de-evaluaciones'

/**
 * RET-1 parte 6 · Manda el resumen quincenal de lo que espera revisión.
 *
 * QUIÉN LO RECIBE: `evaluaciones` y `coordinador_dirigentes` — quienes hacen el
 * trabajo. `admin` queda fuera aunque también pueda leer las respuestas: son
 * cuentas de sistema, y meterlas en un recordatorio operativo es la forma de
 * que el recordatorio se vuelva ruido.
 *
 * La decisión de SI HAY ALGO QUE DECIR vive en la regla pura
 * `resumenDeEvaluaciones`, que devuelve `null` cuando no hay pendientes. Acá no
 * se decide nada de eso: si la regla no dice nada, no se manda nada.
 */
export async function enviarResumenDeEvaluaciones(hoy = new Date()): Promise<{
  pendientes: number
  avisados: number
}> {
  const supabase = createAdminClient()

  // Solo lo que sigue esperando: `resolved` y `rejected` ya se atendieron.
  const { data: tickets, error } = await supabase
    .from('evaluation_tickets')
    .select('group_id, status, created_at')
    .in('status', ['open', 'in_review', 'escalated'])
  if (error) throw error

  const filas = (tickets ?? []) as Array<{ group_id: string; status: string; created_at: string }>
  if (filas.length === 0) return { pendientes: 0, avisados: 0 }

  // Cuántas respuestas tiene cada grupo, en UNA consulta: una por tiquete
  // serían ocho hoy y cuarenta el año que viene.
  const { data: evals } = await supabase
    .from('leader_evaluations')
    .select('group_id')
    .in('group_id', filas.map(f => f.group_id))
  const porGrupo = new Map<string, number>()
  for (const e of ((evals ?? []) as Array<{ group_id: string }>)) {
    porGrupo.set(e.group_id, (porGrupo.get(e.group_id) ?? 0) + 1)
  }

  const paraElResumen: TiqueteParaElResumen[] = filas.map(f => ({
    creado: f.created_at,
    respuestas: porGrupo.get(f.group_id) ?? 0,
    escalado: f.status === 'escalated',
  }))

  const resumen = resumenDeEvaluaciones(paraElResumen, hoy)
  if (!resumen) return { pendientes: 0, avisados: 0 }

  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['evaluaciones', 'coordinador_dirigentes'])
    .eq('is_active', true)

  const destinatarios = [...new Set(((roleRows ?? []) as unknown as Array<{
    member_id: string
    member: { is_active: boolean } | { is_active: boolean }[] | null
  }>)
    .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
    .map(r => r.member_id))]

  if (destinatarios.length === 0) return { pendientes: resumen.total, avisados: 0 }

  const { error: eIns } = await supabase.from('internal_notifications').insert(
    destinatarios.map(memberId => ({
      recipient_member_id: memberId,
      type: 'evaluation_digest',
      title: resumen.titulo,
      body: resumen.cuerpo,
      link: '/estudios/evaluaciones',
    })),
  )
  if (eIns) { console.warn('resumen de evaluaciones:', eIns.message); return { pendientes: resumen.total, avisados: 0 } }

  return { pendientes: resumen.total, avisados: destinatarios.length }
}
