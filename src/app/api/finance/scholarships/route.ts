import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getScholarshipsQueue } from '@/lib/supabase/queries/scholarships'

// GET: listado de becas/cupones para el dashboard de finanzas (stat "sin usar").
// La gestión completa (crear cupón, revisar solicitudes, revocar) vive en
// /api/scholarships/* — esta ruta queda solo de lectura por compatibilidad.
export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    return NextResponse.json(await getScholarshipsQueue())
  } catch (error) {
    console.error('GET /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
