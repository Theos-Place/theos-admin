import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getDonations } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getDonations())
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
