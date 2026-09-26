import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * RET-1 parte 4 · Cuando una retroalimentación se manda A REVISIÓN, el comité
 * se entera.
 *
 * El estado `escalated` ya existía y el tablero ya tenía el botón «Escalar»,
 * pero NO AVISABA A NADIE: la retro quedaba marcada y ahí se quedaba hasta que
 * alguien entrara a mirar la cola por su cuenta. Para el caso que motiva esto
 * —una respuesta delicada que hay que ver pronto— eso es lo mismo que no tener
 * el botón.
 *
 * ESCALAR NO COMPARTE. Es justamente la alternativa a compartir: el dirigente
 * no se entera de nada, y por eso el aviso va SOLO hacia adentro.
 *
 * VA A `coordinador_dirigentes` y no a los roles que LEEN la retro
 * (`EVALUATION_ROLES`): escalar es pedirle una decisión al comité, y quien
 * escala normalmente ya es de los que la leen — avisarse a uno mismo no es un
 * aviso. Dirección quedó fuera a propósito: se la excluyó de `EVALUATION_ROLES`
 * cuando se definió el acceso, así que notificarle algo que no puede abrir
 * sería mandarla a una pared. Si se quiere sumar, es una decisión de producto y
 * una línea acá.
 *
 * Best-effort: si el aviso falla, el tiquete IGUAL queda escalado. Perder el
 * cambio de estado por un problema de correo sería peor que perder el correo.
 */
export async function notificarEscalacion(input: {
  groupId: string
  /** Nombre del grupo, para que el aviso se entienda sin abrirlo. */
  groupName: string | null
  /** El dirigente evaluado. */
  leaderName: string | null
  /** Quién escaló, para no avisarle a sí mismo. */
  actorMemberId: string | null
  /** La nota que dejó quien escaló, si dejó alguna. */
  notas?: string | null
}): Promise<number> {
  const supabase = createAdminClient()

  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .eq('role', 'coordinador_dirigentes')
    .eq('is_active', true)

  const destinatarios = [...new Set(((roleRows ?? []) as unknown as Array<{
    member_id: string
    member: { is_active: boolean } | { is_active: boolean }[] | null
  }>)
    .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
    .map(r => r.member_id))]
    // Quien escaló ya sabe: recibir su propio aviso solo entrena a ignorarlos.
    .filter(id => id !== input.actorMemberId)

  if (destinatarios.length === 0) return 0

  const grupo = input.groupName ?? 'un grupo'
  const dirigente = input.leaderName ? ` de ${input.leaderName}` : ''

  const { error } = await supabase.from('internal_notifications').insert(
    destinatarios.map(memberId => ({
      recipient_member_id: memberId,
      type: 'evaluation_escalated',
      title: `Retroalimentación a revisión: ${grupo}`,
      // El aviso NO lleva el contenido de la respuesta. Quien tenga que leerla
      // entra por el link; una notificación se reenvía y se lee por encima del
      // hombro, y esto es justo lo que se acaba de cerrar con llave.
      body: `Se mandó a revisión la retroalimentación${dirigente} del grupo ${grupo}.`
        + (input.notas?.trim() ? ` Nota de quien escaló: ${input.notas.trim()}` : ''),
      link: '/estudios/evaluaciones',
    })),
  )
  if (error) { console.warn('aviso de escalación:', error.message); return 0 }
  return destinatarios.length
}
