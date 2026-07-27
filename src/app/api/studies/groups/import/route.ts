import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { importStudyGroups } from '@/lib/supabase/queries/group-import'
import type { GroupImportRow } from '@/lib/studies/group-import-rules'

// POST: importación masiva de grupos (EST-2). Body: { rows, dry_run? }.
// dry_run valida todo sin insertar (preview del wizard). Import parcial: las
// filas inválidas se reportan y no se insertan. Mismo guard que crear grupos.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const rows = Array.isArray(body?.rows) ? (body.rows as GroupImportRow[]) : []
    if (rows.length === 0) return NextResponse.json({ error: 'Sin filas para importar' }, { status: 400 })
    if (rows.length > 500) return NextResponse.json({ error: 'Máximo 500 filas por importación.' }, { status: 400 })
    const result = await importStudyGroups(rows, { dryRun: body?.dry_run === true })
    return NextResponse.json(result, { status: body?.dry_run === true || result.inserted === 0 ? 200 : 201 })
  } catch (error) {
    console.error('POST /api/studies/groups/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
