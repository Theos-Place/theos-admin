import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'

/**
 * POST /api/events/[id]/families — armar una familia DESDE la fila del evento.
 *
 * La tercera pata del mismo hueco (2026-09-09): el alta de personas y la
 * corrección del documento ya tienen su endpoint acotado, pero "Agregar
 * familia" del modal de check-in seguía pegando a /api/families, que exige los
 * mismos roles de padrón que encargado_eventos no tiene. O sea: una mamá que
 * llegaba con dos hijos se registraba, y al agrupar la familia fallaba con 403
 * después de haber creado a las tres personas.
 *
 * Igual que sus hermanos, cuelga de la ruta del evento: para usarlo hay que
 * nombrar un evento que existe. /api/families sigue como estaba.
 *
 * Solo AGRUPA fichas que ya existen — no crea personas ni las modifica. Cada
 * member_id se verifica antes: sin eso, cualquier UUID entraría a una familia.
 */

const schema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre de la familia.'),
  members: z.array(z.object({
    member_id: z.string().refine(isUuid, 'Identificador inválido.'),
    relation: z.string().trim().min(1),
  })).min(1, 'Se necesita al menos un integrante.').max(20),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...EVENT_CHECKIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id: eventId } = await params
    if (!isUuid(eventId)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const { data: evento } = await sb.from('events').select('id').eq('id', eventId).maybeSingle()
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    // Las fichas tienen que existir de verdad. El endpoint no crea gente: si un
    // id no está, es un error del cliente y se dice cuál.
    const ids = parsed.data.members.map(m => m.member_id)
    const { data: hallados } = await sb.from('members').select('id').in('id', ids)
    const existentes = new Set((hallados ?? []).map(m => m.id))
    const faltantes = ids.filter(i => !existentes.has(i))
    if (faltantes.length) {
      return NextResponse.json({ error: 'Alguna de las personas no existe.', faltantes }, { status: 400 })
    }

    const { createFamily } = await import('@/lib/supabase/queries/members')
    const res = await createFamily({ name: parsed.data.name, members: parsed.data.members })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/families:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
