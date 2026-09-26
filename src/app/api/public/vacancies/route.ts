import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getVacancies } from '@/lib/supabase/queries/servers'
import { reportarError } from '@/lib/observabilidad'

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
    const publicadas = all.filter(v => v.status === 'publicada')
    /**
     * Whitelist explícita, y SRV-13 la recortó.
     *
     * Antes salían también `position_functions` y `position_profile`. Esto es
     * una página sin login que se va a embeber en el sitio público, y esos dos
     * campos son la descripción interna del puesto —lo que se le exige a quien
     * sirve, cómo se lo evalúa—. Decisión del 2026-09-25: en público van SOLO
     * la descripción y el requisito de estudios; el resto se ve adentro.
     *
     * Se quitan del PAYLOAD y no solo de la pantalla: un campo que viaja al
     * navegador es público aunque no se pinte, y el que lo mire con las
     * herramientas del navegador lo va a encontrar igual.
     */
    const items = publicadas.map(v => ({
      id: v.id,
      title: v.title,
      position: v.position ?? '',
      committee_name: v.committee?.name ?? '',
      area: v.committee?.parent?.name ?? '',
      description: v.description ?? '',
      schedule: v.schedule ?? '',
      commitment: v.commitment ?? '',
      location: v.location ?? null,
      slots_total: v.slots_total,
      slots_filled: v.slots_filled,
      position_description: v.pos?.description ?? null,
      position_study_requirement: v.pos?.study_requirement ?? null,
      is_featured: !!v.is_featured,
    }))
    return NextResponse.json({ items })
  } catch (error) {
    reportarError('GET /api/public/vacancies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
