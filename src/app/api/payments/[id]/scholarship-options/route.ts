import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { findApplicableScholarshipForPayment, becasQueNoCalzan } from '@/lib/supabase/queries/scholarships'
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
    // Cuando NO hay una aplicable, se dice qué otras tiene y para qué: el
    // modal decía «no tiene beca» a alguien que acababa de recibir una, y
    // eso se lee como un bug del sistema (ver `becasQueNoCalzan`).
    const otras = scholarship ? [] : await becasQueNoCalzan(id)
    return NextResponse.json({ scholarship, otras })
  } catch (error) {
    reportarError('GET /api/payments/[id]/scholarship-options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
