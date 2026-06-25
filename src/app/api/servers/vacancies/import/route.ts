import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { importVacancies, type ImportVacancyRow } from '@/lib/supabase/queries/vacancy-import'

// POST: importación bulk de vacantes. Solo admin + coordinación de staff (punto 6).
// Body: { rows: ImportVacancyRow[] }. Valida fila por fila Área→Comité→Puesto.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STAFF_IMPORT_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? (body.rows as ImportVacancyRow[]) : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Sin filas para importar' }, { status: 400 })
    }
    return NextResponse.json(await importVacancies(rows))
  } catch (error) {
    console.error('POST /api/servers/vacancies/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
