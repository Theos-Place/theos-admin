import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'
import {
  esquemaDePerfilSirve, coherente, puedeLeerSirve, CAMPOS_SIRVE, PERFIL_VACIO, type PerfilSirve,
} from '@/lib/servers/perfil-sirve'

/**
 * El bloque ESPIRITUAL del miembro (`member_spiritual_data`): bautismo y,
 * desde SRV-20, el perfil S.I.R.V.E.
 *
 * DOS PERMISOS DISTINTOS, a propósito:
 *  · Bautismo: lo ve y edita la persona, y los roles de estudios (lo de siempre).
 *  · Perfil S.I.R.V.E.: lo EDITA solo la persona (y admin). Lo LEEN además
 *    estudios, servidores, staff y dirección (`ROLES_QUE_LEEN_SIRVE`) — nadie
 *    más, ni encargados de comité ni dirigentes. A quien no puede leerlo, el
 *    GET no se lo manda: `sirve: null`.
 *
 * El service role salta RLS; el guard la replica.
 */

const SELECT_SIRVE = CAMPOS_SIRVE.join(', ')

function isStudyAdmin(roles: string[]): boolean {
  return roles.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
}

const esquemaDeBautismo = z.object({
  baptism_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  baptism_place: z.string().trim().max(200).nullable().optional().transform(v => v || null),
}).strict()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  const esPropio = auth.ctx.memberId === id
  const leeSirve = esPropio || puedeLeerSirve(auth.ctx.roles)
  if (!esPropio && !isStudyAdmin(auth.ctx.roles) && !leeSirve) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('member_spiritual_data')
      .select(`baptism_date, baptism_place, sirve_fuente, editado_en_sistema_at, ${SELECT_SIRVE}`)
      .eq('member_id', id)
      .maybeSingle()
    if (error) throw error
    const fila = (data ?? null) as (Record<string, unknown> & PerfilSirve) | null
    const sirve: PerfilSirve = fila
      ? Object.fromEntries(CAMPOS_SIRVE.map(k => [k, fila[k] ?? PERFIL_VACIO[k]])) as PerfilSirve
      : PERFIL_VACIO
    return NextResponse.json({
      baptism_date: fila?.baptism_date ?? null,
      baptism_place: fila?.baptism_place ?? null,
      // La persona SIEMPRE puede editar lo suyo; los demás solo miran.
      sirve: leeSirve ? sirve : null,
      sirve_editable: esPropio || auth.ctx.roles.includes('admin'),
      sirve_fuente: leeSirve ? (fila?.sirve_fuente ?? null) : null,
    })
  } catch (error) {
    reportarError('GET /api/members/[id]/spiritual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Bautismo: el PUT de siempre (la pestaña lo manda entero). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: la propia persona escribe SU fila; para otra, un admin de estudios (abajo).
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (auth.ctx.memberId !== id && !isStudyAdmin(auth.ctx.roles)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const parsed = esquemaDeBautismo.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { error } = await supabase.from('member_spiritual_data').upsert({
      member_id: id,
      baptism_date: parsed.data.baptism_date || null,
      baptism_place: parsed.data.baptism_place ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PUT /api/members/[id]/spiritual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * SRV-20 · Perfil S.I.R.V.E.: un PATCH parcial, campo por campo (el patrón de
 * «cada cambio se guarda solo»). Solo la persona o admin. Cada edición queda
 * en audit_log con lo que había y lo que quedó, y marca
 * `editado_en_sistema_at` para que el import de CCB no lo pise.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: es de la propia persona (su perfil S.I.R.V.E.); para otra, solo admin (abajo).
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (auth.ctx.memberId !== id && !auth.ctx.roles.includes('admin')) {
    return NextResponse.json({ error: 'Solo la persona puede editar su perfil S.I.R.V.E.' }, { status: 403 })
  }
  try {
    const parsed = esquemaDePerfilSirve.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { data: antes, error: eAntes } = await supabase
      .from('member_spiritual_data').select(SELECT_SIRVE).eq('member_id', id).maybeSingle()
    if (eAntes) throw eAntes
    const previo = { ...PERFIL_VACIO, ...((antes ?? {}) as Partial<PerfilSirve>) }
    const nuevo = coherente({ ...previo, ...parsed.data })
    const ahora = new Date().toISOString()
    const { error } = await supabase.from('member_spiritual_data').upsert({
      member_id: id,
      ...nuevo,
      sirve_fuente: 'sistema',
      editado_en_sistema_at: ahora,
      updated_by: auth.ctx.userId,
      updated_at: ahora,
    }, { onConflict: 'member_id' })
    if (error) throw error
    const cambiados = (Object.keys(parsed.data) as (keyof PerfilSirve)[])
    await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'member_spiritual_data', entityId: id,
      oldData: Object.fromEntries(cambiados.map(k => [k, previo[k]])),
      newData: Object.fromEntries(cambiados.map(k => [k, nuevo[k]])) })
    return NextResponse.json({ ok: true, sirve: nuevo })
  } catch (error) {
    reportarError('PATCH /api/members/[id]/spiritual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
