import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getDirigentesContact } from '@/lib/supabase/queries/studies'

// POST /api/studies/dirigentes/contact → contacto + sede para enriquecer la
// exportación de dirigentes. PII: gated a roles que gestionan dirigentes (no a
// cualquier sesión). Body: { member_ids: string[] } → { contact: { id: {...} } }.
export async function POST(req: NextRequest) {
  const auth = await requireRoles('admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const body = await req.json() as { member_ids?: string[] }
    const ids = Array.isArray(body.member_ids) ? body.member_ids.filter(x => typeof x === 'string') : []
    const contact = await getDirigentesContact(ids)
    return NextResponse.json({ contact })
  } catch (error) {
    console.error('POST /api/studies/dirigentes/contact:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
