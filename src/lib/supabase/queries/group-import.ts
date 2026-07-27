import { createAdminClient, type Insertable } from '@/lib/supabase/admin'
import { validateGroupImportRow, normText, type GroupImportRow, type GroupImportContext } from '@/lib/studies/group-import-rules'
import { normalizeCedula } from '@/lib/cedula'
import { groupLocksLeader } from '@/lib/studies/leader-activation'
import { setDirigenteActive } from '@/lib/supabase/queries/studies'

// EST-2: importación masiva de grupos de estudio desde CSV/XLSX. Import
// PARCIAL (como donaciones): las filas inválidas se reportan y no se insertan.
// dryRun valida todo sin escribir — es el preview del wizard.

export type GroupImportResult = {
  inserted: number
  valid: number
  errors: Array<{ row: number; reason: string }>
  warnings: Array<{ row: number; reason: string }>
}

export async function importStudyGroups(
  rows: GroupImportRow[],
  opts: { dryRun?: boolean } = {},
): Promise<GroupImportResult> {
  const supabase = createAdminClient()

  // Catálogos para el contexto de validación.
  const [{ data: plansData }, { data: sedesData }] = await Promise.all([
    supabase.from('study_plans').select('id, code, level').not('code', 'is', null),
    supabase.from('sedes').select('code, name'),
  ])
  const plansByCode = new Map<string, { id: string; level: string | null }>()
  for (const p of (plansData ?? []) as Array<{ id: string; code: string; level: string | null }>) {
    plansByCode.set(p.code.toUpperCase(), { id: p.id, level: p.level })
  }
  const zoneCodeByName = new Map<string, string>()
  for (const s of (sedesData ?? []) as Array<{ code: string; name: string | null }>) {
    zoneCodeByName.set(normText(s.code), s.code)
    if (s.name) zoneCodeByName.set(normText(s.name), s.code)
  }

  // Dirigentes: SOLO por cédula normalizada (chunks de 200 para no reventar la URL).
  const cedulas = [...new Set(rows.map(r => normalizeCedula((r.cedula_dirigente ?? '').trim())).filter(Boolean))]
  const leaderIdByCedula = new Map<string, string>()
  for (let i = 0; i < cedulas.length; i += 200) {
    const { data } = await supabase
      .from('members').select('id, cedula_normalized')
      .in('cedula_normalized', cedulas.slice(i, i + 200))
    for (const m of (data ?? []) as Array<{ id: string; cedula_normalized: string | null }>) {
      if (m.cedula_normalized) leaderIdByCedula.set(m.cedula_normalized, m.id)
    }
  }

  const ctx: GroupImportContext = { plansByCode, zoneCodeByName, leaderIdByCedula }
  const errors: GroupImportResult['errors'] = []
  const warnings: GroupImportResult['warnings'] = []
  const inserts: Array<{ insert: Record<string, unknown>; plan_level: string | null; leader_id: string | null }> = []

  rows.forEach((r, i) => {
    const rowNum = i + 2 // +1 índice 0, +1 encabezado del archivo
    const v = validateGroupImportRow(r, ctx)
    if (!v.ok) { errors.push({ row: rowNum, reason: v.reason }); return }
    if (v.warning) warnings.push({ row: rowNum, reason: v.warning })
    const { plan_code: _code, plan_level, ...insert } = v.insert
    void _code
    inserts.push({ insert, plan_level, leader_id: v.insert.leader_id })
  })

  if (opts.dryRun || inserts.length === 0) {
    return { inserted: 0, valid: inserts.length, errors, warnings }
  }

  let inserted = 0
  for (let i = 0; i < inserts.length; i += 100) {
    const slice = inserts.slice(i, i + 100)
    const { error } = await supabase
      .from('study_groups')
      .insert(slice.map(s => s.insert) as Insertable<'study_groups'>[])
    if (error) throw error
    inserted += slice.length
  }

  // EST-1: dirigente asignado a grupo activo → activo (salvo campañas).
  // Best-effort: no revierte el import.
  const toActivate = [...new Set(inserts.filter(s => s.leader_id && groupLocksLeader(s.plan_level)).map(s => s.leader_id!))]
  for (const lid of toActivate) {
    try { await setDirigenteActive(lid, true) } catch (e) { console.warn('import leader activation:', e) }
  }

  return { inserted, valid: inserts.length, errors, warnings }
}
