// GRU-2 · Lectura de la restricción de audiencia de un GRUPO.
//
// Evaluar una restricción no es de acá: eso lo hace
// @/lib/supabase/queries/audiencia, compartido con los formularios. Se
// re-exporta para no tocar a los callers del grupo.
import { createAdminClient } from '@/lib/supabase/admin'
import {
  normalizeRestriction, hasRestriction, type GroupRestriction,
} from '@/lib/studies/group-restrictions'
import { memberPassesRestriction } from '@/lib/supabase/queries/audiencia'

export { memberPassesRestriction, countMembersMatchingRestriction } from '@/lib/supabase/queries/audiencia'

/** La restricción de UN grupo, ya normalizada. null = grupo abierto. */
export async function getGroupRestriction(groupId: string): Promise<GroupRestriction | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_groups').select('enrollment_restrictions').eq('id', groupId).maybeSingle()
  return normalizeRestriction((data as { enrollment_restrictions?: unknown } | null)?.enrollment_restrictions)
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
