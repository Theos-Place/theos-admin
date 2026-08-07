import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  findSpouseByContact, findSpouseCandidates, spouseById, meetsPrematRequirement,
} from '@/lib/supabase/queries/prematrimonial'
import { checkCoupleGender } from '@/lib/studies/premat-gender'
import { createAdminClient } from '@/lib/supabase/admin'

// Búsqueda del cónyuge por NOMBRE o por cédula/correo/teléfono.
//
// PRIVACIDAD: se devuelve el nombre + si cumple el requisito, nunca un dato de
// contacto. Por nombre puede haber homónimos, así que se devuelve una lista
// corta para elegir (ver findSpouseCandidates); antes solo se podía buscar con
// un identificador exacto y quien no lo tenía a mano quedaba trabado.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const query = body?.query
    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Ingresá el nombre, la cédula, el correo o el teléfono de tu pareja.' }, { status: 400 })
    }
    // Miembro que se inscribe (para excluirlo como su propia pareja). Un admin/
    // direccion puede buscar en nombre de otro (on_behalf_of); otros roles no.
    let enrolleeId = auth.ctx.memberId
    const onBehalfOf = typeof body?.on_behalf_of === 'string' ? body.on_behalf_of.trim() : ''
    if (onBehalfOf && onBehalfOf !== auth.ctx.memberId) {
      const isPrivileged = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('direccion')
      if (isPrivileged) enrolleeId = onBehalfOf
    }
    // Elegir de la lista de homónimos: se pide ESE miembro por id y se devuelve
    // el mismo detalle que una búsqueda exacta (requisito + flags de género),
    // sin volver a adivinar por texto.
    const elegido = typeof body?.spouse_member_id === 'string' ? body.spouse_member_id.trim() : ''
    const candidatos = elegido
      ? await spouseById(elegido, enrolleeId)
      : (await findSpouseCandidates(query)).filter(c => c.id !== enrolleeId)

    if (candidatos.length === 0) {
      const soloEra = await findSpouseByContact(query)
      if (soloEra && soloEra.id === enrolleeId) {
        return NextResponse.json({ found: false, message: 'La pareja no puede ser el mismo miembro que se inscribe.' })
      }
      return NextResponse.json({
        found: false,
        message: 'No encontramos a la pareja en el sistema. Probá con el nombre completo, la cédula o el correo, o escribí a estudios@theosplace.org',
      })
    }

    // Varios homónimos: se devuelve la lista para que elija, con el requisito de
    // cada uno resuelto (así no hay que buscar de nuevo al elegir).
    if (candidatos.length > 1) {
      const conRequisito = await Promise.all(candidatos.map(async c => ({
        spouse_member_id: c.id,
        name: c.name,
        meets_requirement: await meetsPrematRequirement(c.id),
      })))
      return NextResponse.json({ found: false, matches: conRequisito })
    }

    const spouse = candidatos[0]
    const meetsReq = await meetsPrematRequirement(spouse.id)
    // PRE-7: chequeo de género de la pareja — se devuelven FLAGS (mismo género /
    // a quién le falta el dato), nunca el género en sí (privacidad).
    const admin = createAdminClient()
    const { data: genders } = await admin.from('members').select('id, gender').in('id', [enrolleeId, spouse.id].filter(Boolean) as string[])
    const genderOf = (id: string | null) => (genders ?? []).find(g => (g as { id: string }).id === id) as { gender: string | null } | undefined
    const genderCheck = checkCoupleGender(genderOf(enrolleeId)?.gender ?? null, genderOf(spouse.id)?.gender ?? null)
    // Solo el nombre, el requisito PRE-5 y los flags de género. Nada más.
    return NextResponse.json({
      found: true, name: spouse.name, spouse_member_id: spouse.id, meets_requirement: meetsReq,
      same_gender: !genderCheck.ok && genderCheck.code === 'mismo_genero',
      gender_missing: !genderCheck.ok && genderCheck.code === 'genero_faltante' ? genderCheck.who : null,
    })
  } catch (error) {
    console.error('POST prematrimonial/spouse-search:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
