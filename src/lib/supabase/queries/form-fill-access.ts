// Resuelve contra la base las señales que necesita formFillAccess (regla pura
// en @/lib/forms/fill-access). Una sola función para que el guard del endpoint
// y el de la pantalla digan siempre lo mismo.
import { createAdminClient } from '@/lib/supabase/admin'
import { formFillAccess, type FillAccess } from '@/lib/forms/fill-access'
import { isSelectionForm } from '@/lib/forms/selection-rules'
import { CONVOKED_STATUS, CONVOKED_RECOMMENDATION_PREFIX } from '@/lib/supabase/queries/form-selection'
import { getFormById } from '@/lib/supabase/queries/forms'
import type { SupabaseClient } from '@supabase/supabase-js'

/** ¿A este miembro se le mandó un correo con el link de ESTE formulario?
 *  Es la señal más fiel de "fue convocado": no depende de cómo se armó la
 *  audiencia, solo de que el correo salió. */
async function wasSentFormLink(
  sb: SupabaseClient,
  formId: string,
  memberId: string,
): Promise<boolean> {
  const { data } = await sb
    .from('message_logs')
    .select('id, broadcast:message_broadcasts!inner(body)')
    .eq('member_id', memberId)
    .like('broadcast.body', `%/formularios/${formId}/%`)
    .limit(1)
  return ((data ?? []) as unknown[]).length > 0
}

export async function memberFormFillAccess(input: {
  formId: string
  memberId: string | null
  /** Tiene el módulo formularios o un acceso puntual a este formulario. */
  isStaff: boolean
}): Promise<FillAccess> {
  if (input.isStaff) return { allowed: true }
  if (!input.memberId) {
    return { allowed: false, reason: 'Necesitás entrar con tu cuenta para llenar este formulario.' }
  }
  const sb = createAdminClient() as unknown as SupabaseClient
  const form = await getFormById(input.formId)
  if (!form) return { allowed: false, reason: 'Formulario no encontrado.' }

  const f = form as unknown as {
    entity_type: string | null
    entity_id: string | null
    is_public: boolean | null
    fields: Array<{ options_source?: string | null; options_source_param?: string | null }>
  }

  const [yaRespondio, leLlego] = await Promise.all([
    sb.from('form_responses').select('id').eq('form_id', input.formId).eq('member_id', input.memberId).limit(1)
      .then(r => ((r.data ?? []) as unknown[]).length > 0),
    wasSentFormLink(sb, input.formId, input.memberId),
  ])

  let inscritoEvento = false
  let matriculadoGrupo = false
  if (f.entity_type === 'event' && f.entity_id) {
    const { data } = await sb.from('event_registrations').select('id')
      .eq('event_id', f.entity_id).eq('member_id', input.memberId).limit(1)
    inscritoEvento = ((data ?? []) as unknown[]).length > 0
  }
  if (f.entity_type === 'study_group' && f.entity_id) {
    const { data } = await sb.from('study_enrollments').select('id')
      .eq('group_id', f.entity_id).eq('member_id', input.memberId)
      .in('status', ['enrolled', 'waitlist', 'completed']).limit(1)
    matriculadoGrupo = ((data ?? []) as unknown[]).length > 0
  }

  // Formulario de selección (preinscripción): la audiencia son los recomendados
  // con un "sí" en EST-9. Se consulta solo si hace falta.
  const esSeleccion = isSelectionForm((f.fields ?? []) as Parameters<typeof isSelectionForm>[0])
  let convocado = false
  if (esSeleccion && !leLlego && !yaRespondio) {
    // MISMO criterio que la lista de convocatoria (form-selection): una
    // recomendación ya ENVIADA que dice que sí. Sin el filtro de status, una
    // recomendación en borrador dejaba entrar a alguien que todavía no fue
    // convocado.
    const { data } = await sb.from('cdeb_recommendations')
      .select('id')
      .eq('member_id', input.memberId)
      .eq('status', CONVOKED_STATUS)
      .like('recommendation', CONVOKED_RECOMMENDATION_PREFIX)
      .limit(1)
    convocado = ((data ?? []) as unknown[]).length > 0
  }

  return formFillAccess({
    isStaff: false,
    entityType: f.entity_type,
    isEventRegistrant: inscritoEvento,
    isGroupEnrolled: matriculadoGrupo,
    hasConvocationList: esSeleccion,
    isConvoked: convocado,
    wasSentLink: leLlego,
    hasResponded: yaRespondio,
    isPublic: !!f.is_public,
  })
}
