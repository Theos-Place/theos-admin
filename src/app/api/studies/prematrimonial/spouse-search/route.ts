import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { findSpouseByContact, hasCompletedN2 } from '@/lib/supabase/queries/prematrimonial'

// Búsqueda del cónyuge por cédula/email/teléfono (exacta). PRIVACIDAD: solo se
// devuelve el nombre + si cumple el requisito (N2), nunca otros datos.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { query } = await req.json()
    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Ingresá cédula, correo o teléfono de tu pareja.' }, { status: 400 })
    }
    const spouse = await findSpouseByContact(query)
    if (!spouse) {
      return NextResponse.json({
        found: false,
        message: 'No encontramos a tu pareja en el sistema. Verificá los datos o escribí a estudios@theosplace.org',
      })
    }
    // No puede ser uno mismo.
    if (spouse.id === auth.ctx.memberId) {
      return NextResponse.json({ found: false, message: 'No podés seleccionarte a vos mismo como pareja.' })
    }
    const hasN2 = await hasCompletedN2(spouse.id)
    // Solo el nombre (y si cumple el requisito). Nada más.
    return NextResponse.json({ found: true, name: spouse.name, spouse_member_id: spouse.id, has_n2: hasN2 })
  } catch (error) {
    console.error('POST prematrimonial/spouse-search:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
