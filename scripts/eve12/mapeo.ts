/** ¿Se pueden asignar solos los comités de las charlas, por su sede? */
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^(charla|comite|comité|sede)\s+/g, '').trim()

async function main() {
  const sb = createAdminClient()
  const { data: ev } = await sb.from('events')
    .select('id, title, event_type, starts_at').eq('event_type', 'charla')
    .gte('starts_at', new Date(Date.now() - 90 * 86400000).toISOString())
  const { data: ar } = await sb.from('areas').select('id, name').eq('area_type', 'committee')
  const comites = new Map(((ar ?? []) as Array<{ id: string; name: string }>).map(a => [norm(a.name), a.name]))

  let ok = 0; const fallan = new Map<string, number>()
  for (const e of (ev ?? []) as Array<{ title: string }>) {
    const canon = canonicalCharlaTitle(e.title) ?? e.title
    const clave = norm(canon)
    if (comites.has(clave)) ok++
    else fallan.set(e.title, (fallan.get(e.title) ?? 0) + 1)
  }
  console.log(`charlas de los últimos 3 meses: ${(ev ?? []).length}`)
  console.log(`  con un comité de MISMO NOMBRE (sede): ${ok}`)
  console.log(`  sin correspondencia automática:       ${(ev ?? []).length - ok}`)
  console.log('\ntítulos que no matchean:')
  ;[...fallan.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}×  ${t}  →  ${canonicalCharlaTitle(t) ?? '(sin canónico)'}`))
  console.log('\ncomités de sede disponibles:')
  ;[...comites.values()].filter(n => /^Sede /.test(n)).forEach(n => console.log('  ' + n))
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
