import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getVacancies } from '@/lib/supabase/queries/servers'

// GET público para la página /vacantes (las vacantes son públicas: cualquiera
// puede verlas; aplicar sí requiere sesión). Decisión documentada: NO lleva
// requireRoles. Expone SOLO puestos aprobados ('aprobado') y con una
// WHITELIST de campos de cartelera — nunca datos de aplicantes ni internos.
// Rate limit por IP.
export async function GET(req: Request) {
  try {
    if (!rateLimit(`public-vacancies:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    const all = await getVacancies()
    // Solo 'aprobado' es "visible y aplicable" — mismo criterio que el GET
    // admin ?published=1.
    const publicadas = all.filter(v => v.status === 'aprobado')
    // Whitelist explícita: solo campos públicos de cartelera.
    const items = publicadas.map(v => ({
      id: v.id,
      title: v.title,
      position: v.position ?? '',
      committee_name: v.committee?.name ?? '',
      area: v.committee?.parent?.name ?? '',
      description: v.description ?? '',
      functions: v.functions ?? [],
      schedule: v.schedule ?? '',
      commitment: v.commitment ?? '',
      location: v.location ?? null,
      slots_total: v.slots_total,
      slots_filled: v.slots_filled,
      position_description: v.pos?.description ?? null,
      position_functions: v.pos?.functions ?? null,
      position_profile: v.pos?.profile ?? null,
      position_study_requirement: v.pos?.study_requirement ?? null,
      is_featured: !!v.is_featured,
    }))
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/public/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
