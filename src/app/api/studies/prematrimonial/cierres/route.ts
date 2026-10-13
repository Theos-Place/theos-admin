import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { PREMAT_EVAL_ROLES } from '@/lib/studies/premat-evaluation'
import { getCierresPrematrimoniales } from '@/lib/supabase/queries/prematrimonial'
import { ordenarCierres, resumenDeCierres } from '@/lib/studies/cierres-prematrimoniales'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · PRE-9 · Listado de cierres de prematrimonial.
 *
 * MISMO GATE ESTRECHO que la evaluación suelta (PRE-8): coordinación de
 * estudios, dirección y admin. NO lo ve la propia pareja, ni coordinación de
 * dirigentes —que sí puede CERRAR el grupo pero no leer lo que los mentores
 * escribieron sobre la pareja—.
 *
 * El listado no trae el punto ciego ni las observaciones: eso se pide de a
 * uno. Ver `cierres-prematrimoniales.ts`.
 */
export async function GET() {
  const auth = await requireRoles(...PREMAT_EVAL_ROLES)
  if (auth.res) return auth.res
  try {
    const items = ordenarCierres(await getCierresPrematrimoniales())
    return NextResponse.json({ items, total: items.length, resumen: resumenDeCierres(items) })
  } catch (error) {
    reportarError('GET /api/studies/prematrimonial/cierres:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
