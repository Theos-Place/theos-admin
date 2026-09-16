import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { findApplicableScholarshipForPayment } from '@/lib/supabase/queries/scholarships'
import { reportarError } from '@/lib/observabilidad'

// GET: beca ASIGNADA activa aplicable a este pago pendiente (para precargar
// el panel "Aplicar beca/cupón" del modal de pagos). { scholarship: ... | null }.
// BEC-1: mismos roles que pueden aplicarla (becas o revisión, con edit).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView(['becas', 'revision_pagos'], { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const scholarship = await findApplicableScholarshipForPayment(id)
    return NextResponse.json({ scholarship })
  } catch (error) {
    reportarError('GET /api/payments/[id]/scholarship-options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
