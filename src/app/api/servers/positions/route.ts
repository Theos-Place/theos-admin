import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView, requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getServicePositions, createServicePosition } from '@/lib/supabase/queries/servers'

// GET: lista de puestos (con comité, área base y conteo de servidores).
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

// Mismo shape que el PUT, pero con comité y título obligatorios: un puesto sin
// comité no cuelga de ningún lado y uno sin título no se puede nombrar.
// `.strict()` corta el mass assignment — el objeto se esparce al insert.
const positionCreateSchema = z
  .object({
    area_id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    base_area_id: z.string().trim().min(1).nullish(),
    description: z.string().trim().nullish(),
    location: z.string().trim().nullish(),
    quantity: z.number().int().min(0).nullish(),
    study_requirement: z.string().trim().nullish(),
    functions: z.string().trim().nullish(),
    profile: z.string().trim().nullish(),
    skills: z.string().trim().nullish(),
  })
  .strict()

// POST: crea un puesto en un comité.
//
// Se había quitado de la UI en el rediseño de vacantes, y desde entonces cada
// puesto nuevo se creaba con un script suelto (Sede Potrero y Sede Pérez
// Zeledón en septiembre 2026). Vuelve porque el catálogo sí cambia, y hacerlo
// por script es más riesgoso que hacerlo por pantalla.
//
// OJO: el TÍTULO no es decorativo. POSITION_ROLE_RULES otorga roles
// automáticos —encargado_eventos, entre otros— según cómo se llame el puesto y
// dónde esté. La respuesta dice qué roles va a otorgar, para que quien lo crea
// se entere en el momento y no tres semanas después.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const parsed = positionCreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const { area_id, title } = parsed.data

    // Un puesto repetido en el mismo comité no es un puesto nuevo: es el mismo
    // con otra fila, y después nadie sabe a cuál asignar gente.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    const { data: yaHay } = await supabase
      .from('service_positions').select('id, title')
      .eq('area_id', area_id).ilike('title', title).maybeSingle()
    if (yaHay) {
      return NextResponse.json(
        { error: `Este comité ya tiene un puesto llamado «${(yaHay as { title: string }).title}».`, code: 'duplicado' },
        { status: 409 },
      )
    }

    const creado = await createServicePosition(parsed.data)
    const roles = await rolesDelPuesto(supabase, area_id, title)
    return NextResponse.json({ ...creado, ...parsed.data, roles_automaticos: roles }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/positions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Qué roles va a otorgar este puesto, según su título y dónde está. */
async function rolesDelPuesto(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  areaId: string,
  title: string,
): Promise<string[]> {
  const { rolesGrantedByPosition } = await import('@/lib/servers/position-roles')
  const { data: area } = await supabase
    .from('areas').select('name, area_type, parent_id').eq('id', areaId).maybeSingle()
  if (!area) return []
  const a = area as { name: string; area_type: string | null; parent_id: string | null }
  const { data: padre } = a.parent_id
    ? await supabase.from('areas').select('name').eq('id', a.parent_id).maybeSingle()
    : { data: null }
  return rolesGrantedByPosition({
    title,
    areaName: a.name,
    areaType: (a.area_type ?? 'committee') as 'committee' | 'area',
    parentAreaName: (padre as { name: string } | null)?.name ?? null,
  })
}
