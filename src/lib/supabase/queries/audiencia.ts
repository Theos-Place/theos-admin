// Evaluar una restricción de audiencia contra el padrón.
//
// La REGLA es pura y vive en @/lib/audiencia/restriccion; acá está lo que toca
// la base. Todo pasa por getMemberIds —el mismo motor del filtro avanzado del
// padrón— así que no hay una segunda implementación que se desincronice:
//  · "¿esta persona cumple?"  → getMemberIds con el universo acotado a su id.
//  · "¿cuánta gente cumple?"  → el mismo llamado sin acotar.
//
// Nació con GRU-2 para los grupos de estudio; FRM-5 lo reusa para decidir quién
// ve y quién puede responder un formulario.
import { getMemberIds } from '@/lib/supabase/queries/members'
import { hasRestriction, type Restriccion } from '@/lib/audiencia/restriccion'

/** ¿Esta persona cumple la restricción? Sin restricción, siempre sí. */
export async function memberPassesRestriction(
  memberId: string,
  restriction: Restriccion | null | undefined,
): Promise<boolean> {
  if (!hasRestriction(restriction)) return true
  const { ids } = await getMemberIds({
    conditions: restriction!.conditions,
    groups: restriction!.groups,
    topLevelOps: restriction!.ops,
    ids: [memberId],
    // La restricción describe a la PERSONA, no al estado de su ficha: si alguien
    // con ficha inactiva llega hasta acá, que lo frene el guard que corresponde.
    any_active: true,
  })
  return ids.length > 0
}

/** Cuánta gente ACTIVA del padrón cumple la restricción. Es el número que se
 *  muestra al armarla: una condición demasiado estrecha se ve al instante, no
 *  cuando ya nadie pudo entrar. */
export async function countMembersMatchingRestriction(
  restriction: Restriccion | null | undefined,
): Promise<number | null> {
  if (!hasRestriction(restriction)) return null
  const { total } = await getMemberIds({
    conditions: restriction!.conditions,
    groups: restriction!.groups,
    topLevelOps: restriction!.ops,
  })
  return total
}
