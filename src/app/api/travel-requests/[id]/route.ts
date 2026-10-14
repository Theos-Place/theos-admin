import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import {
  verViaje, editarViaje, moverViaje, anotarRevisionFinanciera,
  guardarGastos, anotarAnticipoEntregado, firmarYEnviarLiquidacion,
  PasoInvalido, DatosInvalidos,
} from '@/lib/supabase/queries/travel'
import { actoresDe, ESTADOS_DE_VIAJE } from '@/lib/travel/estados-del-viaje'
import { MONEDAS, RUBROS } from '@/lib/travel/presupuesto'
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

const gastoSchema = z.object({
  fecha: z.string().min(1),
  rubro: z.enum(RUBROS),
  proveedor: z.string().trim().max(200).nullish(),
  numero_comprobante: z.string().trim().max(100).nullish(),
  monto: z.number().positive(),
  moneda: z.enum(MONEDAS),
  receipt_path: z.string().trim().max(500).nullish(),
  sin_comprobante_motivo: z.string().trim().max(300).nullish(),
})

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
  // Fase B
  z.object({
    action: z.literal('gastos'),
    gastos: z.array(gastoSchema).max(200),
  }),
  z.object({
    action: z.literal('anticipo_entregado'),
    monto: z.number().min(0).nullable(),
    moneda: z.enum(MONEDAS).nullish(),
  }),
  z.object({
    action: z.literal('enviar_liquidacion'),
    // El checkbox de la declaración jurada. Sin él no se manda: es la firma.
    declaro: z.literal(true),
    notas: z.string().trim().max(2000).nullish(),
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
    const actores = actoresDe(auth.ctx.roles, r.esDueno)
    if (actores.length === 0) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const revisa = actores.includes('revision') || actores.includes('autoridad')

    if (parsed.data.action === 'revision_financiera') {
      if (!revisa) {
        return NextResponse.json({ error: 'Esa parte la llena finanzas.' }, { status: 403 })
      }
      await anotarRevisionFinanciera(id, parsed.data)
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'travel_requests',
        entityId: id, newData: { revision_financiera: true },
      })
      return NextResponse.json({ ok: true })
    }

    if (parsed.data.action === 'gastos') {
      // Los gastos los carga quien viajó. Finanzas revisa, no escribe por él.
      if (!r.esDueno) return NextResponse.json({ error: 'La liquidación la llena quien viajó.' }, { status: 403 })
      await guardarGastos(id, r.viaje.status, parsed.data.gastos)
      return NextResponse.json({ ok: true })
    }

    if (parsed.data.action === 'anticipo_entregado') {
      if (!revisa) {
        return NextResponse.json({ error: 'El anticipo lo marca finanzas.' }, { status: 403 })
      }
      await anotarAnticipoEntregado(id, parsed.data.monto, parsed.data.moneda ?? null)
      await moverViaje({
        id, de: r.viaje.status, a: 'anticipo_entregado', actores,
        quienMemberId: auth.ctx.memberId, nota: null,
      })
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'travel_requests',
        entityId: id, newData: { anticipo_entregado: parsed.data.monto },
      })
      return NextResponse.json({ ok: true })
    }

    if (parsed.data.action === 'enviar_liquidacion') {
      if (!r.esDueno) return NextResponse.json({ error: 'La liquidación la manda quien viajó.' }, { status: 403 })
      await firmarYEnviarLiquidacion({
        id, estado: r.viaje.status, memberId: auth.ctx.memberId,
        notas: parsed.data.notas ?? null,
      })
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'travel_requests',
        entityId: id, newData: { liquidacion_enviada: true },
      })
      return NextResponse.json({ ok: true })
    }

    // EL AGUJERO QUE ESTO TAPA: `liquidada` es un paso válido de la tabla,
    // así que el camino genérico de «mover» lo aceptaría — y se saltaría la
    // declaración jurada y la revisión de los gastos, que es lo único que
    // hace que la liquidación valga algo. A ese estado se llega SOLO por
    // `enviar_liquidacion`.
    if (parsed.data.a === 'liquidada') {
      return NextResponse.json({
        error: 'La liquidación se manda desde su formulario, con la declaración jurada.',
        code: 'use_enviar_liquidacion',
      }, { status: 400 })
    }
    // Mismo caso: mover a `anticipo_entregado` por la puerta genérica dejaría
    // el expediente diciendo que se entregó un anticipo sin decir de cuánto,
    // y la liquidación se calcularía contra cero.
    if (parsed.data.a === 'anticipo_entregado') {
      return NextResponse.json({
        error: 'Al marcar el anticipo hay que decir cuánto se entregó.',
        code: 'use_anticipo_entregado',
      }, { status: 400 })
    }

    await moverViaje({
      id, de: r.viaje.status, a: parsed.data.a, actores,
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
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message, detalles: error.detalles }, { status: 400 })
    }
    reportarError('PATCH /api/travel-requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
