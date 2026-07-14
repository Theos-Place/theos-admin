import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getAreas, createArea } from '@/lib/supabase/queries/servers'
import { areaCreateSchema } from './schema'

// GET: áreas (area_type='area') para dropdowns de área padre / área base.
export async function GET() {
  try {
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    return NextResponse.json(await getAreas())
  } catch (error) {
    console.error('GET /api/servers/areas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea un área o comité. Body: { name, area_type, description?, parent_id?, leader_id? }
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const parsed = areaCreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const area = await createArea(parsed.data)
    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/areas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
