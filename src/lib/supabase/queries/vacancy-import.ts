import { createAdminClient, type Insertable } from '@/lib/supabase/admin'

// Importación bulk de VACANTES desde Excel. A diferencia de los puestos, la vacante
// NO trae contenido propio: se liga a un puesto EXISTENTE (hereda descripción/
// funciones/perfil) igual que "Solicitar vacante". Validación estricta fila por
// fila: la combinación Área → Comité → Puesto debe ser coherente y existir, porque
// Excel no limpia las celdas hijas si el usuario cambia el área después de elegir.

export type ImportVacancyRow = {
  area: string
  committee: string
  position: string
  slots?: number | string | null
  schedule?: string | null
  commitment?: string | null
  expires_at?: string | null
  location?: string | null
  is_featured?: boolean
}

export type VacancyImportResult = {
  inserted: number
  errors: Array<{ row: number; reason: string }>
}

const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export async function importVacancies(rows: ImportVacancyRow[]): Promise<VacancyImportResult> {
  const supabase = createAdminClient()

  const [{ data: areasData }, { data: commData }, { data: posData }] = await Promise.all([
    supabase.from('areas').select('id, name').eq('area_type', 'area').eq('is_active', true),
    supabase.from('areas').select('id, name, parent_id').eq('area_type', 'committee').eq('is_active', true),
    supabase.from('service_positions').select('id, title, area_id').eq('is_active', true),
  ])

  const areaByName = new Map<string, { id: string }>()
  for (const a of (areasData ?? []) as Array<{ id: string; name: string }>) areaByName.set(norm(a.name), { id: a.id })

  // Un mismo nombre de comité podría repetirse → guardamos lista.
  const commByName = new Map<string, Array<{ id: string; parent_id: string | null }>>()
  for (const c of (commData ?? []) as Array<{ id: string; name: string; parent_id: string | null }>) {
    const k = norm(c.name)
    if (!commByName.has(k)) commByName.set(k, [])
    commByName.get(k)!.push({ id: c.id, parent_id: c.parent_id })
  }

  // Puesto por (comité + título). area_id del puesto = id del comité.
  const posByKey = new Map<string, { id: string; title: string }>()
  for (const p of (posData ?? []) as Array<{ id: string; title: string; area_id: string }>) {
    posByKey.set(`${p.area_id}|${norm(p.title)}`, { id: p.id, title: p.title })
  }

  const errors: VacancyImportResult['errors'] = []
  const toInsert: Record<string, unknown>[] = []

  rows.forEach((r, i) => {
    const rowNum = i + 2 // +1 por índice 0, +1 por la fila de encabezado del Excel
    const areaName = (r.area ?? '').trim()
    const committeeName = (r.committee ?? '').trim()
    const positionTitle = (r.position ?? '').trim()

    if (!areaName || !committeeName || !positionTitle) {
      errors.push({ row: rowNum, reason: 'Área, comité y puesto son obligatorios.' })
      return
    }

    const area = areaByName.get(norm(areaName))
    if (!area) { errors.push({ row: rowNum, reason: `El área "${areaName}" no existe.` }); return }

    const candidates = commByName.get(norm(committeeName)) ?? []
    if (candidates.length === 0) {
      errors.push({ row: rowNum, reason: `El comité "${committeeName}" no existe.` }); return
    }
    const committee = candidates.find(c => c.parent_id === area.id)
    if (!committee) {
      errors.push({ row: rowNum, reason: `El comité "${committeeName}" no pertenece al área "${areaName}".` }); return
    }

    const pos = posByKey.get(`${committee.id}|${norm(positionTitle)}`)
    if (!pos) {
      errors.push({ row: rowNum, reason: `El puesto "${positionTitle}" no pertenece al comité "${committeeName}".` }); return
    }

    const slots = Math.max(1, Number(String(r.slots ?? '').replace(/[^\d]/g, '')) || 1)
    toInsert.push({
      committee_id: committee.id,
      position_id: pos.id,
      title: pos.title,
      position: pos.title,
      slots_total: slots,
      schedule: r.schedule?.toString().trim() || null,
      commitment: r.commitment?.toString().trim() || null,
      expires_at: r.expires_at || null,
      location: r.location?.toString().trim() || null,
      is_featured: !!r.is_featured,
      status: 'published',
      published_at: new Date().toISOString(),
    })
  })

  let inserted = 0
  if (toInsert.length > 0) {
    const { error } = await supabase.from('vacancies').insert(toInsert as Insertable<'vacancies'>[])
    if (error) throw error
    inserted = toInsert.length
  }

  return { inserted, errors }
}
