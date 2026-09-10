import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { saldosAFavor, totalPorMoneda, type MatriculaConPagos } from '@/lib/finance/saldo-a-favor'

// GET: quién tiene plata a favor.
//
// Se calcula, no se lee: el saldo es lo pagado menos lo que cuesta la
// matrícula. Ver saldo-a-favor.ts para por qué no se guarda.
//
// Va en TypeScript y no en una vista de Postgres porque son dos consultas
// paginadas sobre unos pocos miles de filas — no vale una migración.
export async function GET() {
  const auth = await requireModuleView('finanzas')
  if (auth.res) return auth.res
  try {
    const sb = createAdminClient()

    type Enr = {
      id: string; member_id: string; group_id: string | null
      member: { first_name: string | null; last_name: string | null } | null
      group: { name: string | null; plan: { cost: number | null; currency: string | null } | null } | null
    }
    const matriculas: Enr[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('study_enrollments')
        .select(`id, member_id, group_id,
                 member:members!study_enrollments_member_id_fkey(first_name, last_name),
                 group:study_groups!study_enrollments_group_id_fkey(name, plan:study_plans!study_groups_plan_id_fkey(cost, currency))`)
        .in('status', ['enrolled', 'pendiente_de_pago', 'en_revision'])
        .range(from, from + 999)
      if (error) throw error
      const filas = (data ?? []) as unknown as Enr[]
      matriculas.push(...filas)
      if (filas.length < 1000) break
    }

    // Lo pagado por matrícula, en una sola pasada.
    const pagadoPorMatricula = new Map<string, number>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('payments')
        .select('enrollment_id, amount')
        .eq('status', 'paid').eq('concept', 'matricula')
        .not('enrollment_id', 'is', null)
        .range(from, from + 999)
      if (error) throw error
      const filas = (data ?? []) as { enrollment_id: string; amount: number }[]
      for (const p of filas) {
        pagadoPorMatricula.set(p.enrollment_id, (pagadoPorMatricula.get(p.enrollment_id) ?? 0) + Number(p.amount))
      }
      if (filas.length < 1000) break
    }

    const filas: MatriculaConPagos[] = matriculas.map(e => ({
      enrollment_id: e.id,
      member_id: e.member_id,
      member_name: `${e.member?.first_name ?? ''} ${e.member?.last_name ?? ''}`.trim() || 'Sin nombre',
      group_name: e.group?.name ?? null,
      costo: Number(e.group?.plan?.cost ?? 0),
      currency: e.group?.plan?.currency ?? 'CRC',
      pagado: pagadoPorMatricula.get(e.id) ?? 0,
    }))

    const saldos = saldosAFavor(filas)
    return NextResponse.json({
      items: saldos,
      total: saldos.length,
      totales: totalPorMoneda(saldos),
      matriculas_revisadas: filas.length,
    })
  } catch (error) {
    console.error('GET /api/finance/credits:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
