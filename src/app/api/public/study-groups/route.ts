import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getGruposPublicosNivel1 } from '@/lib/supabase/queries/studies'
import { todayCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

/**
 * EST-20 · GET público de los grupos de Nivel 1 en matrícula.
 *
 * SIN requireRoles, a propósito y documentado: la página es para compartir
 * en redes y WhatsApp. Lo que la protege no es la sesión sino el PAYLOAD —
 * `getGruposPublicosNivel1` arma una whitelist de campos de cartelera y no
 * toca miembros— más el rate limit por IP.
 *
 * Matricularse SÍ pide sesión: eso lo hace el flujo normal, no esta ruta.
 */
export async function GET(req: Request) {
  try {
    if (!rateLimit(`public-study-groups:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    const items = await getGruposPublicosNivel1(todayCR())
    return NextResponse.json({ items }, {
      // Cache corto: la página se comparte y puede recibir mucha carga de
      // golpe, pero un cupo que cambia no puede tardar en verse. Dos
      // minutos, y `stale-while-revalidate` para que nadie espere.
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    reportarError('GET /api/public/study-groups:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
