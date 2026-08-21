// DIR-1 · Insumo para el coordinador de dirigentes: las respuestas del
// formulario de disponibilidad AL LADO del estado actual del dirigente.
//
// DECISIÓN: las respuestas NO actualizan nada automáticamente. Un cambio
// automático movería asignaciones sin criterio humano. El coordinador lee, decide
// y aplica los cambios con los flujos que ya existen (/estudios/dirigentes).

import { createAdminClient } from '@/lib/supabase/admin'

/** Prefijo del slug con el que el seed marca estos formularios. */
export const AVAILABILITY_SLUG_PREFIX = 'disponibilidad-dirigentes'

export type AvailabilityForm = {
  id: string
  title: string
  slug: string | null
  created_at: string
  responses: number
}

export type LeaderAvailabilityRow = {
  response_id: string
  submitted_at: string
  member_id: string | null
  member_name: string
  /** Respuestas del formulario: etiqueta de la pregunta → respuesta legible. */
  answers: Array<{ label: string; value: string }>
  /** Estado ACTUAL del dirigente. null = quien respondió no es dirigente. */
  leader: {
    availability_status: string
    is_active: boolean
    zone_preference: string[]
    qualified_study_codes: string[]
    formation_study_codes: string[]
  } | null
}

/** Los formularios de disponibilidad (uno por ciclo), con su conteo. */
export async function getAvailabilityForms(): Promise<AvailabilityForm[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('forms')
    .select('id, title, slug, created_at')
    .like('slug', `${AVAILABILITY_SLUG_PREFIX}%`)
    .order('created_at', { ascending: false })
  if (error) throw error
  const forms = (data ?? []) as Array<{ id: string; title: string; slug: string | null; created_at: string }>
  if (forms.length === 0) return []

  const { data: counts } = await supabase
    .from('form_responses').select('form_id').in('form_id', forms.map(f => f.id))
  const porForm = new Map<string, number>()
  for (const r of (counts ?? []) as Array<{ form_id: string }>) {
    porForm.set(r.form_id, (porForm.get(r.form_id) ?? 0) + 1)
  }
  return forms.map(f => ({ ...f, responses: porForm.get(f.id) ?? 0 }))
}

/** Valor legible de una respuesta (los multi-select vienen como array json). */
function readable(v: { value_text: string | null; value_json: unknown }): string {
  if (Array.isArray(v.value_json)) return (v.value_json as unknown[]).map(String).join(', ')
  if (v.value_json && typeof v.value_json === 'object') return JSON.stringify(v.value_json)
  return (v.value_text ?? '').trim()
}

/** Respuestas de un formulario de disponibilidad, con el estado del dirigente. */
export async function getLeaderAvailabilityResponses(formId: string): Promise<LeaderAvailabilityRow[]> {
  const supabase = createAdminClient()

  // Etiquetas de las preguntas, en el orden del formulario. Los bloques sin
  // input (info/section) no son preguntas y no van en la tabla.
  const { data: fieldRows } = await supabase
    .from('form_fields')
    .select('id, label, field_type, sort_order')
    .eq('form_id', formId)
    .order('sort_order', { ascending: true })
  const fields = (fieldRows ?? []) as Array<{ id: string; label: string; field_type: string; sort_order: number }>
  const preguntas = fields.filter(f => !['info', 'section', 'section_header', 'page_break', 'personal_data'].includes(f.field_type))
  const labelById = new Map(preguntas.map(f => [f.id, f.label]))
  const ordenById = new Map(preguntas.map(f => [f.id, f.sort_order]))

  const { data: respRows, error } = await supabase
    .from('form_responses')
    .select(`
      id, member_id, submitted_at,
      member:members(first_name, last_name),
      values:form_response_values(field_id, value_text, value_json)
    `)
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw error

  const responses = (respRows ?? []) as Array<{
    id: string; member_id: string | null; submitted_at: string
    member: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    values: Array<{ field_id: string; value_text: string | null; value_json: unknown }> | null
  }>
  if (responses.length === 0) return []

  // Estado actual de quienes respondieron (una query, no una por fila).
  const memberIds = [...new Set(responses.map(r => r.member_id).filter(Boolean) as string[])]
  const leaderByMember = new Map<string, LeaderAvailabilityRow['leader']>()
  if (memberIds.length > 0) {
    const { data: leaders } = await supabase
      .from('study_leaders')
      .select('member_id, availability_status, is_active, zone_preference, qualified_study_codes, formation_study_codes')
      .in('member_id', memberIds)
    for (const l of (leaders ?? []) as Array<Record<string, unknown>>) {
      leaderByMember.set(l.member_id as string, {
        availability_status: (l.availability_status as string) ?? 'available',
        is_active: l.is_active !== false,
        zone_preference: (l.zone_preference as string[]) ?? [],
        qualified_study_codes: (l.qualified_study_codes as string[]) ?? [],
        formation_study_codes: (l.formation_study_codes as string[]) ?? [],
      })
    }
  }

  return responses.map(r => {
    const m = Array.isArray(r.member) ? r.member[0] : r.member
    const answers = (r.values ?? [])
      .filter(v => labelById.has(v.field_id))
      .map(v => ({
        label: labelById.get(v.field_id) as string,
        value: readable(v),
        _o: ordenById.get(v.field_id) ?? 0,
      }))
      .filter(a => a.value !== '')
      .sort((a, b) => a._o - b._o)
      .map(({ label, value }) => ({ label, value }))

    return {
      response_id: r.id,
      submitted_at: r.submitted_at,
      member_id: r.member_id,
      member_name: m ? `${m.first_name} ${m.last_name}`.trim() : 'Invitado',
      answers,
      leader: r.member_id ? (leaderByMember.get(r.member_id) ?? null) : null,
    }
  })
}
