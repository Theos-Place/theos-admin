import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getPendingPaymentsQueue, type PaymentQueueStatus, type PaymentConcept } from '@/lib/supabase/queries/payments'

const STATUSES = new Set(['pendiente', 'en_revision', 'cerrado'])
const CONCEPTS = new Set(['matricula', 'folletos', 'evento'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET: cola de pagos pendientes de finanzas. ?status=pendiente|en_revision|cerrado
// (sin filtro: pendiente + en_revision, lo accionable). ?concept=matricula|folletos|evento
// REV-1: ?planId=<uuid> y ?leaderId=<uuid> filtran por plan/dirigente del grupo
// (solo aplican a matrícula; fuerzan ese concepto server-side).
export async function GET(req: NextRequest) {
  const auth = await requireModuleView('revision_pagos')
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const concept = searchParams.get('concept')
    const planId = searchParams.get('planId')
    const leaderId = searchParams.get('leaderId')
    return NextResponse.json(await getPendingPaymentsQueue({
      status: status && STATUSES.has(status) ? (status as PaymentQueueStatus) : undefined,
      concept: concept && CONCEPTS.has(concept) ? (concept as PaymentConcept) : undefined,
      planId: planId && UUID_RE.test(planId) ? planId : undefined,
      leaderId: leaderId && UUID_RE.test(leaderId) ? leaderId : undefined,
    }))
  } catch (error) {
    console.error('GET /api/payments/queue:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
