import { NextResponse } from 'next/server'
import { requireAccesoAReporte } from '@/lib/auth/guard'
import { getDirigentesParaExcel } from '@/lib/supabase/queries/reports'
import { construirExcelDeDirigentes } from '@/lib/reports/export-de-dirigentes'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · DIR-9 · El reporte de dirigentes en .xlsx.
 *
 * MISMO GATE que la pantalla: un export que se pueda bajar sin el permiso
 * del reporte sería la puerta de atrás del reporte.
 *
 * NO lleva las notas ni la banderita, ni siquiera para quien puede verlas:
 * son confidenciales y un archivo se reenvía sin pensarlo. Quien las
 * necesite las lee en la ficha, donde el permiso se vuelve a evaluar.
 */
export async function GET() {
  try {
    const auth = await requireAccesoAReporte('dirigentes')
    if (auth.res) return auth.res
    const buf = await construirExcelDeDirigentes(await getDirigentesParaExcel())
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="dirigentes-${ymdCR()}.xlsx"`,
      },
    })
  } catch (error) {
    reportarError('GET /api/reports/leaders/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
