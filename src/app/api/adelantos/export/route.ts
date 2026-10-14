import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { listarAdelantos } from '@/lib/supabase/queries/adelantos'
import { construirExcelDeAdelantos } from '@/lib/finance/export-de-adelantos'
import { mesActual, esMesValido } from '@/lib/finance/adelantos'
import { reportarError } from '@/lib/observabilidad'

// GET ?mes=YYYY-MM — el Excel del mes, todas las sedes. Solo finanzas.
export async function GET(req: NextRequest) {
  const auth = await requireModuleView('finanzas', { action: 'export' })
  if (auth.res) return auth.res
  try {
    const mes = req.nextUrl.searchParams.get('mes') || mesActual()
    if (!esMesValido(mes)) return NextResponse.json({ error: 'Mes inválido.' }, { status: 400 })
    const buf = await construirExcelDeAdelantos(await listarAdelantos(mes, null), mes)
    await logAudit({ actorUserId: auth.ctx.userId, action: 'EXPORT', entityType: 'sede_advances', newData: { mes } })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="adelantos-${mes}.xlsx"`,
      },
    })
  } catch (error) {
    reportarError('GET /api/adelantos/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
