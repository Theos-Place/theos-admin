/** EST-6 · La coordinación puede cambiar el estado de una solicitud de interés,
 *  pero sigue sin poder gestionarla (tomar/asignar/resolver/rechazar). */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'

const CORREO = 'camila.coordinadora@prueba.theosplace.invalid'
const BASE = 'http://localhost:3000'

async function main() {
  const sb = createAdminClient()
  const { data } = await sb.from('study_requests')
    .select('id, status, request_type').eq('request_type', 'study_interest').eq('status', 'open').limit(1)
  const sol = (data ?? [])[0] as { id: string; status: string } | undefined
  if (!sol) throw new Error('no hay ninguna solicitud de interés abierta para probar')
  console.log('solicitud de prueba:', sol.id, '| estado:', sol.status)

  const { data: link } = await sb.auth.admin.generateLink({ type: 'magiclink', email: CORREO })
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/estudios/solicitudes`, { waitUntil: 'networkidle' })

  const patch = (body: unknown) => page.request.fetch(`${BASE}/api/studies/requests/${sol.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, data: body,
  })

  const r1 = await patch({ action: 'set_status', status: 'in_review' })
  console.log('cambiar estado a "En revisión" →', r1.status(), (await r1.text()).slice(0, 120))

  const r2 = await patch({ action: 'take' })
  console.log('intentar TOMARLA (no debe dejar) →', r2.status(), (await r2.text()).slice(0, 120))

  // Se devuelve como estaba, para no dejar la cola tocada.
  const r3 = await patch({ action: 'set_status', status: 'open' })
  console.log('devolverla a "Abierta" →', r3.status())
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
