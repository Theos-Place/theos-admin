import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { findSpouseByContact, hasCompletedN2 } from '@/lib/supabase/queries/prematrimonial'

// Búsqueda del cónyuge por cédula/email/teléfono (exacta). PRIVACIDAD: solo se
// devuelve el nombre + si cumple el requisito (N2), nunca otros datos.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const query = body?.query
    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Ingresá cédula, correo o teléfono de tu pareja.' }, { status: 400 })
    }
    // Miembro que se inscribe (para excluirlo como su propia pareja). Un admin/
    // direccion puede buscar en nombre de otro (on_behalf_of); otros roles no.
    let enrolleeId = auth.ctx.memberId
    const onBehalfOf = typeof body?.on_behalf_of === 'string' ? body.on_behalf_of.trim() : ''
    if (onBehalfOf && onBehalfOf !== auth.ctx.memberId) {
      const isPrivileged = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('direccion')
      if (isPrivileged) enrolleeId = onBehalfOf
    }
    const spouse = await findSpouseByContact(query)
    if (!spouse) {
      return NextResponse.json({
        found: false,
        message: 'No encontramos a la pareja en el sistema. Verificá los datos o escribí a estudios@theosplace.org',
      })
    }
    // No puede ser el mismo miembro que se inscribe.
    if (spouse.id === enrolleeId) {
      return NextResponse.json({ found: false, message: 'La pareja no puede ser el mismo miembro que se inscribe.' })
    }
    const hasN2 = await hasCompletedN2(spouse.id)
    // Solo el nombre (y si cumple el requisito). Nada más.
    return NextResponse.json({ found: true, name: spouse.name, spouse_member_id: spouse.id, has_n2: hasN2 })
  } catch (error) {
    console.error('POST prematrimonial/spouse-search:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
