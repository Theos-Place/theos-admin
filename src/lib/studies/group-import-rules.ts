// EST-2: validación por fila del import masivo de grupos de estudio (módulo
// puro — el contexto con los catálogos se arma en group-import.ts). Reglas:
//   · plan obligatorio y existente (por código, ej. N1);
//   · zona opcional: vacía = "Todas las zonas"; si viene, debe existir en el
//     catálogo de sedes (el import NO crea zonas — un typo masivo ensuciaría
//     el catálogo; para zonas nuevas está el combobox del form);
//   · dirigente SOLO por cédula normalizada contra members: vacía o sin match
//     → el grupo se crea SIN dirigente y se reporta como advertencia;
//   · fechas coherentes (inicio <= fin) y ventana de matrícula válida (GRU-1).

import { validateEnrollmentDates } from '@/lib/studies/enrollment-window'
import { normalizeCedula } from '@/lib/cedula'

export type GroupImportRow = {
  plan: string
  zona?: string
  dia?: string
  horario?: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  cupo?: string | number | null
  cedula_dirigente?: string
  inicio_matricula?: string | null
  fin_matricula?: string | null
}

export type GroupImportContext = {
  /** código de plan (UPPER) → { id, level } */
  plansByCode: Map<string, { id: string; level: string | null }>
  /** nombre/código de sede normalizados → code */
  zoneCodeByName: Map<string, string>
  /** cédula normalizada → member_id */
  leaderIdByCedula: Map<string, string>
}

export type GroupInsertRow = {
  plan_id: string
  plan_code: string
  plan_level: string | null
  name: string
  zone: string | null
  schedule_days: string[]
  schedule_time: string | null
  starts_at: string | null
  ends_at: string | null
  max_students: number | null
  leader_id: string | null
  enrollment_start_date: string | null
  enrollment_end_date: string | null
  status: 'en_matricula'
}

export type GroupRowValidation =
  | { ok: true; insert: GroupInsertRow; warning?: string }
  | { ok: false; reason: string }

export const normText = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export function validateGroupImportRow(r: GroupImportRow, ctx: GroupImportContext): GroupRowValidation {
  const planCode = (r.plan ?? '').trim().toUpperCase()
  if (!planCode) return { ok: false, reason: 'El plan (código) es obligatorio.' }
  const plan = ctx.plansByCode.get(planCode)
  if (!plan) return { ok: false, reason: `El plan "${planCode}" no existe.` }

  const zonaRaw = (r.zona ?? '').trim()
  let zone: string | null = null
  if (zonaRaw) {
    const code = ctx.zoneCodeByName.get(normText(zonaRaw))
    if (!code) return { ok: false, reason: `La zona/sede "${zonaRaw}" no existe en el catálogo.` }
    zone = code
  }

  const starts_at = r.fecha_inicio?.trim() || null
  const ends_at = r.fecha_fin?.trim() || null
  if (starts_at && ends_at && starts_at > ends_at) {
    return { ok: false, reason: 'La fecha de inicio no puede ser después de la fecha de fin.' }
  }

  const enrollment_start_date = r.inicio_matricula?.trim() || null
  const enrollment_end_date = r.fin_matricula?.trim() || null
  const windowError = validateEnrollmentDates({ enrollment_start_date, enrollment_end_date, starts_at })
  if (windowError) return { ok: false, reason: windowError }

  let max_students: number | null = null
  if (r.cupo !== undefined && r.cupo !== null && String(r.cupo).trim() !== '') {
    const n = Number(String(r.cupo).replace(/[^\d]/g, ''))
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: `Cupo inválido: "${r.cupo}".` }
    max_students = n
  }

  let leader_id: string | null = null
  let warning: string | undefined
  const ced = (r.cedula_dirigente ?? '').trim()
  if (ced) {
    leader_id = ctx.leaderIdByCedula.get(normalizeCedula(ced)) ?? null
    if (!leader_id) warning = `Cédula de dirigente "${ced}" sin match: el grupo se crea sin dirigente.`
  }

  const dia = (r.dia ?? '').trim()
  return {
    ok: true,
    warning,
    insert: {
      plan_id: plan.id,
      plan_code: planCode,
      plan_level: plan.level,
      name: `${planCode} — ${zonaRaw || 'Todas las zonas'}`,
      zone,
      schedule_days: dia ? [dia] : [],
      schedule_time: r.horario?.trim() || null,
      starts_at,
      ends_at,
      max_students,
      leader_id,
      enrollment_start_date,
      enrollment_end_date,
      status: 'en_matricula',
    },
  }
}
