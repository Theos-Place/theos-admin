/** SOLO LECTURA: mapa charla → comité, y qué comités Youth faltan. */
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'

const DIAS = /\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingos?)\b/gi
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^(charla|comite|sede)\s+/g, '').trim()
/** "Charla Alajuela Jueves" → "alajuela"; el comité se llama "Sede Alajuela". */
const sinDia = (s: string) => norm(s.replace(DIAS, ' ')).replace(/\s+/g, ' ').trim()

async function main() {
  const sb = createAdminClient()
  const { data: ev } = await sb.from('events')
    .select('id, title, starts_at').eq('event_type', 'charla')
    .gte('starts_at', new Date(Date.now() - 90 * 86400000).toISOString())
  const { data: ar } = await sb.from('areas').select('id, name, parent_id').eq('area_type', 'committee')
  const comites = (ar ?? []) as Array<{ id: string; name: string; parent_id: string | null }>

  const porNombre = new Map(comites.map(a => [norm(a.name), a]))
  const porSinDia = new Map(comites.map(a => [sinDia(a.name), a]))

  const grupos = new Map<string, { n: number; canon: string }>()
  for (const e of (ev ?? []) as Array<{ title: string }>) {
    const canon = canonicalCharlaTitle(e.title) ?? e.title
    const g = grupos.get(canon) ?? { n: 0, canon }
    g.n++; grupos.set(canon, g)
  }

  const resuelve = (canon: string) => porNombre.get(norm(canon)) ?? porSinDia.get(sinDia(canon)) ?? null
  console.log('=== charla (canónica) → comité ===')
  const faltan: Array<{ canon: string; n: number }> = []
  for (const [canon, g] of [...grupos].sort((a, b) => b[1].n - a[1].n)) {
    const c = resuelve(canon)
    console.log(`  ${String(g.n).padStart(3)}×  ${canon.padEnd(38)} → ${c ? c.name : '‼ FALTA'}`)
    if (!c) faltan.push({ canon, n: g.n })
  }
  console.log(`\n=== comités que habría que CREAR (${faltan.length}) ===`)
  const padre = comites.find(c => /^Sede Alajuela$/.test(c.name))?.parent_id ?? null
  faltan.forEach(f => console.log(`  ${f.canon}  (${f.n} charlas)`))
  console.log(`\npadre de los comités de sede: ${padre ?? '(ninguno)'}`)
  const p = comites.find(c => c.id === padre)
  console.log(`  → ${p ? p.name : (await sb.from('areas').select('name').eq('id', padre ?? '').maybeSingle()).data?.name ?? '?'}`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
