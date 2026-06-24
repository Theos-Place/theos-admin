// Mutaciones y utilidades de escritura de miembros (alta, edición, baja, fusión
// de duplicados, familia). Extraído de members.ts (auditoría 2026-06: archivos
// gigantes). Re-exportado por members.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
import type { DbMember } from './members'

/** Busca un miembro existente por cédula o correo (para evitar duplicados al crear).
 *  Dos .eq() separados en vez de .or(): .or() interpola el valor en la sintaxis
 *  de PostgREST, así que comas/paréntesis del input alteran el filtro. */
export async function findMemberByCedulaOrEmail(cedula: string | null, email: string | null) {
  if (!cedula && !email) return null
  const supabase = createAdminClient()
  const lookup = (col: 'cedula' | 'email', val: string) =>
    supabase.from('members').select('id').eq(col, val).limit(1).maybeSingle()

  const [byCedula, byEmail] = await Promise.all([
    cedula ? lookup('cedula', cedula) : null,
    email ? lookup('email', email) : null,
  ])
  if (byCedula?.error) throw byCedula.error
  if (byEmail?.error) throw byEmail.error
  return (byCedula?.data ?? byEmail?.data ?? null) as { id: string } | null
}

/** Fusiona dos miembros duplicados: reasigna todo lo de `dupId` a `keepId` y
 *  borra el duplicado. Corre la función transaccional `merge_members` en la BD. */
export async function mergeMembers(
  keepId: string,
  dupId: string,
  opts?: { fields?: Record<string, unknown>; soft?: boolean },
): Promise<void> {
  const supabase = createAdminClient()

  // 1) La FUSIÓN es lo crítico y atómico (RPC). Va PRIMERO: si falla, no se tocó
  //    nada. Solo este error es un fallo real de fusión que el front debe mostrar.
  const { error } = await supabase.rpc('merge_members', { keep_id: keepId, dup_id: dupId, soft: opts?.soft ?? false })
  if (error) throw error

  // 2) Valores elegidos campo-por-campo para el principal (cosmético, en una
  //    request aparte que no es transaccional con el RPC). La fusión YA ocurrió:
  //    si esto falla NO es un fallo de fusión — se loguea y se continúa, para no
  //    mostrarle al admin un "falló" cuando en realidad fusionó.
  if (opts?.fields && Object.keys(opts.fields).length > 0) {
    const { data: cur } = await supabase
      .from('members').select('field_updated_at').eq('id', keepId).maybeSingle()
    const now = new Date().toISOString()
    const stamp = { ...((cur as { field_updated_at?: Record<string, string> } | null)?.field_updated_at ?? {}) }
    for (const k of Object.keys(opts.fields)) stamp[k] = now
    const { error: uErr } = await supabase
      .from('members').update({ ...opts.fields, field_updated_at: stamp }).eq('id', keepId)
    if (uErr) console.error('mergeMembers: fusión OK, pero falló el update de campos del principal:', uErr.message)
  }
}

export type DuplicateMember = {
  id: string; first_name: string; last_name: string
  cedula: string | null; email: string | null; phone: string | null; created_at: string
  birth_date: string | null; province: string | null; canton: string | null
  occupation: string | null; photo_url: string | null
  field_updated_at: Record<string, string> | null
}
export type DuplicatePair = { a: DuplicateMember; b: DuplicateMember; reasons: string[] }

/** Pares de miembros probablemente duplicados (función find_duplicate_pairs). */
export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('find_duplicate_pairs')
  if (error) throw error
  const pairs = (data ?? []) as Array<{ member_a: string; member_b: string; reasons: string[] }>
  const ids = [...new Set(pairs.flatMap(p => [p.member_a, p.member_b]))]
  if (ids.length === 0) return []
  const { data: members, error: mErr } = await supabase
    .from('members').select('id, first_name, last_name, cedula, email, phone, created_at, birth_date, province, canton, occupation, photo_url, field_updated_at').in('id', ids)
  if (mErr) throw mErr
  const byId = new Map((members ?? []).map(m => [m.id, m as DuplicateMember]))
  return pairs
    .map(p => ({ a: byId.get(p.member_a), b: byId.get(p.member_b), reasons: p.reasons }))
    .filter((p): p is DuplicatePair => !!p.a && !!p.b)
}

/** Marca un par como "no es duplicado" (no vuelve a sugerirse). */
export async function dismissDuplicatePair(idA: string, idB: string): Promise<void> {
  const supabase = createAdminClient()
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA]
  const { error } = await supabase.from('duplicate_dismissals').upsert({ member_a: a, member_b: b }, { onConflict: 'member_a,member_b' })
  if (error) throw error
}

export async function createMember(member: Omit<DbMember, 'id' | 'created_at' | 'updated_at' | 'sede_id'>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .insert(member)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

/** Crea una family_unit e inserta a todos sus integrantes en family_members. */
export async function createFamily(input: { name: string; members: Array<{ member_id: string; relation: string }> }) {
  const supabase = createAdminClient()
  const { data: unit, error: uErr } = await supabase
    .from('family_units')
    .insert({ name: input.name })
    .select('id')
    .single()
  if (uErr) throw uErr
  const unitId = (unit as { id: string }).id

  if (input.members.length > 0) {
    const rows = input.members.map(m => ({ family_unit_id: unitId, member_id: m.member_id, relation: m.relation }))
    const { error: mErr } = await supabase.from('family_members').insert(rows)
    if (mErr) throw mErr
  }
  return { id: unitId }
}

/** Devuelve los OTROS integrantes de la(s) familia(s) de un miembro (para check-in). */
export async function getMemberFamily(memberId: string): Promise<Array<{ member_id: string; name: string; relation: string }>> {
  const supabase = createAdminClient()
  // Unidades familiares a las que pertenece el miembro.
  const { data: own, error: oErr } = await supabase
    .from('family_members')
    .select('family_unit_id')
    .eq('member_id', memberId)
  if (oErr) throw oErr
  const unitIds = (own ?? []).map((r: { family_unit_id: string | null }) => r.family_unit_id).filter((x): x is string => x !== null)
  if (unitIds.length === 0) return []

  const { data, error } = await supabase
    .from('family_members')
    .select('member_id, relation, member:members!family_members_member_id_fkey(first_name, last_name)')
    .in('family_unit_id', unitIds)
    .neq('member_id', memberId)
  if (error) throw error

  const rows = (data ?? []) as Array<{ member_id: string; relation: string; member: { first_name: string; last_name: string } | null }>
  // Dedupe por member_id (puede aparecer en varias unidades).
  const seen = new Set<string>()
  const out: Array<{ member_id: string; name: string; relation: string }> = []
  for (const r of rows) {
    if (seen.has(r.member_id)) continue
    seen.add(r.member_id)
    out.push({ member_id: r.member_id, name: `${r.member?.first_name ?? ''} ${r.member?.last_name ?? ''}`.trim(), relation: r.relation })
  }
  return out
}

export async function updateMember(id: string, updates: Partial<DbMember>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

export async function deactivateMember(
  id: string,
  reason: string,
  deactivated_by: string,
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update({
      is_active: false,
      deactivation_reason: reason,
      deactivated_at: new Date().toISOString(),
      deactivated_by,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}
