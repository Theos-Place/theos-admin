import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: opciones para los filtros de la cola de revisión (REV-1): planes de
// estudio activos y dirigentes con grupo. Endpoint propio porque
// /api/studies/plans exige roles de estudios y la cola la usan roles de
// revisión de pagos/finanzas.
export async function GET() {
  const auth = await requireModuleView('revision_pagos')
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()

    const { data: plans, error: pErr } = await supabase
      .from('study_plans')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    if (pErr) throw pErr

    // Dirigentes = miembros que figuran como leader_id de algún grupo.
    // PostgREST no hace DISTINCT y corta en ~1000 filas: paginar y dedupear acá.
    const pageSize = 1000
    const leaderMap = new Map<string, string>()
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('study_groups')
        .select('leader_id, leader:members!study_groups_leader_id_fkey(first_name, last_name)')
        .not('leader_id', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) throw error
      const rows = (data ?? []) as Array<{
        leader_id: string
        leader: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      }>
      for (const r of rows) {
        if (leaderMap.has(r.leader_id)) continue
        const l = Array.isArray(r.leader) ? r.leader[0] : r.leader
        if (l) leaderMap.set(r.leader_id, `${l.first_name} ${l.last_name}`.trim())
      }
      if (rows.length < pageSize) break
    }
    const leaders = [...leaderMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    return NextResponse.json({ plans: plans ?? [], leaders })
  } catch (error) {
    console.error('GET /api/payments/queue/options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
