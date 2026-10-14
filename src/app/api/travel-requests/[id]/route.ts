import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import {
  verViaje, editarViaje, moverViaje, anotarRevisionFinanciera,
  PasoInvalido, DatosInvalidos,
} from '@/lib/supabase/queries/travel'
import { actorDe, ESTADOS_DE_VIAJE } from '@/lib/travel/estados-del-viaje'
import { MONEDAS } from '@/lib/travel/presupuesto'
import { viajeSchema, veTodosLosViajes } from '../route'
import { reportarError } from '@/lib/observabilidad'

/**
 * Quién puede ABRIR este expediente: su dueño, o quien revisa/aprueba.
 *
 * No se usa un permiso de módulo a secas porque el expediente trae el
 * presupuesto y el anticipo de una persona concreta: es su plata, no un dato
 * de catálogo.
 */
async function cargarSiPuede(id: string, ctx: { memberId: string | null; roles: readonly string[] }) {
  const viaje = await verViaje(id)
  if (!viaje) return { error: NextResponse.json({ error: 'No se encontró el viaje.' }, { status: 404 }) }
  const esDueno = !!ctx.memberId && ctx.memberId === viaje.member_id
  if (!esDueno && !veTodosLosViajes(ctx.roles)) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  // Un borrador ajeno no se mira: todavía nadie lo mandó.
  if (!esDueno && viaje.status === 'borrador') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { viaje, esDueno }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const r = await cargarSiPuede(id, auth.ctx)
    if (r.error) return r.error
    return NextResponse.json(r.viaje)
  } catch (error) {
    reportarError('GET /api/travel-requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT — editar el expediente completo. Solo el dueño y solo mientras se pueda.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const r = await cargarSiPuede(id, auth.ctx)
    if (r.error) return r.error
    if (!r.esDueno) {
      return NextResponse.json({ error: 'Solo quien pidió el viaje puede editarlo.' }, { status: 403 })
    }
    const parsed = viajeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    await editarViaje(id, r.viaje.status, parsed.data)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'travel_requests',
      entityId: id, newData: { destino: parsed.data.destino },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PasoInvalido) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message, detalles: error.detalles }, { status: 400 })
    }
    reportarError('PUT /api/travel-requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const accionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mover'),
    a: z.enum(ESTADOS_DE_VIAJE),
    nota: z.string().trim().max(2000).nullish(),
  }),
  z.object({
    action: z.literal('revision_financiera'),
    monto_maximo_politica: z.number().min(0).nullish(),
    anticipo_recomendado: z.number().min(0).nullish(),
    disponibilidad_verificada: z.boolean().optional(),
    notas_finanzas: z.string().trim().max(2000).nullish(),
    // La moneda viaja para que el número no quede sin unidad en la pantalla.
    moneda: z.enum(MONEDAS).nullish(),
  }),
])

// PATCH — las acciones puntuales, con { action } validado (convención 7).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const r = await cargarSiPuede(id, auth.ctx)
    if (r.error) return r.error

    const parsed = accionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }

    // El actor sale de los roles, NUNCA del body: es lo único que separa
    // «finanzas revisó» de «finanzas se lo aprobó solo».
    const actor = actorDe(auth.ctx.roles, r.esDueno)
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    if (parsed.data.action === 'revision_financiera') {
      if (actor === 'solicitante') {
        return NextResponse.json({ error: 'Esa parte la llena finanzas.' }, { status: 403 })
      }
      await anotarRevisionFinanciera(id, parsed.data)
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'travel_requests',
        entityId: id, newData: { revision_financiera: true },
      })
      return NextResponse.json({ ok: true })
    }

    await moverViaje({
      id, de: r.viaje.status, a: parsed.data.a, actor,
      quienMemberId: auth.ctx.memberId, nota: parsed.data.nota ?? null,
    })
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: parsed.data.a === 'aprobada' ? 'APPROVE' : parsed.data.a === 'rechazada' ? 'REJECT' : 'UPDATE',
      entityType: 'travel_requests', entityId: id,
      oldData: { status: r.viaje.status },
      newData: { status: parsed.data.a, nota: parsed.data.nota ?? null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PasoInvalido) return NextResponse.json({ error: error.message }, { status: 409 })
    reportarError('PATCH /api/travel-requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
