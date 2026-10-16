import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getDemandaDeclarada } from '@/lib/supabase/queries/demanda-declarada'
import { construirExcelDeDemanda } from '@/lib/studies/export-de-demanda'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/** EST-29 · La demanda declarada en Excel. Mismo permiso que la pantalla. */
export async function GET() {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const d = await getDemandaDeclarada()
    const buf = await construirExcelDeDemanda(d.clusters, { planes: d.planes, zonas: d.zonas })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="demanda-declarada-${ymdCR()}.xlsx"`,
      },
    })
  } catch (error) {
    reportarError('GET /api/studies/demand-clusters/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
