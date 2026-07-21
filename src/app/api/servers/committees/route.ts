import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getCommittees } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    return NextResponse.json(await getCommittees())
  } catch (error) {
    console.error('GET /api/servers/committees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
