import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getDemandaDeclarada } from '@/lib/supabase/queries/demanda-declarada'
import { reportarError } from '@/lib/observabilidad'

/**
 * EST-29 · La demanda declarada agrupada para decidir aperturas. Solo el
 * equipo de estudios: trae nombre, correo y teléfono de quien pidió.
 */
export async function GET() {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getDemandaDeclarada())
  } catch (error) {
    reportarError('GET /api/studies/demand-clusters:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
