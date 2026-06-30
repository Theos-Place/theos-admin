import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getServicePositions } from '@/lib/supabase/queries/servers'

// GET: lista de puestos (con comité, área base y conteo de servidores).
// La creación e importación de puestos se eliminó de la UI (rediseño de vacantes):
// el catálogo de puestos se mantiene como está en la BD.
export async function GET() {
  try {
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    return NextResponse.json(await getServicePositions())
  } catch (error) {
    console.error('GET /api/servers/positions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
