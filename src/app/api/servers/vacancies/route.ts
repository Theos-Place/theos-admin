import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getVacancies, createVacancy, type VacancyWriteInput } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getVacancies())
  } catch (error) {
    console.error('GET /api/servers/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const vacancy = await createVacancy((await req.json()) as VacancyWriteInput)
    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
