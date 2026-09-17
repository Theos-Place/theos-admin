/** SOLO LECTURA: el detalle de la asignación propuesta, para revisar. */
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'
import { comiteDeLaCharla, type Comite } from '@/lib/events/comite-de-la-charla'
import { writeFileSync } from 'node:fs'

const q = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
async function main() {
  const sb = createAdminClient()
  const { data: ar } = await sb.from('areas').select('id, name').eq('area_type', 'committee')
  const comites = (ar ?? []) as Comite[]
  const { data: ev } = await sb.from('events').select('id, title, starts_at')
    .eq('event_type', 'charla').gte('starts_at', new Date(Date.now() - 90 * 86400000).toISOString())
  const { data: yaCon } = await sb.from('event_organizing_committees').select('event_id')
  const conComite = new Set(((yaCon ?? []) as Array<{ event_id: string }>).map(x => x.event_id))

  const agr = new Map<string, { canon: string; comite: string; n: number }>()
  for (const e of (ev ?? []) as Array<{ id: string; title: string }>) {
    if (conComite.has(e.id)) continue
    const canon = canonicalCharlaTitle(e.title) ?? e.title
    const c = comiteDeLaCharla(canon, comites)
    const k = `${e.title}|${canon}`
    const g = agr.get(k) ?? { canon, comite: c?.name ?? '‼ SIN RESOLVER', n: 0 }
    g.n++; agr.set(k, g)
  }
  const filas = [['Título del evento', 'Nombre canónico', 'Comité que se le asignaría', 'Charlas'].map(q).join(',')]
  for (const [k, g] of [...agr].sort((a, b) => a[1].comite.localeCompare(b[1].comite)))
    filas.push([k.split('|')[0], g.canon, g.comite, g.n].map(q).join(','))
  writeFileSync('eve12-comites-propuestos-2026-09-17.csv', '﻿' + filas.join('\n'))
  console.log(`CSV con ${filas.length - 1} filas (${[...agr.values()].reduce((a, b) => a + b.n, 0)} charlas)`)
  const sin = [...agr.values()].filter(g => g.comite.startsWith('‼'))
  console.log('sin resolver: ' + (sin.length || 'ninguna'))
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
