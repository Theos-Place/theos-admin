import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getPaymentsQueue } from '@/lib/supabase/queries/payments'

// GET: cola de pagos en revisión. Protegido por el módulo 'revision_pagos'.
export async function GET() {
  const auth = await requireModuleView('revision_pagos')
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getPaymentsQueue())
  } catch (error) {
    console.error('GET /api/payments/queue:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
