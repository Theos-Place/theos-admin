/** Enlaza las 3 fichas que quedaron con cuenta de Auth y auth_user_id null. */
import { createAdminClient } from '../../src/lib/supabase/admin'
const PARES: [string, string, string][] = [
  ['84ffe61d-2111-4e28-89c4-a6124cdf72cc', 'f02191ab-fb84-4b8d-b860-cd7c02388fab', 'Samara Castillo'],
  ['9f228e37-37ec-4fce-8e6b-9c3079055fb4', '54548851-9366-4d17-aefa-0977834c6d10', 'Julia Barrantes Soto'],
  ['608ce0ea-0e99-4c70-b67c-392ef98cb273', '15145a7e-00a1-4ba0-b1e1-fef0a4ead2f4', 'Victoria Badilla Saxe'],
]
async function main() {
  const s = createAdminClient()
  for (const [memberId, authId, nombre] of PARES) {
    const { data: dueno } = await s.from('members').select('id').eq('auth_user_id', authId).maybeSingle()
    if (dueno) { console.log('SALTA', nombre, '— la cuenta ya es de', (dueno as {id:string}).id); continue }
    const { error } = await s.from('members').update({ auth_user_id: authId }).eq('id', memberId).is('auth_user_id', null)
    console.log(error ? `ERROR ${nombre}: ${error.message}` : `✓ ${nombre}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
