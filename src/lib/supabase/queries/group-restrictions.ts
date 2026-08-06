// GRU-2 · Lectura y evaluación de la restricción de audiencia de un grupo.
//
// La REGLA es pura y vive en @/lib/studies/group-restrictions; acá está lo que
// toca la base. Todo pasa por getMemberIds —el mismo motor del filtro avanzado
// del padrón— así que no hay una segunda implementación que se desincronice:
//  · "¿esta persona cumple?"  → getMemberIds con el universo acotado a su id.
//  · "¿cuánta gente cumple?"  → el mismo llamado sin acotar.
import { createAdminClient } from '@/lib/supabase/admin'
import { getMemberIds } from '@/lib/supabase/queries/members'
import {
  normalizeRestriction, hasRestriction, type GroupRestriction,
} from '@/lib/studies/group-restrictions'

/** La restricción de UN grupo, ya normalizada. null = grupo abierto. */
export async function getGroupRestriction(groupId: string): Promise<GroupRestriction | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_groups').select('enrollment_restrictions').eq('id', groupId).maybeSingle()
  return normalizeRestriction((data as { enrollment_restrictions?: unknown } | null)?.enrollment_restrictions)
}

/** ¿Esta persona cumple la restricción? Sin restricción, siempre sí. */
export async function memberPassesRestriction(
  memberId: string,
  restriction: GroupRestriction | null | undefined,
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
 *  cuando nadie se matriculó. */
export async function countMembersMatchingRestriction(
  restriction: GroupRestriction | null | undefined,
): Promise<number | null> {
  if (!hasRestriction(restriction)) return null
  const { total } = await getMemberIds({
    conditions: restriction!.conditions,
    groups: restriction!.groups,
    topLevelOps: restriction!.ops,
  })
  return total
}

/** De una lista de grupos, cuáles PUEDE tomar esta persona por su restricción.
 *  Devuelve solo los ids de grupos RESTRINGIDOS que la persona sí cumple — los
 *  grupos abiertos no necesitan permiso y no vienen acá.
 *
 *  Dos grupos con la misma restricción se evalúan UNA vez: en la matrícula es
 *  común que toda una tanda de grupos comparta la misma ("solo dirigentes"). */
export async function passedRestrictedGroupIds(
  memberId: string,
  groups: Array<{ id: string; enrollment_restrictions?: unknown }>,
): Promise<Set<string>> {
  const porFirma = new Map<string, { restriction: GroupRestriction; groupIds: string[] }>()
  for (const g of groups) {
    const r = normalizeRestriction(g.enrollment_restrictions)
    if (!hasRestriction(r)) continue
    const firma = JSON.stringify(r)
    const entry = porFirma.get(firma)
    if (entry) entry.groupIds.push(g.id)
    else porFirma.set(firma, { restriction: r!, groupIds: [g.id] })
  }

  const ok = new Set<string>()
  for (const { restriction, groupIds } of porFirma.values()) {
    if (await memberPassesRestriction(memberId, restriction)) {
      for (const id of groupIds) ok.add(id)
    }
  }
  return ok
}
