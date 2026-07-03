import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getFolletoRequests } from '@/lib/supabase/queries/folletos'
import { isFolletoState } from '@/lib/studies/folletos'

// GET: lista de solicitudes de folletos. Filtros: ?sede= &status=. Módulo 'folletos'.
export async function GET(req: NextRequest) {
  const auth = await requireModuleView('folletos')
  if (auth.res) return auth.res
  try {
    const sede = req.nextUrl.searchParams.get('sede') ?? undefined
    const statusParam = req.nextUrl.searchParams.get('status') ?? undefined
    const status = statusParam && isFolletoState(statusParam) ? statusParam : undefined
    return NextResponse.json(await getFolletoRequests({ sede: sede || undefined, status }))
  } catch (error) {
    console.error('GET /api/studies/folletos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
