/** UX-5 · ¿Cuánto tarda /api/auth/me y en qué se le va el tiempo? */
import { createAdminClient } from '@/lib/supabase/admin'

const t = async <T>(nombre: string, fn: () => Promise<T>): Promise<[string, number, T]> => {
  const t0 = performance.now()
  const r = await fn()
  return [nombre, Math.round(performance.now() - t0), r]
}

async function main() {
  const admin = createAdminClient()
  // Una persona con roles, familia y puestos: el caso caro, no el vacío.
  const { data: m } = await admin.from('members')
    .select('id, first_name, last_name').not('auth_user_id', 'is', null)
    .eq('is_active', true).limit(1).single()
  const memberId = (m as { id: string }).id
  console.log(`medido sobre ${(m as { first_name: string; last_name: string }).first_name} ${(m as { last_name: string }).last_name}\n`)

  const pasos: Array<[string, () => Promise<unknown>]> = [
    ['members por auth_user_id', () => admin.from('members').select('id, first_name, last_name, email, cedula, is_system, is_active').eq('id', memberId).maybeSingle()],
    ['member_roles', () => admin.from('member_roles').select('role').eq('member_id', memberId).eq('is_active', true)],
    ['family_members (propias)', () => admin.from('family_members').select('family_unit_id').eq('member_id', memberId)],
    ['family_members (compartidas)', async () => {
      const { data } = await admin.from('family_members').select('family_unit_id').eq('member_id', memberId)
      const ids = (data ?? []).map(r => (r as { family_unit_id: string }).family_unit_id)
      if (!ids.length) return null
      return admin.from('family_members').select('member_id').in('family_unit_id', ids)
    }],
    ['isStudyCommitteeMember', async () => (await import('@/lib/supabase/queries/study-requests')).isStudyCommitteeMember(memberId)],
    ['getGrantedFormIds', async () => (await import('@/lib/supabase/queries/forms')).getGrantedFormIds(memberId)],
    ['getManagedEventIds', async () => (await import('@/lib/supabase/queries/events')).getManagedEventIds(memberId)],
    ['notice_dismissals', () => admin.from('notice_dismissals').select('dismissed_at').eq('member_id', memberId).eq('notice_key', 'document_prompt').maybeSingle()],
  ]

  // ── EN FILA, como hoy ──
  let serie = 0
  console.log('EN FILA (como está hoy):')
  for (const [nombre, fn] of pasos) {
    const [n, ms] = await t(nombre, fn)
    serie += ms
    console.log(`  ${String(ms).padStart(5)} ms  ${n}`)
  }
  console.log(`  ${String(serie).padStart(5)} ms  TOTAL`)

  // ── EN PARALELO, todo lo que no depende de lo anterior ──
  const t0 = performance.now()
  await Promise.all(pasos.slice(1).map(([, fn]) => fn()))
  const paralelo = Math.round(performance.now() - t0)
  const [, perfil] = await t('members', pasos[0][1])
  console.log(`\nEN PARALELO (perfil primero, el resto junto):`)
  console.log(`  ${String(perfil).padStart(5)} ms  members`)
  console.log(`  ${String(paralelo).padStart(5)} ms  las otras siete, juntas`)
  console.log(`  ${String(perfil + paralelo).padStart(5)} ms  TOTAL`)
}
main().catch(e => { console.error('ERROR:', e); process.exit(1) })
