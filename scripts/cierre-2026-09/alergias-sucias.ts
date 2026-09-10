/** Qué hay realmente escrito en members.allergies. */
import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const s = createAdminClient()
  const filas: { id: string; nombre: string; texto: string }[] = []
  let from = 0
  for (;;) {
    const { data } = await s.from('members').select('id, first_name, last_name, allergies')
      .not('allergies', 'is', null).range(from, from + 999)
    const rows = (data ?? []) as { id: string; first_name: string|null; last_name: string|null; allergies: string }[]
    for (const m of rows) if (m.allergies.trim()) filas.push({ id: m.id, nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), texto: m.allergies.trim() })
    if (rows.length < 1000) break
    from += 1000
  }
  console.log('personas con algo escrito en alergias:', filas.length)
  const correos = filas.filter(f => /@/.test(f.texto))
  const telefonos = filas.filter(f => /^\+?[\d\s-]{7,}$/.test(f.texto))
  const ninguna = filas.filter(f => /^(no|ninguna|n\/a|na|nada|-|ninguno)\.?$/i.test(f.texto))
  // Lo que en realidad es restricción alimenticia y debería estar en el campo nuevo.
  const dieta = filas.filter(f => /celiac|gluten|lactos|vegan/i.test(f.texto))
  const l = (t: string, a: typeof filas) => { console.log(`\n${t}: ${a.length}`); for (const f of a.slice(0, 12)) console.log(`   ${f.nombre} — ${JSON.stringify(f.texto.slice(0, 70))}`) }
  l('un CORREO metido en alergias', correos)
  l('un TELÉFONO metido en alergias', telefonos)
  l('dice "ninguna" (ruido, no dato)', ninguna)
  l('es restricción alimenticia escrita a mano', dieta)
}
main().catch(e => { console.error(e); process.exit(1) })
