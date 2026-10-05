import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { ESTUDIOS_REPORTE_ROLES } from '@/lib/auth/roles'
import { ESTADOS_DE_CONTACTO, A_QUE_VUELVE } from '@/lib/reports/no-volvieron'
import {
  registrarContacto, getExalumnosPerdidos, esDirigenteConHistorico,
  getHistorialDeContacto,
} from '@/lib/supabase/queries/no-volvieron'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'

/**
 * DIR-7 · Registrar el resultado de un contacto.
 *
 * SE INSERTA, NO SE ACTUALIZA. «Le escribí y no contestó» seguido de «quiere
 * volver» es la historia que importa; guardar solo lo último la borraría.
 *
 * QUIÉN PUEDE MARCAR A QUIÉN. Solo sobre alguien que está EN SU PROPIA LISTA.
 * No alcanza con ser dirigente: hay que ser el dirigente DE ESA PERSONA. Sin
 * esa comprobación, cualquier dirigente podría marcar «no quiere volver»
 * sobre el exalumno de otro y la lista del otro cambiaría sola.
 *
 * Los roles de estudios pueden marcar sobre cualquiera, porque también ven
 * cualquier lista.
 */
const bodySchema = z.object({
  member_id: z.string().uuid(),
  estado: z.enum(ESTADOS_DE_CONTACTO),
  a_que_vuelve: z.enum(A_QUE_VUELVE).nullish(),
  iglesia: z.string().trim().max(120).nullish(),
  nota: z.string().trim().max(300).nullish(),
  /** Solo lo manda un rol amplio, que puede marcar sobre la lista de otro. */
  dirigente_id: z.string().uuid().nullish(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { ctx } = auth

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const body = parsed.data

    const esAmplio = (ctx.roles ?? []).some(
      r => (ESTUDIOS_REPORTE_ROLES as readonly string[]).includes(r),
    )
    const miId = ctx.memberId
    if (!esAmplio) {
      if (!miId || !(await esDirigenteConHistorico(miId))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      // La comprobación que importa: esta persona tiene que estar en MI lista.
      const mios = await getExalumnosPerdidos(miId)
      if (!mios.some(e => e.member_id === body.member_id)) {
        return NextResponse.json(
          { error: 'Esa persona no está en tu lista.' },
          { status: 403 },
        )
      }
    }

    await registrarContacto({
      memberId: body.member_id,
      marcadoPor: miId,
      estado: body.estado,
      aQueVuelve: body.a_que_vuelve ?? null,
      iglesia: body.iglesia ?? null,
      nota: body.nota ?? null,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/reports/exalumnos-perdidos/contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** GET ?member=<id> · El historial de contactos de una persona. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { ctx } = auth

    const memberId = req.nextUrl.searchParams.get('member')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })
    }

    const esAmplio = (ctx.roles ?? []).some(
      r => (ESTUDIOS_REPORTE_ROLES as readonly string[]).includes(r),
    )
    if (!esAmplio) {
      const miId = ctx.memberId
      if (!miId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      const mios = await getExalumnosPerdidos(miId)
      if (!mios.some(e => e.member_id === memberId)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }
    return NextResponse.json({ historial: await getHistorialDeContacto(memberId) })
  } catch (error) {
    reportarError('GET /api/reports/exalumnos-perdidos/contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
