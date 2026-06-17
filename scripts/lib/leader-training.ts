/**
 * Lógica compartida de GRUPOS DE CAPACITACIÓN DE DIRIGENTES (is_leader_training).
 * La usan el reseed de grupos (precampaña 2025 → Transformados) y el seed de
 * campañas (Capacitación de Dirigentes 2019 → ¿Para qué estoy aquí?). Patrón
 * común: los participantes COMPLETAN y, al completar, quedan CAPACITADOS para
 * DAR ese estudio (se registra en study_leaders.qualified_study_codes).
 */
import type { createClient } from '@supabase/supabase-js'
type SB = ReturnType<typeof createClient>

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Grupo de capacitación de dirigentes detectado por nombre: "Precampaña" (2025
 *  y futuros) = Transformados para dirigentes. Variantes: precampaña / pre campaña
 *  / pre-campaña, case- y tilde-insensitive. */
export function isPrecampana(name: string): boolean {
  return /pre[\s-]?campan/i.test(stripAccents(name))
}

/** Registra (idempotente) que cada `memberId` quedó capacitado para dar `planCode`:
 *  hace merge en study_leaders.qualified_study_codes y crea la designación
 *  (inactiva) si la persona aún no es dirigente. Preserva is_active/zona/otros
 *  códigos existentes. Con dryRun no escribe; solo cuenta. */
export async function qualifyLeadersForStudy(
  supabase: SB, memberIds: string[], planCode: string, dryRun: boolean,
): Promise<{ nuevos: number; actualizados: number; yaCapacitados: number; errores: number }> {
  const ids = [...new Set(memberIds)]
  if (!ids.length) return { nuevos: 0, actualizados: 0, yaCapacitados: 0, errores: 0 }

  const existing = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 300) {
    const slice = ids.slice(i, i + 300)
    const { data, error } = await supabase.from('study_leaders').select('member_id, qualified_study_codes').in('member_id', slice)
    if (error) throw error
    for (const r of data as Array<{ member_id: string; qualified_study_codes: string[] | null }>) existing.set(r.member_id, r.qualified_study_codes ?? [])
  }

  const toInsert: string[] = []
  const toUpdate: Array<{ id: string; codes: string[] }> = []
  let yaCapacitados = 0
  for (const mid of ids) {
    const codes = existing.get(mid)
    if (codes === undefined) toInsert.push(mid)
    else if (!codes.includes(planCode)) toUpdate.push({ id: mid, codes: [...new Set([...codes, planCode])] })
    else yaCapacitados++
  }

  if (dryRun) return { nuevos: toInsert.length, actualizados: toUpdate.length, yaCapacitados, errores: 0 }

  let nuevos = 0, actualizados = 0, errores = 0
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200).map(mid => ({
      member_id: mid, is_active: false, availability_status: 'inactive', zone_preference: [], qualified_study_codes: [planCode],
    }))
    const { error } = await supabase.from('study_leaders').insert(batch)
    if (error) { errores += batch.length; console.error(`✗ study_leaders insert: ${error.message} — continuando…`); continue }
    nuevos += batch.length
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from('study_leaders').update({ qualified_study_codes: u.codes }).eq('member_id', u.id)
    if (error) { errores++; console.error(`✗ study_leaders update: ${error.message} — continuando…`); continue }
    actualizados++
  }
  return { nuevos, actualizados, yaCapacitados, errores }
}
