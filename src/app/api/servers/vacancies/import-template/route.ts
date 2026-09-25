import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { construirPlantillaDeVacantes } from '@/lib/servers/plantilla-de-vacantes'

// GET: plantilla .xlsx para importar vacantes, con los datos EN VIVO (áreas,
// comités y puestos del momento) y dropdowns dependientes en cascada
// Área → Comité → Puesto (validación de datos + rangos nombrados + INDIRECT).
// Solo admin + coordinación de staff (mismo permiso que importar — punto 6).

export async function GET() {
  const auth = await requireRoles(...STAFF_IMPORT_ROLES)
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const [{ data: areasData }, { data: commData }, { data: posData }, { data: sedesData }] = await Promise.all([
      supabase.from('areas').select('id, name').eq('area_type', 'area').eq('is_active', true).order('name'),
      supabase.from('areas').select('id, name, parent_id').eq('area_type', 'committee').eq('is_active', true).order('name'),
      supabase.from('service_positions').select('id, title, area_id').eq('is_active', true).order('title'),
      // Las sedes ACTIVAS: son los lugares donde hoy se sirve. Las históricas y
      // las que solo son zona de estudio no van — ofrecerlas invitaría a crear
      // vacantes en lugares donde no hay servicio.
      supabase.from('sedes').select('name').eq('is_active', true).order('name'),
    ])

    const areas = (areasData ?? []) as Array<{ id: string; name: string }>
    const committees = (commData ?? []) as Array<{ id: string; name: string; parent_id: string | null }>
    const positions = (posData ?? []) as Array<{ id: string; title: string; area_id: string }>
    const sedes = ((sedesData ?? []) as Array<{ name: string }>).map(s => s.name)

    const buf = await construirPlantillaDeVacantes({ areas, committees, positions, sedes })


    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-vacantes.xlsx"',
      },
    })
  } catch (error) {
    reportarError('GET /api/servers/vacancies/import-template:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
