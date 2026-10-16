import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { reportarError } from '@/lib/observabilidad'
import { gestionaRecursos, estaPublicado, puedeAbrir } from '@/lib/recursos/reglas'
import { getRecurso, pasaLaAudiencia, firmarArchivo } from '@/lib/supabase/queries/resources'

/**
 * REC-1 · Abrir un recurso: valida el acceso ACÁ y redirige a una URL firmada
 * corta. Es el candado: la lista también filtra, pero quien adivine un id y
 * no esté en la audiencia recibe 403 igual.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: el permiso real es la audiencia del recurso, que se evalúa abajo.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const r = await getRecurso(id)
    if (!r) return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 })
    const gestiona = gestionaRecursos(auth.ctx.roles)
    const pasa = !gestiona && auth.ctx.memberId ? await pasaLaAudiencia(auth.ctx.memberId, r) : false
    if (!puedeAbrir({ gestiona, publicado: estaPublicado(r), pasaLaAudiencia: pasa })) {
      return NextResponse.json({ error: 'Este recurso no está disponible para tu perfil.' }, { status: 403 })
    }
    const url = await firmarArchivo(r, new URL(req.url).searchParams.get('descargar') === '1')
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    reportarError('GET /api/resources/[id]/file:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
