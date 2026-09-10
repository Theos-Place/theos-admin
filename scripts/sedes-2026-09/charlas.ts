import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const s = createAdminClient()
  const { data: sedes } = await s.from('sedes').select('id, code, name, is_active, is_zone')
  const porId = new Map((sedes ?? []).map(r => [(r as {id:string}).id, r as Record<string, unknown>]))
  const { data } = await s.from('events')
    .select('id, title, starts_at, sede_id, event_type, is_recurring')
    .gte('starts_at', '2026-09-01').order('starts_at').limit(60)
  for (const e of (data ?? []) as Record<string, unknown>[]) {
    const sd = e.sede_id ? porId.get(e.sede_id as string) : null
    console.log(String(e.starts_at).slice(0,16), '|', String(e.title).slice(0,40).padEnd(40), '| sede:', sd ? `${sd.code} (activa:${sd.is_active} zona:${sd.is_zone})` : '—')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
