import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { FORM_ON_BEHALF_ROLES } from '@/lib/auth/on-behalf'
import { isUuid } from '@/lib/validate'

/**
 * GET /api/forms/[id]/members/[memberId] — los datos personales de la persona
 * POR LA QUE se está llenando un formulario.
 *
 * Por qué no se usa /api/members/[id]: ese exige el módulo miembros, y el rol
 * `forms` —justamente el que llena formularios a nombre de otros— no lo tiene.
 * Pedirlo desde ahí daba 403 y el bloque de datos personales salía todo en "—"
 * sin decir por qué (mismo patrón que el QR del check-in, 2026-09-09).
 *
 * Devuelve SOLO las columnas que el bloque de datos personales muestra. No es el
 * perfil: nada de donaciones, roles, historial ni notas. Y cuelga de la ruta del
 * formulario a propósito, igual que los endpoints del check-in: el permiso queda
 * atado al contexto donde tiene sentido.
 */
const COLUMNAS = [
  'id', 'first_name', 'last_name', 'birth_date', 'gender', 'marital_status',
  'cedula', 'document_type', 'phone', 'email', 'address', 'province', 'canton', 'district',
  'occupation', 'workplace', 'allergies', 'medications',
  'dietary_restrictions', 'dietary_restrictions_other',
  'emergency_contact_name', 'emergency_contact_phone',
].join(', ')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const auth = await requireRoles(...FORM_ON_BEHALF_ROLES)
  if (auth.res) return auth.res
  try {
    const { id: formId, memberId } = await params
    if (!isUuid(formId) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()

    const { data: form } = await sb.from('forms').select('id').eq('id', formId).maybeSingle()
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })

    const { data, error } = await sb.from('members').select(COLUMNAS).eq('id', memberId).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/forms/[id]/members/[memberId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
