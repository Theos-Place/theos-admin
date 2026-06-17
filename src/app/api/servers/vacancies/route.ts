import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getVacancies, createVacancy, type VacancyWriteInput } from '@/lib/supabase/queries/servers'

export async function GET(req: NextRequest) {
  try {
    // ?published=1 → vista de "puestos disponibles" abierta a cualquier miembro
    // autenticado (solo publicadas). Sin el flag → lista admin completa.
    if (req.nextUrl.searchParams.get('published') === '1') {
      const auth = await requireRoles()
      if (auth.res) return auth.res
      const all = await getVacancies()
      return NextResponse.json(all.filter(v => v.status === 'published'))
    }
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    return NextResponse.json(await getVacancies())
  } catch (error) {
    console.error('GET /api/servers/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles(...SERVICE_ADMIN_ROLES, 'lider_comite')
    if (auth.res) return auth.res
  try {
    const vacancy = await createVacancy((await req.json()) as VacancyWriteInput)
    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
