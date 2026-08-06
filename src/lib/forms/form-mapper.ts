// Mapea el payload del builder (FormTemplate / FormFieldNew) a inputs DB.

import type { FormWriteInput, FieldInput } from '@/lib/supabase/queries/forms'

export function formToWriteInput(body: Record<string, unknown>): FormWriteInput {
  return {
    title: String(body.name ?? body.title ?? ''),
    description: (body.description as string) ?? null,
    category: (body.category as string) ?? null,
    entity_type: (body.entity_type as FormWriteInput['entity_type']) ?? null,
    entity_id: (body.entity_id as string) ?? null,
    slug: (body.slug as string) ?? null,
    is_active: body.is_active === undefined ? undefined : Boolean(body.is_active),
    // Abierto a cualquiera con el link. Por defecto NO: un formulario sin
    // audiencia definida no es para cualquiera (2026-08-06).
    is_public: Boolean(body.is_public),
    ...heroFrom(body),
  }
}

/** FRM-2 · Campos del encabezado, normalizados: vacío o solo espacios = null,
 *  para que "borré el título" quede como sin título y no como cadena vacía. */
function heroFrom(body: Record<string, unknown>): Pick<FormWriteInput, 'hero_image_url' | 'hero_title' | 'hero_subtitle'> {
  const limpio = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s === '' ? null : s
  }
  return {
    hero_image_url: limpio(body.hero_image_url),
    hero_title: limpio(body.hero_title),
    hero_subtitle: limpio(body.hero_subtitle),
  }
}

export function formToPartialWriteInput(body: Record<string, unknown>): Partial<FormWriteInput> {
  const out: Partial<FormWriteInput> = {}
  if ('name' in body || 'title' in body) out.title = String(body.name ?? body.title)
  if ('description' in body) out.description = (body.description as string) ?? null
  if ('category' in body) out.category = (body.category as string) ?? null
  if ('entity_type' in body) out.entity_type = body.entity_type as FormWriteInput['entity_type']
  if ('entity_id' in body) out.entity_id = (body.entity_id as string) ?? null
  if ('slug' in body) out.slug = (body.slug as string) ?? null
  if ('is_active' in body) out.is_active = Boolean(body.is_active)
  if ('is_public' in body) out.is_public = Boolean(body.is_public)
  const hero = heroFrom(body)
  if ('hero_image_url' in body) out.hero_image_url = hero.hero_image_url
  if ('hero_title' in body) out.hero_title = hero.hero_title
  if ('hero_subtitle' in body) out.hero_subtitle = hero.hero_subtitle
  return out
}

type RawField = {
  id?: string
  type?: string
  field_type?: string
  label?: string
  placeholder?: string
  helper_text?: string
  description?: string
  is_required?: boolean
  options?: unknown
  logic_rules?: unknown
  conditions?: unknown
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string
}

export function formToFields(body: Record<string, unknown>): FieldInput[] {
  if (!Array.isArray(body.fields)) return []
  return (body.fields as RawField[]).map((f) => ({
    id: f.id,
    field_type: f.field_type ?? f.type ?? 'text',
    options_source: (f as { options_source?: string | null }).options_source ?? null,
    options_source_param: (f as { options_source_param?: string | null }).options_source_param ?? null,
    label: f.label ?? '',
    placeholder: f.placeholder ?? null,
    help_text: f.helper_text ?? null,
    description: f.description ?? null,
    is_required: Boolean(f.is_required),
    options: f.options ?? null,
    conditions: f.logic_rules ?? f.conditions ?? null,
    scale_min: f.scale_min ?? null,
    scale_max: f.scale_max ?? null,
    scale_min_label: f.scale_min_label ?? null,
    scale_max_label: f.scale_max_label ?? null,
  }))
}
