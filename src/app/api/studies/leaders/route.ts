import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getStudyLeaders, createLeader } from '@/lib/supabase/queries/studies'
import { leaderWriteSchema } from './schema'
import { canSeeLeaderAdminStatus, visibleLeaderStatus } from '@/lib/studies/leader-admin-status'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const leaders = await getStudyLeaders()

    // DIR-6: "en pausa" y "en revisión" son administrativos. Para quien no los
    // gestiona colapsan a 'inactive' ACÁ, en el API — no en la UI: así el matiz
    // no sale del servidor y no depende de que cada pantalla se acuerde de
    // esconderlo. Se aplica en las dos ramas de abajo.
    //
    // Ojo: el gate es por ROL y no por módulo, así que 'direccion' tampoco lo
    // ve aunque tenga estudios con alcance 'all' (mismo criterio que DIR-5).
    const verMatiz = canSeeLeaderAdminStatus(auth.ctx.roles)
    const sanear = <T extends { availability_status?: string | null }>(l: T): T => (
      verMatiz ? l : { ...l, availability_status: visibleLeaderStatus(l.availability_status, false) }
    )

    // Evaluaciones (puntajes/comentarios) e is_donor solo para el módulo
    // estudios MÁS ALLÁ de 'own' (SEC-1: dirigente/miembro reciben la lista
    // saneada); el resto de sesiones (el hook useStudies se usa en pantallas
    // de otros módulos) también recibe la lista sin los campos sensibles.
    const mod = await requireModuleView('estudios', { beyondOwn: true })
    if (!mod.res) return NextResponse.json(leaders.map(sanear))
    return NextResponse.json(leaders.map(l => sanear({
      ...l,
      member: l.member ? { ...l.member, is_donor: false } : l.member,
      evaluations: [],
    })))
  } catch (error) {
    console.error('GET /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const parsed = leaderWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const leader = await createLeader(parsed.data)
    return NextResponse.json(leader, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
