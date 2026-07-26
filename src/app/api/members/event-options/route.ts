import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: catálogo liviano de eventos para el filtro avanzado del padrón (FIL-1,
// "asistió / no asistió al evento X"). Endpoint propio porque /api/events exige
// el módulo eventos y el filtro lo usan roles que solo ven miembros (p. ej.
// comunicaciones). Solo expone id + título + fecha (nivel cartelera), nunca
// inscripciones ni check-ins.
export async function GET() {
  const auth = await requireModuleView('miembros', { beyondOwn: true })
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    // PostgREST corta en ~1000 filas: paginar hasta agotar.
    const pageSize = 1000
    const items: Array<{ id: string; title: string; starts_at: string | null }> = []
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, starts_at')
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) throw error
      const rows = (data ?? []) as typeof items
      items.push(...rows)
      if (rows.length < pageSize) break
    }
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/members/event-options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
