/**
 * UX-5 · El endpoint paralelizado tiene que devolver EXACTAMENTE lo mismo.
 * Se reproducen las dos versiones sobre las mismas fichas y se comparan los
 * payloads campo por campo. Paralelizar es fácil de hacer mal (un dato que se
 * pierde, un orden que cambia), y eso no lo agarra el compilador.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { withBaseRole } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

type Member = { id: string; first_name: string; last_name: string; email: string | null; cedula: string | null; is_system: boolean }

async function enFila(admin: ReturnType<typeof createAdminClient>, member: Member) {
  const { data: roleRows } = await admin.from('member_roles').select('role').eq('member_id', member.id).eq('is_active', true)
  const { data: ownUnits } = await admin.from('family_members').select('family_unit_id').eq('member_id', member.id)
  const unitIds = (ownUnits ?? []).map(r => (r as { family_unit_id: string }).family_unit_id)
  let familyMemberIds: string[] = []
  if (unitIds.length) {
    const { data: shared } = await admin.from('family_members').select('member_id').in('family_unit_id', unitIds)
    familyMemberIds = [...new Set((shared ?? []).map(r => (r as { member_id: string }).member_id).filter(id => id !== member.id))]
  }
  const { isStudyCommitteeMember } = await import('@/lib/supabase/queries/study-requests')
  const { getGrantedFormIds } = await import('@/lib/supabase/queries/forms')
  const { getManagedEventIds } = await import('@/lib/supabase/queries/events')
  const { DOCUMENT_PROMPT_NOTICE } = await import('@/lib/members/document-prompt')
  const inStudyCommittee = await isStudyCommitteeMember(member.id)
  const grantedFormIds = await getGrantedFormIds(member.id)
  const managedEventIds = await getManagedEventIds(member.id)
  const { data: dis } = await admin.from('notice_dismissals').select('dismissed_at')
    .eq('member_id', member.id).eq('notice_key', DOCUMENT_PROMPT_NOTICE).maybeSingle()
  return payload(member, (roleRows ?? []).map(r => (r as { role: RoleId }).role), familyMemberIds,
    inStudyCommittee, grantedFormIds, managedEventIds, (dis as { dismissed_at?: string } | null)?.dismissed_at ?? null)
}

async function enParalelo(admin: ReturnType<typeof createAdminClient>, member: Member) {
  const [roleRows, familyMemberIds, inStudyCommittee, grantedFormIds, managedEventIds, dismissed] = await Promise.all([
    admin.from('member_roles').select('role').eq('member_id', member.id).eq('is_active', true).then(r => r.data ?? []),
    (async (): Promise<string[]> => {
      const { data: ownUnits } = await admin.from('family_members').select('family_unit_id').eq('member_id', member.id)
      const unitIds = (ownUnits ?? []).map(r => (r as { family_unit_id: string }).family_unit_id)
      if (!unitIds.length) return []
      const { data: shared } = await admin.from('family_members').select('member_id').in('family_unit_id', unitIds)
      return [...new Set((shared ?? []).map(r => (r as { member_id: string }).member_id).filter(id => id !== member.id))]
    })(),
    (async () => (await import('@/lib/supabase/queries/study-requests')).isStudyCommitteeMember(member.id))(),
    (async () => (await import('@/lib/supabase/queries/forms')).getGrantedFormIds(member.id))(),
    (async () => (await import('@/lib/supabase/queries/events')).getManagedEventIds(member.id))(),
    (async (): Promise<string | null> => {
      const { DOCUMENT_PROMPT_NOTICE } = await import('@/lib/members/document-prompt')
      const { data: dis } = await admin.from('notice_dismissals').select('dismissed_at')
        .eq('member_id', member.id).eq('notice_key', DOCUMENT_PROMPT_NOTICE).maybeSingle()
      return (dis as { dismissed_at?: string } | null)?.dismissed_at ?? null
    })(),
  ])
  return payload(member, (roleRows as Array<{ role: RoleId }>).map(r => r.role), familyMemberIds,
    inStudyCommittee, grantedFormIds, managedEventIds, dismissed)
}

function payload(m: Member, explicitos: RoleId[], fam: string[], comite: boolean, forms: string[], evs: string[], dis: string | null) {
  const roles = withBaseRole(explicitos)
  return {
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || (m.email ?? ''),
    roles, role: roles[0] ?? null, member_id: m.id,
    family_member_ids: [...fam].sort(),
    has_cedula: !!(m.cedula && String(m.cedula).trim()),
    document_prompt_dismissed_at: dis, is_system: !!m.is_system,
    in_study_committee: comite, granted_form_ids: [...forms].sort(), managed_event_ids: [...evs].sort(),
  }
}

async function main() {
  const admin = createAdminClient()
  // Casos variados: con familia, con roles, del comité de estudios, con eventos
  // a cargo. Comparar solo fichas vacías no probaría nada.
  const { data: ms } = await admin.from('members')
    .select('id, first_name, last_name, email, cedula, is_system')
    .not('auth_user_id', 'is', null).eq('is_active', true).limit(25)
  let iguales = 0
  const difs: string[] = []
  let serieTotal = 0, parTotal = 0
  for (const m of (ms ?? []) as Member[]) {
    const t0 = performance.now(); const a = await enFila(admin, m); serieTotal += performance.now() - t0
    const t1 = performance.now(); const b = await enParalelo(admin, m); parTotal += performance.now() - t1
    if (JSON.stringify(a) === JSON.stringify(b)) iguales++
    else difs.push(`${m.first_name} ${m.last_name}\n  fila:     ${JSON.stringify(a)}\n  paralelo: ${JSON.stringify(b)}`)
  }
  console.log(`payloads idénticos: ${iguales}/${(ms ?? []).length}`)
  if (difs.length) { console.log('\n‼ DIFERENCIAS:'); difs.forEach(d => console.log(d)) }
  const n = (ms ?? []).length
  console.log(`\npromedio por ficha:  en fila ${Math.round(serieTotal / n)} ms  ·  en paralelo ${Math.round(parTotal / n)} ms`)
}
main().catch(e => { console.error('ERROR:', e); process.exit(1) })
