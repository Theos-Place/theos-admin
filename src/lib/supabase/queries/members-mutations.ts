// Mutaciones y utilidades de escritura de miembros (alta, edición, baja, fusión
// de duplicados, familia). Extraído de members.ts (auditoría 2026-06: archivos
// gigantes). Re-exportado por members.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeCedula } from '@/lib/cedula'
import type { DbMember } from './members'

/** Columnas aceptadas al crear/editar un miembro desde la UI (evita pasar
 *  campos que no existen en la tabla o que no deben tocarse por este camino). */
export const MEMBER_WRITE_FIELDS = [
  'cedula', 'first_name', 'last_name', 'birth_date', 'gender', 'marital_status',
  'phone', 'email', 'province', 'canton', 'district', 'address', 'occupation',
  'workplace', 'allergies', 'medications', 'emergency_contact_name',
  'emergency_contact_phone', 'photo_url', 'is_donor', 'is_active',
] as const

/** Correo normalizado para guardar/comparar: trim + minúsculas ('' → null).
 *  Sin esto, "Juan@X.com " y "juan@x.com" burlan el chequeo de duplicados. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return v || null
}

/** Busca un miembro existente por cédula o correo (para evitar duplicados al
 *  crear/editar). Dos lookups separados en vez de .or(): .or() interpola el
 *  valor en la sintaxis de PostgREST, así que comas/paréntesis del input
 *  alteran el filtro. El correo se compara case-insensitive (hay filas
 *  históricas con mayúsculas). `excludeId` omite al propio miembro (edición). */
export async function findMemberByCedulaOrEmail(cedula: string | null, email: string | null, excludeId?: string) {
  if (!cedula && !email) return null
  const supabase = createAdminClient()
  const lookup = (col: 'cedula_normalized' | 'email', val: string, ci = false) => {
    let q = supabase.from('members').select('id')
    // ilike sin comodines = igualdad case-insensitive; se escapan %_\ del input.
    q = ci ? q.ilike(col, val.replace(/[\\%_]/g, m => `\\${m}`)) : q.eq(col, val)
    if (excludeId) q = q.neq('id', excludeId)
    return q.limit(1).maybeSingle()
  }

  // La cédula se compara NORMALIZADA (misma base que el índice único parcial
  // members_cedula_norm_uniq): así "1-1234-5678" y "112345678" colisionan.
  const [byCedula, byEmail] = await Promise.all([
    cedula ? lookup('cedula_normalized', normalizeCedula(cedula)) : null,
    email ? lookup('email', email.trim(), true) : null,
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

/** Vincula a `linkMemberId` con la familia de `ownerId` (acción directa, sin
 *  flujo de solicitud). Si el owner ya pertenece a una unidad familiar, agrega
 *  al nuevo integrante ahí; si no, crea la unidad y suma al owner como
 *  'Titular'. El vínculo es recíproco: ambos comparten family_unit_id, así que
 *  cada uno ve al otro en su perfil. Lanza VINCULO_A_SI_MISMO / YA_VINCULADO. */
export async function linkFamilyMember(
  ownerId: string, linkMemberId: string, relation: string, actorMemberId: string | null,
): Promise<{ family_unit_id: string }> {
  if (ownerId === linkMemberId) throw new Error('VINCULO_A_SI_MISMO')
  const supabase = createAdminClient()

  // Unidad familiar existente del owner (la más antigua si tuviera varias).
  const { data: ownUnits, error: uErr } = await supabase
    .from('family_members')
    .select('family_unit_id, created_at')
    .eq('member_id', ownerId)
    .order('created_at', { ascending: true })
  if (uErr) throw uErr

  let unitId = (ownUnits ?? [])
    .map((r: { family_unit_id: string | null }) => r.family_unit_id)
    .find((x): x is string => !!x)

  if (!unitId) {
    // Sin unidad: crearla y sumar al owner como Titular (misma convención que el alta).
    const { data: owner } = await supabase.from('members').select('last_name').eq('id', ownerId).maybeSingle()
    const lastName = (owner as { last_name: string | null } | null)?.last_name?.trim()
    const { data: unit, error: cErr } = await supabase
      .from('family_units')
      .insert({ name: lastName ? `Familia ${lastName}` : 'Familia' })
      .select('id')
      .single()
    if (cErr) throw cErr
    unitId = (unit as { id: string }).id
    const { error: tErr } = await supabase
      .from('family_members')
      .insert({ family_unit_id: unitId, member_id: ownerId, relation: 'Titular', linked_by: actorMemberId })
    if (tErr) throw tErr
  }

  const { error: insErr } = await supabase
    .from('family_members')
    .insert({ family_unit_id: unitId, member_id: linkMemberId, relation, linked_by: actorMemberId })
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') throw new Error('YA_VINCULADO')
    throw insErr
  }
  return { family_unit_id: unitId }
}

/** Desvincula a `linkMemberId` de la familia de `ownerId` (acción directa).
 *  Quita su fila de la(s) unidad(es) que comparte con el owner; si una unidad
 *  queda con ≤1 integrante, la elimina (unidad huérfana). Lanza SIN_VINCULO. */
export async function unlinkFamilyMember(ownerId: string, linkMemberId: string): Promise<void> {
  if (ownerId === linkMemberId) throw new Error('SIN_VINCULO')
  const supabase = createAdminClient()

  // Unidades del owner.
  const { data: ownRows, error: oErr } = await supabase
    .from('family_members').select('family_unit_id').eq('member_id', ownerId)
  if (oErr) throw oErr
  const ownerUnits = new Set((ownRows ?? []).map((r: { family_unit_id: string | null }) => r.family_unit_id).filter(Boolean) as string[])
  if (ownerUnits.size === 0) throw new Error('SIN_VINCULO')

  // Unidades COMPARTIDAS (donde también está el otro miembro).
  const { data: linkRows, error: lErr } = await supabase
    .from('family_members').select('family_unit_id').eq('member_id', linkMemberId)
  if (lErr) throw lErr
  const shared = (linkRows ?? [])
    .map((r: { family_unit_id: string | null }) => r.family_unit_id)
    .filter((x): x is string => !!x && ownerUnits.has(x))
  if (shared.length === 0) throw new Error('SIN_VINCULO')

  // Quitar al integrante de esas unidades.
  const { error: delErr } = await supabase
    .from('family_members').delete().eq('member_id', linkMemberId).in('family_unit_id', shared)
  if (delErr) throw delErr

  // Limpiar unidades que quedaron con ≤1 integrante (cascade borra la fila restante).
  for (const unitId of shared) {
    const { count, error: cErr } = await supabase
      .from('family_members').select('id', { count: 'exact', head: true }).eq('family_unit_id', unitId)
    if (cErr) { console.warn('unlinkFamilyMember conteo unidad:', cErr.message); continue }
    if ((count ?? 0) <= 1) {
      const { error: duErr } = await supabase.from('family_units').delete().eq('id', unitId)
      if (duErr) console.warn('unlinkFamilyMember borrar unidad huérfana:', duErr.message)
    }
  }
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
