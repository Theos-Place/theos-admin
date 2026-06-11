import { NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getDonations } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    return NextResponse.json(await getDonations())
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
