import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import {
  verAdelanto, agregarFactura, editarFactura, quitarFactura, cerrarMes, DatosInvalidos, PasoInvalido,
} from '@/lib/supabase/queries/adelantos'
import { alcanceDeSedes } from '../route'
import { reportarError } from '@/lib/observabilidad'

async function cargarSiPuede(id: string, ctx: { memberId: string | null; roles: string[] }) {
  const a = await verAdelanto(id)
  if (!a) return { error: NextResponse.json({ error: 'No se encontró el adelanto.' }, { status: 404 }) }
  const alcance = await alcanceDeSedes(ctx)
  if (!alcance.todas && !alcance.sedes.includes(a.sede_code)) return { error: NextResponse.json({ error: 'Esa sede no es tuya.' }, { status: 403 }) }
  return { a, finanzas: alcance.todas }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const r = await cargarSiPuede(id, auth.ctx)
    if (r.error) return r.error
    return NextResponse.json({ ...r.a, finanzas: r.finanzas })
  } catch (error) {
    reportarError('GET /api/adelantos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const facturaSchema = z.object({
  semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  encargado: z.string().trim().max(120).nullish(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proveedor: z.string().trim().min(1).max(200),
  numero_factura: z.string().trim().max(60).nullish(),
  monto: z.number().positive(),
  estado: z.enum(['pendiente', 'liquidada']),
  observaciones: z.string().trim().max(500).nullish(),
  receipt_path: z.string().trim().max(500).nullish(),
})

const accionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('factura'), factura: facturaSchema }),
  z.object({ action: z.literal('editar_factura'), factura_id: z.string().uuid(), factura: facturaSchema }),
  z.object({ action: z.literal('quitar_factura'), factura_id: z.string().uuid() }),
  z.object({ action: z.literal('cerrar'), notas: z.string().trim().max(1000).nullish() }),
])

// PATCH — las acciones del mes, con { action } validado (convención 7).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: la sede del adelanto tiene que ser una que la persona atiende (alcanceDeSedes, abajo); el acceso sale del PUESTO, no de un rol.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const r = await cargarSiPuede(id, auth.ctx)
    if (r.error) return r.error
    const parsed = accionSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    const b = parsed.data
    if (b.action === 'factura') {
      await agregarFactura(id, r.a.mes, r.a.estado, b.factura, auth.ctx.memberId)
    } else if (b.action === 'editar_factura') {
      await editarFactura(id, r.a.mes, r.a.estado, b.factura_id, b.factura)
    } else if (b.action === 'quitar_factura') {
      await quitarFactura(id, r.a.estado, b.factura_id)
    } else {
      // Cerrar el mes lo hace FINANZAS: es el acto que fija la reposición.
      if (!r.finanzas) return NextResponse.json({ error: 'El mes lo cierra finanzas.' }, { status: 403 })
      await cerrarMes(id, auth.ctx.memberId, b.notas ?? null)
      await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'sede_advances', entityId: id, newData: { estado: 'cerrado' } })
    }
    const a = await verAdelanto(id)
    return NextResponse.json({ ...a, finanzas: r.finanzas })
  } catch (error) {
    if (error instanceof PasoInvalido) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof DatosInvalidos) return NextResponse.json({ error: error.message, detalles: error.detalles }, { status: 400 })
    reportarError('PATCH /api/adelantos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
