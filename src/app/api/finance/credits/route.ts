import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { saldosAFavor, totalPorMoneda, llegadaDelPago, type MatriculaConPagos, type DetalleDelSaldo, type PagoDelSaldo } from '@/lib/finance/saldo-a-favor'
import { montoDelBloque, nivelesACobrar } from '@/lib/studies/corte-de-bloque'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'
import { reportarError } from '@/lib/observabilidad'

// GET: quién tiene plata a favor.
//
// Se calcula, no se lee: el saldo es lo pagado menos lo que cuesta la
// matrícula. Ver saldo-a-favor.ts para por qué no se guarda.
//
// Va en TypeScript y no en una vista de Postgres porque son dos consultas
// paginadas sobre unos pocos miles de filas — no vale una migración.
//
// EL COSTO SALE DE `montoDelBloque`, NO DE `plan.cost` (arreglado 2026-10-13).
// Con `plan.cost` las 10 personas del N1 de Escazú aparecían con ₡5.000 de
// saldo a favor cada una: pagaron el par N1+N2 —que es lo correcto bajo
// `bloques`— y el plan de N1 vale ₡0, así que la resta daba ₡5.000 de crédito
// inventado. Eran ₡50.000 que, devueltos, las habrían dejado sin el N2 que ya
// pagaron. Hay que preguntar lo que cuesta SU matrícula, y eso depende de la
// modalidad del grupo.
export async function GET(req: NextRequest) {
  const auth = await requireModuleView('finanzas')
  if (auth.res) return auth.res
  try {
    const sb = createAdminClient()

    // ?enrollment_id= → el detalle de UN saldo: sus pagos (con la traza del
    // cambio de grupo, que dice quién y cuándo) y qué cubre su costo.
    const enrollmentId = req.nextUrl.searchParams.get('enrollment_id')
    if (enrollmentId) {
      const { data: enr, error: eErr } = await sb.from('study_enrollments')
        .select('id, group:study_groups!study_enrollments_group_id_fkey(modalidad, plan:study_plans!study_groups_plan_id_fkey(code))')
        .eq('id', enrollmentId).maybeSingle()
      if (eErr) throw eErr
      if (!enr) return NextResponse.json({ error: 'No se encontró la matrícula.' }, { status: 404 })
      const g = (enr as unknown as { group: { modalidad: string | null; plan: { code: string | null } | null } | null }).group
      const { data: pagos, error: pErr } = await sb.from('payments')
        .select('id, amount, currency, paid_at, created_at, payment_method, reference_code, description, transfer_note')
        .eq('enrollment_id', enrollmentId).eq('status', 'paid').eq('concept', 'matricula')
        .order('paid_at', { ascending: true })
      if (pErr) throw pErr
      const modalidad = modalidadDe(g?.modalidad)
      const detalle: DetalleDelSaldo = {
        pagos: (pagos ?? []) as PagoDelSaldo[],
        cubre: [...nivelesACobrar(g?.plan?.code, modalidad)],
        modalidad,
      }
      return NextResponse.json(detalle)
    }

    type Enr = {
      id: string; member_id: string; group_id: string | null
      member: { first_name: string | null; last_name: string | null } | null
      group: {
        name: string | null; modalidad: string | null
        plan: { code: string | null; cost: number | null; currency: string | null } | null
      } | null
    }
    const matriculas: Enr[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('study_enrollments')
        .select(`id, member_id, group_id,
                 member:members!study_enrollments_member_id_fkey(first_name, last_name),
                 group:study_groups!study_enrollments_group_id_fkey(name, modalidad,
                   plan:study_plans!study_groups_plan_id_fkey(code, cost, currency))`)
        .in('status', ['enrolled', 'pendiente_de_pago', 'en_revision'])
        .range(from, from + 999)
      if (error) throw error
      const filas = (data ?? []) as unknown as Enr[]
      matriculas.push(...filas)
      if (filas.length < 1000) break
    }

    // Lo pagado por matrícula, en una sola pasada.
    const pagadoPorMatricula = new Map<string, number>()
    const generadoPorMatricula = new Map<string, string>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('payments')
        .select('enrollment_id, amount, paid_at, created_at, updated_at, transfer_note')
        .eq('status', 'paid').eq('concept', 'matricula')
        .not('enrollment_id', 'is', null)
        .range(from, from + 999)
      if (error) throw error
      const filas = (data ?? []) as Array<{ enrollment_id: string; amount: number; paid_at: string | null; created_at: string; updated_at: string | null; transfer_note: string | null }>
      for (const p of filas) {
        pagadoPorMatricula.set(p.enrollment_id, (pagadoPorMatricula.get(p.enrollment_id) ?? 0) + Number(p.amount))
        const llegada = llegadaDelPago(p)
        const previa = generadoPorMatricula.get(p.enrollment_id)
        if (llegada && (!previa || llegada > previa)) generadoPorMatricula.set(p.enrollment_id, llegada)
      }
      if (filas.length < 1000) break
    }

    // Los costos de los niveles, una vez: `montoDelBloque` suma el par y
    // necesita los dos precios, no solo el del plan del grupo.
    const { data: planRows } = await sb.from('study_plans').select('code, cost')
    const costos = Object.fromEntries(
      ((planRows ?? []) as Array<{ code: string; cost: number | null }>)
        .map(r => [r.code, Number(r.cost ?? 0)]))

    const filas: MatriculaConPagos[] = matriculas.map(e => ({
      enrollment_id: e.id,
      member_id: e.member_id,
      member_name: `${e.member?.first_name ?? ''} ${e.member?.last_name ?? ''}`.trim() || 'Sin nombre',
      group_name: e.group?.name ?? null,
      costo: montoDelBloque(e.group?.plan?.code, costos, modalidadDe(e.group?.modalidad)),
      currency: e.group?.plan?.currency ?? 'CRC',
      pagado: pagadoPorMatricula.get(e.id) ?? 0,
      generado_en: generadoPorMatricula.get(e.id) ?? null,
    }))

    const saldos = saldosAFavor(filas)
    return NextResponse.json({
      items: saldos,
      total: saldos.length,
      totales: totalPorMoneda(saldos),
      matriculas_revisadas: filas.length,
    })
  } catch (error) {
    reportarError('GET /api/finance/credits:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
