/**
 * La nota que faltaba de Roylin Castrillo en el RDM de Valeria Díaz.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/nota-roylin.ts
 *   aplicar:  ... nota-roylin.ts --aplicar
 *
 * Él ya estaba 'completed' ANTES del cierre, y close_group solo toca las
 * matrículas en 'enrolled' — por eso los otros nueve quedaron con su nota y él
 * no. El formulario de la dirigente le da 94.
 *
 * Solo escribe `grade`: el estado no se toca, porque no está en discusión.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const GRUPO = 'Religiones del mundo. Valeria Díaz. Junio 2026'
const PERSONA = 'Roylin Castrillo Sequeira'
const NOTA = 94

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const db = createAdminClient() as unknown as { from: (t: string) => never }
  const t = (n: string) => db.from(n) as never as {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        maybeSingle: () => Promise<{ data: { id: string } | null }>
        eq: (c2: string, v2: string) => Promise<{ data: Array<{ id: string; status: string; grade: number | null; member: { first_name: string; last_name: string } }> | null }>
      }
    }
    update: (v: unknown) => { eq: (c: string, v2: string) => { is: (c2: string, v3: null) => Promise<{ error: { message: string } | null }> } }
  }

  const { data: g } = await t('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  if (!g) { console.log('✗ grupo no encontrado'); process.exit(1) }

  const { data: filas } = await t('study_enrollments')
    .select('id, status, grade, member:members!study_enrollments_member_id_fkey(first_name, last_name)')
    .eq('group_id', g.id).eq('status', 'completed')
  const f = (filas ?? [])
    .map(x => ({ ...x, member: Array.isArray(x.member) ? x.member[0] : x.member }))
    .find(x => `${x.member.first_name} ${x.member.last_name}` === PERSONA)

  if (!f) { console.log(`✗ ${PERSONA}: no está como aprobado en el grupo`); process.exit(1) }
  if (f.grade !== null) { console.log(`· ${PERSONA}: ya tiene nota (${f.grade}), no se toca`); return }

  console.log(`══ PLAN ══\n  ${PERSONA}: nota — → ${NOTA} (estado 'completed' sin cambios)`)
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  // El `.is('grade', null)` es la guarda: si alguien le puso una nota entre el
  // dry-run y esto, no se la pisa.
  const { error } = await t('study_enrollments').update({ grade: NOTA }).eq('id', f.id).is('grade', null)
  if (error) { console.log(`  ✗ ${error.message}`); process.exit(1) }
  console.log(`\n  ✓ ${PERSONA}: nota ${NOTA}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
