import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/guard'
import { hasManagementRole } from '@/lib/auth/roles'
import { searchMembersForLookup } from '@/lib/supabase/queries/members'

/**
 * Buscador MÍNIMO de personas: nombre, cédula y correo de miembros activos,
 * tope de 20 resultados. Para elegir a alguien en una pantalla de gestión —
 * hacerle check-in, asignarle una beca, meterlo a un grupo.
 *
 * POR QUÉ EXISTE (2026-08-04): estos buscadores pegaban a `GET /api/members`,
 * que exige el módulo miembros con alcance más allá de 'own' — o sea, el PADRÓN
 * completo. Los roles acotados (encargado_eventos, becas, editor_grupos_estudio,
 * forms) no lo tienen, así que sus buscadores devolvían siempre vacío: veían la
 * caja de búsqueda y no salía nadie.
 *
 * GATE: cualquier rol de GESTIÓN (hasManagementRole) — todo el que no sea
 * únicamente 'miembro'. Es deliberadamente más amplio que el padrón y a la vez
 * mucho más chico: sin filtros, sin paginar, sin exportar, sin datos sensibles y
 * solo gente activa. El padrón, sus filtros y su export siguen exigiendo el
 * módulo miembros. Decisión de TI 2026-08-04.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!hasManagementRole(ctx.roles)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const search = req.nextUrl.searchParams.get('search') ?? ''
    const limit = Math.min(Number(req.nextUrl.searchParams.get('pageSize') ?? 8) || 8, 20)
    return NextResponse.json({ members: await searchMembersForLookup(search, limit) })
  } catch (error) {
    console.error('GET /api/members/lookup:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
