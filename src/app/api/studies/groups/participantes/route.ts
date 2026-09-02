import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { getGroupsWithParticipants } from '@/lib/supabase/queries/studies'
import { armarFilas } from '@/lib/studies/participantes-export'

/** YYYY-MM-DD o nada. */
const fechaValida = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

// GET: filas del export "grupos y participantes" — una por persona, con el
// grupo repetido y el costo del plan.
//
// ?ids=uuid,uuid → solo esos grupos (los marcados con checkbox). Sin ids, todos
// los que pasen los filtros, que son los MISMOS del listado para que lo
// exportado coincida con lo que se está viendo.
// Este export lleva DATOS PERSONALES de cada participante (correo, teléfono,
// cédula), así que es más restringido que el listado: solo quienes administran
// estudios. El dirigente queda fuera a propósito — como acepta `ids` sueltos,
// dejarlo entrar con scope 'own' sería darle los contactos de cualquier grupo.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...GROUP_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const crudos = (searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    // Un id malformado haría fallar la query entera con un error de Postgres:
    // se descartan acá.
    const ids = crudos.filter(id => z.uuid().safeParse(id).success)
    if (crudos.length > 0 && ids.length === 0) {
      return NextResponse.json({ error: 'Los grupos seleccionados no son válidos.' }, { status: 400 })
    }

    const statuses = searchParams.getAll('status')
    const { grupos, personas } = await getGroupsWithParticipants({
      ids: ids.length ? ids : undefined,
      // Con ids explícitos los filtros no aplican: se pidió ESOS grupos.
      // Los MISMOS filtros del listado, para que lo exportado sea exactamente
      // lo que se está viendo.
      filters: ids.length ? undefined : {
        statuses: statuses.length ? statuses : undefined,
        // `plan` puede venir repetido (?plan=N1&plan=N2): el filtro de tipo de
      // estudio es de selección múltiple. Se manda como lista siempre —
      // getAll con un solo valor devuelve un arreglo de uno, y así no hay dos
      // caminos que mantener.
      planCodes: searchParams.getAll('plan'),
        zone: searchParams.get('zone') ?? undefined,
        zoneNull: searchParams.get('zone_null') === '1' || undefined,
        day: searchParams.get('day') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        noLeader: searchParams.get('no_leader') === '1' || undefined,
        closingSoon: searchParams.get('closing_soon') === '1' || undefined,
        bloqueId: z.uuid().safeParse(searchParams.get('bloque')).success ? searchParams.get('bloque') : undefined,
        startFrom: fechaValida(searchParams.get('start_from')),
        startTo: fechaValida(searchParams.get('start_to')),
      },
    })
    return NextResponse.json({ filas: armarFilas(grupos, personas) })
  } catch (error) {
    console.error('GET /api/studies/groups/participantes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
