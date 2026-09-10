import { createAdminClient } from '../../src/lib/supabase/admin'
import { applyMemberSearch } from '../../src/lib/supabase/queries/members'
async function main() {
  const sb = createAdminClient()
  for (const texto of ['Perez', 'Pérez', 'munoz', 'Muñoz', 'jimenez sanabria', 'Jiménez Sanabria', 'VIQUEZ', 'Víquez']) {
    const q = applyMemberSearch(sb.from('members').select('id', { count: 'exact', head: true }), texto)
    const { count, error } = await q
    console.log(`buscar ${JSON.stringify(texto).padEnd(22)} → ${error ? 'ERROR ' + error.message : `${count} personas`}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
