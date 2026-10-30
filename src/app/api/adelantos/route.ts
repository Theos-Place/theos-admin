import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { hasModulePermission, type RoleId } from '@/lib/auth/roles'
import { logAudit } from '@/lib/audit'
import {
  listarAdelantos, abrirMes, fijarPresupuesto, presupuestos, atencionDe, sedesOperativas,
  listarTipos, guardarTipo, DatosInvalidos, PasoInvalido,
} from '@/lib/supabase/queries/adelantos'
import { mesActual, esMesValido } from '@/lib/finance/adelantos'
import { tiposVisibles, mesesDelSelector, codigoDeTipo, puestosDesdeTexto } from '@/lib/finance/presupuestos-de-sedes'
import { reportarError } from '@/lib/observabilidad'

/**
 * Finanzas y dirección ven todas las sedes y todos los tipos; el colaborador,
 * la(s) suya(s) y los tipos que su PUESTO ve (FIN-16: catálogo administrable).
 */
export async function alcanceDeSedes(ctx: { memberId: string | null; roles: string[] }): Promise<{ todas: boolean; sedes: string[]; tipos: string[] | null }> {
  if (hasModulePermission(ctx.roles as RoleId[], 'finanzas', 'view')) return { todas: true, sedes: [], tipos: null }
  if (!ctx.memberId) return { todas: false, sedes: [], tipos: [] }
  const [{ sedes, puestos }, catalogo] = await Promise.all([atencionDe(ctx.memberId), listarTipos()])
  return { todas: false, sedes, tipos: tiposVisibles(catalogo, puestos).map(t => t.code) }
}

/** ¿Entra este mes (sede + tipo) en el alcance? */
export function dentroDelAlcance(alcance: { todas: boolean; sedes: string[]; tipos: string[] | null }, sede: string, tipo: string): boolean {
  if (alcance.todas) return true
  return alcance.sedes.includes(sede) && (alcance.tipos ?? []).includes(tipo)
}

// GET ?mes=YYYY-MM — los presupuestos del mes en el alcance de quien pregunta.
export async function GET(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const mes = req.nextUrl.searchParams.get('mes') || mesActual()
    if (!esMesValido(mes)) return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
    const alcance = await alcanceDeSedes(auth.ctx)
    if (!alcance.todas && alcance.sedes.length === 0) return NextResponse.json({ error: 'No tenés sede asignada para presupuestos.' }, { status: 403 })
    const [items, cat, pres, catalogo] = await Promise.all([
      listarAdelantos(mes, alcance.todas ? null : alcance.sedes, alcance.tipos),
      sedesOperativas(), presupuestos(), listarTipos(),
    ])
    const tipos = alcance.todas ? tiposVisibles(catalogo, null) : catalogo.filter(t => (alcance.tipos ?? []).includes(t.code))
    const sedes = (alcance.todas ? cat : cat.filter(s => alcance.sedes.includes(s.code))).map(s => ({
      code: s.code, name: s.name,
      presupuestos: Object.fromEntries(tipos.map(t => [t.code, pres[`${s.code}:${t.code}`]?.monto ?? null])),
      abiertos: items.filter(a => a.sede_code === s.code).map(a => a.tipo),
    }))
    return NextResponse.json({ mes, items, sedes, tipos, finanzas: alcance.todas, meses: mesesDelSelector(mesActual()) })
  } catch (error) {
    if (error instanceof DatosInvalidos) return NextResponse.json({ error: error.message }, { status: 400 })
    reportarError('GET /api/adelantos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const codigo = z.string().regex(/^[a-z0-9_]+$/).max(40)
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('abrir'), sede_code: z.string().min(1), tipo: codigo, mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
  z.object({ action: z.literal('presupuesto'), sede_code: z.string().min(1), tipo: codigo, monto: z.number().min(0) }),
  // FIN-16 · El catálogo de tipos (solo finanzas). Sin `code` se crea uno nuevo.
  z.object({
    action: z.literal('tipo'), code: codigo.optional(), nombre: z.string().trim().min(1).max(60),
    puestos: z.string().max(500).default(''), activo: z.boolean().default(true),
  }),
])

// POST — abrir el mes de una sede y tipo, fijar su presupuesto o editar el catálogo de tipos.
export async function POST(req: NextRequest) {
  // Solo sesión: la sede y el tipo tienen que estar en el alcance de la persona (alcanceDeSedes, abajo); el acceso sale del PUESTO, no de un rol.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    const alcance = await alcanceDeSedes(auth.ctx)
    const b = parsed.data
    if (b.action === 'tipo') {
      if (!alcance.todas) return NextResponse.json({ error: 'Los tipos los administra finanzas.' }, { status: 403 })
      const code = b.code ?? codigoDeTipo(b.nombre)
      if (!code) return NextResponse.json({ error: 'El nombre no sirve como tipo.' }, { status: 400 })
      await guardarTipo({ code, nombre: b.nombre, puestos: puestosDesdeTexto(b.puestos), activo: b.activo })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'sede_budget_types', entityId: code, newData: { nombre: b.nombre, puestos: b.puestos, activo: b.activo } })
      return NextResponse.json({ ok: true, code })
    }
    if (b.action === 'presupuesto') {
      // El presupuesto lo fija FINANZAS. El colaborador lo ve, no lo mueve.
      if (!alcance.todas) return NextResponse.json({ error: 'El presupuesto lo fija finanzas.' }, { status: 403 })
      await fijarPresupuesto(b.sede_code, b.tipo, b.monto, auth.ctx.memberId)
      await logAudit({ actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'sede_advance_budgets', entityId: `${b.sede_code}:${b.tipo}`, newData: { monto: b.monto } })
      return NextResponse.json({ ok: true })
    }
    if (!dentroDelAlcance(alcance, b.sede_code, b.tipo)) return NextResponse.json({ error: 'Esa sede o ese tipo no es tuyo.' }, { status: 403 })
    const a = await abrirMes(b.sede_code, b.tipo, b.mes)
    return NextResponse.json(a, { status: 201 })
  } catch (error) {
    if (error instanceof PasoInvalido) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof DatosInvalidos) return NextResponse.json({ error: error.message }, { status: 400 })
    reportarError('POST /api/adelantos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
