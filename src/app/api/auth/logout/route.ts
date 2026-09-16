import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportarError } from '@/lib/observabilidad'

export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('POST /api/auth/logout:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
