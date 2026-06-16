/**
 * Upsert de miembros desde el Excel maestro (scripts/data/Maestro_Asistentes.xlsx,
 * hoja "Total"). Match por members.external_id (= "Individual ID" de PCO, int→text).
 *
 * Solo actualiza DATOS DE PERFIL: first_name, last_name, email, phone, birth_date,
 * gender. NO toca estado de donador/servidor (esos son dinámicos:
 * vw_active_donors y volunteers.status). NO importa rangos de edad ni SCJ.
 *
 * Reglas:
 *  - Existe (por external_id): actualiza solo los campos que vengan distintos y
 *    NO vacíos en el Excel (no pisa un dato de la BD con un vacío del Excel).
 *  - No existe: inserta con is_active=true + external_id + rol 'miembro'.
 *  - Email único: si el email del Excel ya pertenece a OTRO miembro, NO rompe —
 *    registra el conflicto en scripts/output/members-email-conflicts.csv (por
 *    Individual ID, nunca el email/nombre en consola) y omite ese campo.
 *  - Batches de 100. No aborta por error individual.
 *  - El resumen final es SOLO conteos (sin datos personales).
 *
 * Privacidad: el archivo va en scripts/data/ (gitignored) y NO se commitea.
 *
 * Dry-run (no escribe nada):  npx tsx scripts/seed-members-upsert.ts --dry-run
 * Ejecución real:             npx tsx scripts/seed-members-upsert.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const FILE = new URL('./data/Maestro_Asistentes.xlsx', import.meta.url)
const SHEET = 'Total'

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
// Cliente service-role (equivalente a createAdminClient para scripts).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

// ── Normalizadores ───────────────────────────────────────────────────────────
const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => {
  if (typeof v === 'number') return String(Math.trunc(v))
  return str(v).replace(/\.0$/, '')
}
const normEmail = (v: unknown): string => str(v).toLowerCase()
const normPhone = (v: unknown): string => str(v).replace(/[\s\-().]/g, '')
function normGender(v: unknown): string | null {
  const s = str(v).toLowerCase()
  if (s === 'f' || s === 'femenino' || s === 'female') return 'F'
  if (s === 'm' || s === 'masculino' || s === 'male') return 'M'
  return null // NA / - / vacío / cualquier otro
}
function toDateStr(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    // Componentes UTC: SheetJS arma las fechas en UTC; evita correr el día por tz.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  }
  const s = str(v)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  return null
}

type DbMember = { id: string; external_id: string | null; first_name: string; last_name: string; email: string | null; phone: string | null; birth_date: string | null; gender: string | null }
const PROFILE_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'birth_date', 'gender'] as const
type ProfileField = (typeof PROFILE_FIELDS)[number]

async function main() {
  if (!existsSync(FILE)) {
    console.error(`No se encontró ${FILE.pathname}. Subí el Excel a scripts/data/Maestro_Asistentes.xlsx (gitignored).`)
    process.exit(1)
  }
  const wb = XLSX.read(readFileSync(FILE), { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[SHEET]
  if (!sheet) { console.error(`La hoja "${SHEET}" no existe. Hojas: ${wb.SheetNames.join(', ')}`); process.exit(1) }
  const excelRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Excel "${SHEET}": ${excelRows.length.toLocaleString('es-CR')} filas`)

  // ── Cargar miembros existentes (paginado) ──
  const byExtId = new Map<string, DbMember>()
  const emailOwner = new Map<string, string>() // emailLower → member.id
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members')
      .select('id, external_id, first_name, last_name, email, phone, birth_date, gender')
      .order('id')
      .range(from, from + 999)
    if (error) { console.error('Error leyendo members:', error.message); process.exit(1) }
    const batch = (data ?? []) as DbMember[]
    for (const m of batch) {
      if (m.external_id) byExtId.set(m.external_id, m)
      if (m.email) emailOwner.set(m.email.toLowerCase(), m.id)
    }
    if (batch.length < 1000) break
  }
  console.log(`Miembros en BD: ${byExtId.size.toLocaleString('es-CR')} con external_id`)

  // ── Planear cambios ──
  const toInsert: Record<string, unknown>[] = []
  const toUpdate: Array<{ id: string; patch: Record<string, unknown> }> = []
  const emailConflicts: string[] = [] // Individual IDs (sin email/nombre)
  const claimedEmails = new Set<string>() // emails reclamados por inserts en esta corrida
  const fieldChanges: Record<ProfileField, number> = { first_name: 0, last_name: 0, email: 0, phone: 0, birth_date: 0, gender: 0 }
  let unchanged = 0, skippedNoId = 0

  for (const row of excelRows) {
    const id = extId(row['Individual ID'])
    if (!id) { skippedNoId++; continue }

    const mapped: Partial<Record<ProfileField, string | null>> = {
      first_name: str(row['First Name']) || null,
      last_name: str(row['Last Name']) || null,
      email: normEmail(row['Email']) || null,
      phone: normPhone(row['Mobile Phone Number']) || null,
      birth_date: toDateStr(row['Birthdate']),
      gender: normGender(row['Gender']),
    }

    const existing = byExtId.get(id)
    if (existing) {
      const patch: Record<string, unknown> = {}
      for (const f of PROFILE_FIELDS) {
        const val = mapped[f]
        if (val == null || val === '') continue // no pisar con vacío
        if (f === 'email') {
          const cur = existing.email?.toLowerCase() ?? null
          if (val === cur) continue
          const owner = emailOwner.get(val)
          if (owner && owner !== existing.id) { emailConflicts.push(id); continue } // email de otro → omitir
        } else if (f === 'phone') {
          // Comparar por dígitos: no reescribir un teléfono que ya tiene el
          // mismo número pero con otro formato (espacios/guiones) en la BD.
          if (normPhone(existing.phone) === val) continue
        } else if (str(existing[f]) === str(val)) {
          continue // sin cambio
        }
        patch[f] = val
        fieldChanges[f]++
      }
      if (Object.keys(patch).length === 0) unchanged++
      else toUpdate.push({ id: existing.id, patch })
    } else {
      const insertRow: Record<string, unknown> = {
        external_id: id,
        is_active: true,
        first_name: mapped.first_name ?? '',
        last_name: mapped.last_name ?? '',
      }
      if (mapped.phone) insertRow.phone = mapped.phone
      if (mapped.birth_date) insertRow.birth_date = mapped.birth_date
      if (mapped.gender) insertRow.gender = mapped.gender
      if (mapped.email) {
        // Para un miembro NUEVO, cualquier email ya existente (en BD o reclamado
        // por otro insert de esta corrida) es conflicto.
        if (emailOwner.has(mapped.email) || claimedEmails.has(mapped.email)) emailConflicts.push(id)
        else { insertRow.email = mapped.email; claimedEmails.add(mapped.email) }
      }
      toInsert.push(insertRow)
    }
  }

  // ── Reporte de conteos (sin datos personales) ──
  console.log('\n── Plan ──')
  console.log(`  Insertar:        ${toInsert.length.toLocaleString('es-CR')}`)
  console.log(`  Actualizar:      ${toUpdate.length.toLocaleString('es-CR')}`)
  console.log(`  Sin cambios:     ${unchanged.toLocaleString('es-CR')}`)
  console.log(`  Conflictos email:${emailConflicts.length.toLocaleString('es-CR')}`)
  if (skippedNoId) console.log(`  Filas sin Individual ID (saltadas): ${skippedNoId}`)
  console.log(`  Campos a cambiar (updates): ${PROFILE_FIELDS.map(f => `${f}=${fieldChanges[f]}`).join('  ')}`)

  if (emailConflicts.length > 0) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    writeFileSync(new URL('./output/members-email-conflicts.csv', import.meta.url),
      ['individual_id', ...emailConflicts].join('\n'))
    console.log(`  → ${emailConflicts.length} conflictos en scripts/output/members-email-conflicts.csv`)
  }

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada en la BD.'); return }

  // ── Aplicar ──
  let inserted = 0, updated = 0, errors = 0
  // Inserts en batches de 100 (+ rol 'miembro').
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100)
    const { data, error } = await supabase.from('members').insert(batch).select('id')
    if (error) { errors += batch.length; console.error(`Error insert batch ${i / 100}:`, error.message); continue }
    const ids = (data ?? []) as Array<{ id: string }>
    inserted += ids.length
    const roles = ids.map(r => ({ member_id: r.id, role: 'miembro', is_active: true }))
    if (roles.length) {
      const { error: rErr } = await supabase.from('member_roles').insert(roles)
      if (rErr) console.error(`Error roles batch ${i / 100}:`, rErr.message)
    }
  }
  // Updates en chunks de 100 (concurrentes; cada uno con su patch).
  for (let i = 0; i < toUpdate.length; i += 100) {
    const chunk = toUpdate.slice(i, i + 100)
    const results = await Promise.allSettled(
      chunk.map(u => supabase.from('members').update(u.patch).eq('id', u.id)),
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.error) updated++
      else errors++
    }
  }

  console.log('\n── Resultado ──')
  console.log(`  Insertados:       ${inserted.toLocaleString('es-CR')}`)
  console.log(`  Actualizados:     ${updated.toLocaleString('es-CR')}`)
  console.log(`  Sin cambios:      ${unchanged.toLocaleString('es-CR')}`)
  console.log(`  Conflictos email: ${emailConflicts.length.toLocaleString('es-CR')}`)
  console.log(`  Errores:          ${errors.toLocaleString('es-CR')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
