import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkFamilyMember } from '@/lib/supabase/queries/members-mutations'

/**
 * Crea la ficha de un menor con datos protegidos y la cuelga de su familia.
 *
 * Las dos cosas van juntas y en este orden por una razón: una ficha de menor
 * sin adulto detrás es exactamente lo que no debe existir — nadie sabría a
 * quién preguntarle por él. Si el vínculo falla, la ficha se borra: es mejor
 * que el alta se caiga y se reintente a dejar un menor suelto en el padrón.
 *
 * Nunca se le crea cuenta de acceso. No hay parámetro para pedirlo.
 */
export async function crearMenorProtegido(
  ficha: { first_name: string; last_name: string; birth_date: string; datos_protegidos: true; is_active: true },
  familiarId: string,
  relacion = 'Hijo/a',
): Promise<{ id: string; first_name: string; last_name: string; family_unit_id: string }> {
  const sb = createAdminClient()

  const { data: familiar } = await sb.from('members')
    .select('id, datos_protegidos').eq('id', familiarId).maybeSingle()
  const f = familiar as { id: string; datos_protegidos: boolean | null } | null
  if (!f) throw new Error('FAMILIAR_NO_EXISTE')
  // Colgar un menor de otro menor protegido no resuelve nada: la cadena
  // seguiría sin llegar a un adulto responsable.
  if (f.datos_protegidos) throw new Error('FAMILIAR_ES_MENOR_PROTEGIDO')

  const { data, error } = await sb.from('members').insert(ficha).select('id, first_name, last_name').single()
  if (error) throw error
  const creado = data as { id: string; first_name: string; last_name: string }

  try {
    const { family_unit_id } = await linkFamilyMember(familiarId, creado.id, relacion, null)
    return { ...creado, family_unit_id }
  } catch (e) {
    await sb.from('members').delete().eq('id', creado.id)
    throw e
  }
}
