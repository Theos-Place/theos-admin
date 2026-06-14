import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { importServicePositions, type ImportPositionRow } from '@/lib/supabase/queries/servers'

// POST: importación bulk de puestos. Body: { rows: ImportPositionRow[] }
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? (body.rows as ImportPositionRow[]) : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Sin filas para importar' }, { status: 400 })
    }
    return NextResponse.json(await importServicePositions(rows))
  } catch (error) {
    console.error('POST /api/servers/positions/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
