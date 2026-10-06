import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAutoFolletoIfNeeded } from '@/lib/supabase/queries/folletos'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'
import { puedePedirFolletosAnticipados } from '@/lib/studies/folletos-anticipados'
import { reportarError } from '@/lib/observabilidad'

/**
 * EST-21 · POST: pide los folletos de un grupo ANTES de que arranque.
 *
 * La imprenta tarda y los folletos del par tienen que estar el primer día,
 * así que hay que pedirlos con el grupo todavía en matrícula. Esperar a un
 * disparador automático llega tarde: de los tres que existen, `cupo_lleno` y
 * `fin_matricula` quedaron muertos el 2026-09-02 y el de `cierre` depende de
 * que el grupo ANTERIOR se cierre.
 *
 * Se reusa `createAutoFolletoIfNeeded` entero y no se copia nada de él: ahí
 * viven la resolución de sede, el conteo de dirigentes, el par de folletos
 * (`folletosQuePide`) y el aviso por correo. Lo único propio de este
 * endpoint es QUIÉN puede y CUÁNDO.
 *
 * La idempotencia la da la base: el índice único parcial sobre
 * `source_group_id` incluye `anticipado`, así que el doble clic no duplica y
 * el automático del cierre tampoco crea una segunda orden encima.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo gestión de estudios. El DIRIGENTE no: mandar a imprimir es una
  // decisión de operación con costo, y el prompt del ítem lo pedía explícito.
  const auth = await requireRoles('coordinador_estudios', 'folletos', 'direccion', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('study_groups')
      .select('id, status, modalidad, plan:study_plans(code)')
      .eq('id', id).maybeSingle()
    const grupo = data as { id: string; status: string; modalidad: string | null; plan: { code: string | null } | { code: string | null }[] | null } | null
    if (!grupo) return NextResponse.json({ error: 'El grupo no existe' }, { status: 404 })
    const plan = Array.isArray(grupo.plan) ? grupo.plan[0] : grupo.plan

    const veredicto = puedePedirFolletosAnticipados({
      planCode: plan?.code ?? null, status: grupo.status, modalidad: modalidadDe(grupo.modalidad),
    })
    if (!veredicto.puede) {
      return NextResponse.json({ error: veredicto.motivo, code: veredicto.code }, { status: 409 })
    }

    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
    const r = await createAutoFolletoIfNeeded(id, 'anticipado', hoy)

    if (!r.created) {
      // `id` viene aunque no se haya creado: el grupo ya los había pedido, y
      // quien llama necesita el tiquete para enlazarlo.
      const yaEstaba = r.reason === 'ya_existe'
      return NextResponse.json({
        error: yaEstaba
          ? 'Este grupo ya tiene su orden de folletos.'
          : 'No se pudo pedir: ' + (r.reason ?? 'motivo desconocido'),
        code: r.reason, folleto_id: r.id ?? null,
      }, { status: 409 })
    }

    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'INSERT',
      entityType: 'folleto_requests',
      entityId: r.id!,
      // Sin esto, una orden pedida a mano es indistinguible de una automática
      // cuando alguien pregunte «¿quién mandó a imprimir esto?».
      newData: { tipo: 'anticipado', group_id: id, plan: plan?.code ?? null },
    })

    return NextResponse.json({ ok: true, folleto_id: r.id }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/studies/groups/[id]/folletos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
