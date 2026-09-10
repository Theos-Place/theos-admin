/** La justificación al autorizar estudios virtuales: obligatoria, y se limpia al quitar. */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const BASE = 'http://localhost:3000'

async function main() {
  const sb = createAdminClient()
  const { data: m } = await sb.from('members').insert({
    first_name: '[prueba]', last_name: 'Virtual Justificada',
    email: 'virtual.justificada@prueba.theosplace.invalid', is_active: true,
  }).select('id').single()
  const MID = (m as { id: string }).id

  const { data: link } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/miembros/${MID}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })

  const put = (body: unknown) => page.request.fetch(`${BASE}/api/members/${MID}/admin-data`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, data: body,
  })

  console.log('1) autorizar SIN razón')
  const r1 = await put({ authorized_virtual_studies: true })
  console.log('   →', r1.status(), (await r1.text()).slice(0, 110))

  console.log('\n2) autorizar CON razón')
  const r2 = await put({ authorized_virtual_studies: true, virtual_reason: '  Vive en Guanacaste y el grupo presencial es en San José.  ' })
  console.log('   →', r2.status())
  const { data: a } = await sb.from('member_admin_data')
    .select('authorized_virtual_studies, authorized_virtual_studies_reason, authorized_virtual_studies_by, authorized_virtual_studies_at')
    .eq('member_id', MID).maybeSingle()
  console.log('   guardado:', JSON.stringify(a))

  console.log('\n3) quitar la autorización → la razón se limpia')
  const r3 = await put({ authorized_virtual_studies: false })
  console.log('   →', r3.status())
  const { data: b2 } = await sb.from('member_admin_data')
    .select('authorized_virtual_studies, authorized_virtual_studies_reason').eq('member_id', MID).maybeSingle()
  console.log('   quedó:', JSON.stringify(b2))

  await b.close()
  await sb.from('member_admin_data').delete().eq('member_id', MID)
  await sb.from('members').delete().eq('id', MID)
  console.log('✓ limpio')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
