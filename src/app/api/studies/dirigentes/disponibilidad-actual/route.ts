import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getDisponibilidadDeDirigentes } from '@/lib/supabase/queries/studies'
import { construirExcelDeDisponibilidad } from '@/lib/studies/export-de-disponibilidad'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/**
 * SRV-9 · Lo que cada dirigente dijo de sí mismo, para el comité.
 *
 * `?formato=xlsx` devuelve el Excel; sin eso, el JSON que pinta el tablero.
 * Un solo endpoint y no dos porque la consulta es exactamente la misma: con
 * dos, el día que se agregue una columna una de las dos se queda atrás.
 *
 * QUIÉN. La misma lista que puede leer una ficha suelta. La disponibilidad
 * dice dónde está alguien los martes en la noche y si presta su casa: no es
 * un dato de contacto más.
 *
 * NO CONFUNDIR con `/disponibilidad` (DIR-1), que lee RESPUESTAS DE FORMULARIO
 * y es solo insumo. Esto es el dato en firme del sistema.
 */
const VIEW_ROLES = ['coordinador_dirigentes', 'coordinador_estudios', 'direccion', 'admin'] as const

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(...VIEW_ROLES)
    if (auth.res) return auth.res

    const gente = await getDisponibilidadDeDirigentes()

    if (req.nextUrl.searchParams.get('formato') === 'xlsx') {
      const buf = await construirExcelDeDisponibilidad(gente)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="disponibilidad-dirigentes-${ymdCR()}.xlsx"`,
        },
      })
    }

    return NextResponse.json({ items: gente, total: gente.length })
  } catch (error) {
    reportarError('GET /api/studies/dirigentes/disponibilidad-actual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
