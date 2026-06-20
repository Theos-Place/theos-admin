/**
 * Corrige tildes/ñ corruptas (`?`) en nombres de members. El `?` se perdió en el
 * export de PCO (está igual en todas las fuentes), así que se restaura con un
 * diccionario CURADO de tokens inequívocos. Los ambiguos se dejan sin tocar.
 *
 * Dry-run por defecto. Aplicar: npx tsx scripts/fix-name-accents.ts --apply
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

// Token corrupto → correcto. Solo casos inequívocos.
const MAP: Record<string, string> = {
  'Mar?a': 'María', 'Jos?': 'José', 'L?pez': 'López', 'P?rez': 'Pérez',
  'Quir?s': 'Quirós', 'S?enz': 'Sáenz', 'S?nchez': 'Sánchez', 'Ver?nica': 'Verónica',
  'Andr?s': 'Andrés', 'C?spedes': 'Céspedes', 'G?mez': 'Gómez', 'M?nica': 'Mónica',
  'Mar?n': 'Marín', 'Mej?a': 'Mejía', 'Nicol?s': 'Nicolás', 'Nu?ez': 'Nuñez',
  'V?squez': 'Vásquez', 'Anch?a': 'Anchía', 'Ant?nez': 'Antúnez', 'BriceÃ?Â±o': 'Briceño',
  'D?vila': 'Dávila', 'Echeverr?a': 'Echeverría', 'Efra?n': 'Efraín', 'Fari?as': 'Fariñas',
  'Guill?n': 'Guillén', 'Guzm?n': 'Guzmán', 'Iv?n': 'Iván', 'Jim?nez': 'Jiménez',
  'Le?n': 'León', 'Lor?a': 'Loría', 'M?ndez': 'Méndez', 'M?nika': 'Mónika',
  'Men?ndez': 'Menéndez', 'Mes?n': 'Mesén', 'Mic?': 'Micó', 'No?': 'Noé',
  'Pati?o': 'Patiño', 'Rold?n': 'Roldán', 'Rom?n': 'Román', 'Rosal?a': 'Rosalía',
  'Rub?n': 'Rubén', 'Rud?n': 'Rudín', 'Sebasti?n': 'Sebastián', 'Vizca?no': 'Vizcaíno',
}
// Ambiguos: NO se tocan (se reportan al final).
const AMBIGUOUS = new Set(['Mor?a', 'P?a', 'Ses?n', 'Yel?n'])

function fix(name: string): string {
  let out = name
  for (const [bad, good] of Object.entries(MAP)) out = out.split(bad).join(good)
  return out
}

async function main() {
  const { data, error } = await supabase
    .from('members').select('id, first_name, last_name')
    .or('first_name.like.%?%,last_name.like.%?%')
  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; first_name: string; last_name: string }>

  const changes: Array<{ id: string; fn: string; ln: string; nfn: string; nln: string }> = []
  const stillBroken = new Set<string>()
  for (const r of rows) {
    const nfn = fix(r.first_name), nln = fix(r.last_name)
    if (nfn !== r.first_name || nln !== r.last_name) changes.push({ id: r.id, fn: r.first_name, ln: r.last_name, nfn, nln })
    if (nfn.includes('?') || nln.includes('?')) {
      for (const t of `${nfn} ${nln}`.split(/\s+/)) if (t.includes('?')) stillBroken.add(t)
    }
  }

  console.log(`Con "?" en el nombre: ${rows.length}`)
  console.log(`A corregir: ${changes.length}`)
  for (const c of changes) console.log(`  ${c.fn} ${c.ln}  →  ${c.nfn} ${c.nln}`)
  console.log(`\nQuedan ambiguos sin tocar (tokens): ${[...stillBroken].join(', ') || '—'}`)

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }
  let done = 0
  for (const c of changes) {
    await supabase.from('members').update({ first_name: c.nfn, last_name: c.nln }).eq('id', c.id)
    done++
  }
  console.log(`\nActualizados: ${done}`)
}
main()
