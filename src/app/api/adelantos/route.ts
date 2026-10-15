import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { hasModulePermission, type RoleId } from '@/lib/auth/roles'
import { logAudit } from '@/lib/audit'
import {
  listarAdelantos, abrirMes, fijarPresupuesto, presupuestos, sedesQueAtiende, sedesOperativas,
  DatosInvalidos, PasoInvalido,
} from '@/lib/supabase/queries/adelantos'
import { mesActual, esMesValido } from '@/lib/finance/adelantos'
import { reportarError } from '@/lib/observabilidad'

/** Finanzas y dirección ven todas las sedes; el colaborador, la(s) suya(s). */
export async function alcanceDeSedes(ctx: { memberId: string | null; roles: string[] }): Promise<{ todas: boolean; sedes: string[] }> {
  if (hasModulePermission(ctx.roles as RoleId[], 'finanzas', 'view')) return { todas: true, sedes: [] }
  if (!ctx.memberId) return { todas: false, sedes: [] }
  return { todas: false, sedes: await sedesQueAtiende(ctx.memberId) }
}

// GET ?mes=YYYY-MM — los adelantos del mes en el alcance de quien pregunta.
export async function GET(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const mes = req.nextUrl.searchParams.get('mes') || mesActual()
    if (!esMesValido(mes)) return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
    const alcance = await alcanceDeSedes(auth.ctx)
    if (!alcance.todas && alcance.sedes.length === 0) return NextResponse.json({ error: 'No tenés sede asignada para adelantos.' }, { status: 403 })
    const items = await listarAdelantos(mes, alcance.todas ? null : alcance.sedes)
    const [cat, pres] = await Promise.all([sedesOperativas(), presupuestos()])
    const sedes = (alcance.todas ? cat : cat.filter(s => alcance.sedes.includes(s.code)))
      .map(s => ({ code: s.code, name: s.name, presupuesto: pres[s.code]?.monto ?? null, abierto: items.some(a => a.sede_code === s.code) }))
    return NextResponse.json({ mes, items, sedes, finanzas: alcance.todas })
  } catch (error) {
    if (error instanceof DatosInvalidos) return NextResponse.json({ error: error.message }, { status: 400 })
    reportarError('GET /api/adelantos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('abrir'), sede_code: z.string().min(1), mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
  z.object({ action: z.literal('presupuesto'), sede_code: z.string().min(1), monto: z.number().min(0) }),
])

// POST — abrir el mes de una sede, o fijar su presupuesto (solo finanzas).
export async function POST(req: NextRequest) {
  // Solo sesión: la sede tiene que ser una que la persona atiende (alcanceDeSedes, abajo); el acceso sale del PUESTO, no de un rol.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    const alcance = await alcanceDeSedes(auth.ctx)
    const b = parsed.data
    if (b.action === 'presupuesto') {
      // El presupuesto lo fija FINANZAS. El colaborador lo ve, no lo mueve.
      if (!alcance.todas) return NextResponse.json({ error: 'El presupuesto lo fija finanzas.' }, { status: 403 })
      await fijarPresupuesto(b.sede_code, b.monto, auth.ctx.memberId)
      await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'sede_advance_budgets', entityId: b.sede_code, newData: { monto: b.monto } })
      return NextResponse.json({ ok: true })
    }
    if (!alcance.todas && !alcance.sedes.includes(b.sede_code)) return NextResponse.json({ error: 'Esa sede no es tuya.' }, { status: 403 })
    const a = await abrirMes(b.sede_code, b.mes)
    return NextResponse.json(a, { status: 201 })
  } catch (error) {
    if (error instanceof PasoInvalido) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof DatosInvalidos) return NextResponse.json({ error: error.message }, { status: 400 })
    reportarError('POST /api/adelantos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
