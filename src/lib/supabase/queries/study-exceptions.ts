import { createAdminClient } from '@/lib/supabase/admin'
import { ymdCR } from '@/lib/format'
import { excepcionVigente } from '@/lib/studies/exception-scope'

// Excepciones de requisitos de matrícula (mismo patrón que study-invitations).
// Tabla study_requirement_exceptions (migración 072).

export type WaivableRequirement = 'donor' | 'attendance' | 'server' | 'prerequisite' | 'age' | 'all'

export type StudyException = {
  id: string
  member_id: string
  member_name: string
  plan_id: string
  plan_code: string
  plan_name: string
  waived_requirements: string[]
  /** Obligatoria desde 2026-08-04 (columna NOT NULL). Las excepciones viejas
   *  traen el texto de relleno de la migración. */
  reason: string
  granted_by: string | null
  granted_by_name: string | null
  status: 'active' | 'revoked' | 'used'
  created_at: string
  /** Bloque en que se otorgó; la excepción caduca al cerrar su matrícula.
   *  null en las anteriores al 2026-09-01, que no vencen. */
  bloque_nombre: string | null
  cierre_matricula: string | null
  /** status 'active' Y dentro del bloque. Es lo que hay que mirar en pantalla:
   *  una activa vencida sigue diciendo 'active' y ya no sirve. */
  vigente: boolean
}

type Embedded = {
  id: string
  member_id: string
  plan_id: string
  waived_requirements: string[] | null
  reason: string
  granted_by: string | null
  status: 'active' | 'revoked' | 'used'
  created_at: string
  bloque: { nombre: string | null; fecha_cierre_matricula: string | null } | null
  member: { first_name: string; last_name: string } | null
  plan: { code: string | null; name: string } | null
  granter: { first_name: string; last_name: string } | null
}

const fullName = (m: { first_name: string; last_name: string } | null) =>
  m ? `${m.first_name} ${m.last_name}`.trim() : ''

const SELECT = `
  id, member_id, plan_id, waived_requirements, reason, granted_by, status, created_at,
  member:members!study_requirement_exceptions_member_id_fkey(first_name, last_name),
  plan:study_plans!study_requirement_exceptions_plan_id_fkey(code, name),
  granter:members!study_requirement_exceptions_granted_by_fkey(first_name, last_name),
  bloque:capacitacion_bloques!study_requirement_exceptions_bloque_id_fkey(nombre, fecha_cierre_matricula)
`

function toDomain(r: Embedded): StudyException {
  return {
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    plan_id: r.plan_id,
    plan_code: r.plan?.code ?? '',
    plan_name: r.plan?.name ?? '',
    waived_requirements: r.waived_requirements ?? [],
    reason: r.reason,
    granted_by: r.granted_by,
    granted_by_name: fullName(r.granter) || null,
    status: r.status,
    created_at: r.created_at,
    bloque_nombre: r.bloque?.nombre ?? null,
    cierre_matricula: r.bloque?.fecha_cierre_matricula ?? null,
    vigente: excepcionVigente({
      status: r.status,
      cierreMatricula: r.bloque?.fecha_cierre_matricula ?? null,
      hoy: ymdCR(),
    }),
  }
}

/** Excepciones de un miembro (todas; activas primero, recientes arriba). */
export async function listExceptionsForMember(memberId: string): Promise<StudyException[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select(SELECT).eq('member_id', memberId).order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Embedded[]).map(toDomain)
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
}

/** Excepciones ACTIVAS de un miembro como mapa code → requisitos perdonados.
 *  Para la elegibilidad de matrícula (computeEligibility trabaja por code). */
export async function activeExceptionsByCodeForMember(memberId: string): Promise<Record<string, string[]>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select(`waived_requirements,
      plan:study_plans!study_requirement_exceptions_plan_id_fkey(code),
      bloque:capacitacion_bloques!study_requirement_exceptions_bloque_id_fkey(fecha_cierre_matricula)`)
    .eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const hoy = ymdCR()
  const out: Record<string, string[]> = {}
  for (const r of (data ?? []) as unknown as Array<{ waived_requirements: string[] | null; plan: { code: string | null } | null; bloque: { fecha_cierre_matricula: string | null } | null }>) {
    const code = r.plan?.code
    // VENCIDA = no cuenta. El status sigue diciendo 'active' hasta que alguien
    // la use o la revoque; la vigencia la da el bloque.
    if (!excepcionVigente({ status: 'active', cierreMatricula: r.bloque?.fecha_cierre_matricula, hoy })) continue
    if (code) out[code] = r.waived_requirements ?? []
  }
  return out
}

/** Excepciones ACTIVAS de un miembro como mapa plan_id → requisitos perdonados
 *  (para getEligibleStudiesForMember, que trabaja por plan_id). */
export async function activeExceptionsByPlanForMember(memberId: string): Promise<Map<string, string[]>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requirement_exceptions')
    .select(`plan_id, waived_requirements,
      bloque:capacitacion_bloques!study_requirement_exceptions_bloque_id_fkey(fecha_cierre_matricula)`)
    .eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const hoy = ymdCR()
  const m = new Map<string, string[]>()
  for (const r of (data ?? []) as unknown as Array<{ plan_id: string; waived_requirements: string[] | null; bloque: { fecha_cierre_matricula: string | null } | null }>) {
    if (!excepcionVigente({ status: 'active', cierreMatricula: r.bloque?.fecha_cierre_matricula, hoy })) continue
    m.set(r.plan_id, r.waived_requirements ?? [])
  }
  return m
}

/** Crea/actualiza la excepción activa de (member, plan). Idempotente por el UNIQUE. */
export async function createException(input: {
  member_id: string; plan_id: string; waived_requirements: string[]
  /** Obligatoria: la valida el zod de la ruta antes de llegar acá. */
  reason: string
  granted_by?: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  // Se cuelga del bloque ACTIVO: la excepción sirve para los grupos que están
  // abiertos ahora y muere cuando cierra su matrícula. Si no hay bloque activo
  // queda sin vencimiento — mejor eso que inventarle una fecha.
  const { data: bloque } = await supabase.from('capacitacion_bloques')
    .select('id').eq('estado', 'activo').limit(1).maybeSingle()
  // Cliente laxo para el insert: `bloque_id` es una columna nueva (migración
  // 20260901200000) y los tipos generados todavía no la traen.
  const laxo = supabase as unknown as {
    from: (t: string) => { upsert: (v: Record<string, unknown>, o: { onConflict: string }) => {
      select: (s: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } }
  }
  const { data, error } = await laxo.from('study_requirement_exceptions')
    .upsert({
      member_id: input.member_id,
      plan_id: input.plan_id,
      bloque_id: (bloque as { id: string } | null)?.id ?? null,
      waived_requirements: input.waived_requirements,
      reason: input.reason.trim(),
      granted_by: input.granted_by ?? null,
      status: 'active',
      revoked_at: null,
    }, { onConflict: 'member_id,plan_id' })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Revoca una excepción (status = revoked). */
export async function revokeException(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_requirement_exceptions')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Marca como usada la excepción activa de (member, plan) — al matricularse. No falla si no hay. */
export async function markExceptionUsed(memberId: string, planId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('study_requirement_exceptions')
    .update({ status: 'used' }).eq('member_id', memberId).eq('plan_id', planId).eq('status', 'active')
  if (error) throw error
}
