import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getSedes } from '@/lib/supabase/queries/sedes'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getSedes())
  } catch (error) {
    console.error('GET /api/sedes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
