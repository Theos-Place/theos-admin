import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getVacancyApplicantsExport } from '@/lib/supabase/queries/servers-export'

// POST: perfiles de quienes aplicaron a las vacantes dadas + el puesto al que
// aplicaron (para export CSV). Solo admin/coordinación de servidores.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { vacancy_ids } = (await req.json()) as { vacancy_ids?: string[] }
    const ids = Array.isArray(vacancy_ids) ? vacancy_ids.filter(Boolean) : []
    return NextResponse.json({ rows: await getVacancyApplicantsExport(ids) })
  } catch (error) {
    console.error('POST /api/servers/vacancies/export-applicants:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
