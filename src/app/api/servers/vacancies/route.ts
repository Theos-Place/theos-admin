import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { canManageCommittee } from '@/lib/auth/committee-scope'
import { getVacancies, createVacancy } from '@/lib/supabase/queries/servers'
import { vacancyWriteSchema } from './schema'

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
  const auth = await requireRoles() // autenticado; el permiso real es por comité (abajo)
  if (auth.res) return auth.res
  try {
    const parsed = vacancyWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const input = parsed.data
    // El coordinador/líder solo puede solicitar para comités que gestiona; los
    // roles administrativos globales, para cualquiera.
    if (!(await canManageCommittee(auth.ctx.roles, auth.ctx.memberId, input.committee_id))) {
      return NextResponse.json({ error: 'No podés crear vacantes para este comité.' }, { status: 403 })
    }
    const vacancy = await createVacancy(input)
    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
