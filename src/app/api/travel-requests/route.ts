import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { listarViajes, crearViaje, DatosInvalidos } from '@/lib/supabase/queries/travel'
import {
  puedePedirViaje, ROLES_REVISION_FINANCIERA, ROLES_AUTORIDAD_COMPETENTE,
} from '@/lib/travel/estados-del-viaje'
import { RUBROS, MONEDAS } from '@/lib/travel/presupuesto'
import { reportarError } from '@/lib/observabilidad'

/** Quien revisa o aprueba ve todos los expedientes; el resto, los suyos. */
export const veTodosLosViajes = (roles: readonly string[]): boolean =>
  [...ROLES_REVISION_FINANCIERA, ...ROLES_AUTORIDAD_COMPETENTE].some(r => roles.includes(r))

const lineaSchema = z.object({
  rubro: z.enum(RUBROS),
  descripcion: z.string().trim().max(200).nullish(),
  cantidad: z.number().positive(),
  tarifa: z.number().min(0),
  moneda: z.enum(MONEDAS),
})

export const viajeSchema = z.object({
  tipo: z.enum(['trabajo', 'capacitacion']),
  alcance: z.enum(['nacional', 'internacional']),
  destino: z.string().trim().min(1).max(200),
  sale_at: z.string().min(1),
  vuelve_at: z.string().min(1),
  acompanantes: z.string().trim().max(500).nullish(),
  objetivo: z.string().trim().min(1).max(2000),
  agenda: z.string().trim().max(2000).nullish(),
  beneficio: z.string().trim().max(2000).nullish(),
  resultado_esperado: z.string().trim().max(2000).nullish(),
  financiamiento: z.string().trim().max(200).nullish(),
  centro_costo: z.string().trim().max(100).nullish(),
  anticipo_monto: z.number().min(0).nullish(),
  anticipo_moneda: z.enum(MONEDAS).nullish(),
  lineas: z.array(lineaSchema).max(60),
})

// GET — los viajes que esta persona puede ver.
export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const verTodos = veTodosLosViajes(auth.ctx.roles)
    const items = await listarViajes({ memberId: auth.ctx.memberId, verTodos })
    return NextResponse.json({ items, total: items.length, verTodos })
  } catch (error) {
    reportarError('GET /api/travel-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — crear el expediente, siempre en borrador.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  // La minuta del 2026-09-29: estos formularios son para staff.
  if (!puedePedirViaje(auth.ctx.roles)) {
    return NextResponse.json({ error: 'Las solicitudes de viaje son para el equipo de trabajo.' }, { status: 403 })
  }
  if (!auth.ctx.memberId) {
    return NextResponse.json({ error: 'Tu cuenta no tiene ficha asociada.' }, { status: 403 })
  }
  try {
    const parsed = viajeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    // El expediente es de quien lo pide. No se acepta un member_id del body:
    // es el dato que un cliente puede cambiar para pedir a nombre de otro.
    const { id } = await crearViaje(auth.ctx.memberId, parsed.data)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'INSERT', entityType: 'travel_requests',
      entityId: id, newData: { destino: parsed.data.destino, status: 'borrador' },
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message, detalles: error.detalles }, { status: 400 })
    }
    reportarError('POST /api/travel-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
