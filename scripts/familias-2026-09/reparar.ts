/**
 * Reparación de familias partidas por el bug de vínculo (2026-09-09).
 *
 * linkFamilyMember nunca miraba si la persona vinculada YA tenía familia, así
 * que en vez de fusionar dejaba a alguien en DOS unidades, con los integrantes
 * de cada una separados. Este script encuentra esos casos y los fusiona con la
 * misma regla que ahora usa el vínculo (ver src/lib/members/fusion-familias.ts):
 *
 *   · sobrevive la unidad MÁS ANTIGUA, con su nombre;
 *   · cada quien se muda con su relation y su linked_by;
 *   · si alguien está en las dos, gana su fila MÁS RECIENTE;
 *   · encadena: si A comparte con B y B con C, las tres quedan en una.
 *
 * La fusión de cada grupo la ejecuta merge_family_units en la base, para que sea
 * una transacción: o se mueve todo el grupo o no se mueve nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/familias-2026-09/reparar.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/familias-2026-09/reparar.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { gruposAFusionar, planificarFusion } = await import('../../src/lib/members/fusion-familias')
  const sb = createAdminClient()

  // Todo family_members + su unidad. Son ~3.4k filas: entra de una, pero se
  // pagina igual porque PostgREST corta en 1000 sin avisar.
  type Fila = { family_unit_id: string; member_id: string; relation: string | null; linked_by: string | null; created_at: string }
  const filas: Fila[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb
      .from('family_members')
      .select('family_unit_id, member_id, relation, linked_by, created_at')
      .order('id', { ascending: true })
      .range(desde, desde + 999)
    if (error) throw error
    filas.push(...((data ?? []) as Fila[]))
    if ((data ?? []).length < 1000) break
  }

  // family_units TAMBIÉN se pagina. En el primer simulacro no lo hacía y
  // PostgREST devolvió 1000 de 1367 sin avisar: la segunda unidad del caso
  // Chavarría quedó fuera del mapa y el script reportó "nada que fusionar".
  type Unidad = { id: string; name: string | null; created_at: string }
  const unidades = new Map<string, Unidad>()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from('family_units')
      .select('id, name, created_at').order('id', { ascending: true }).range(desde, desde + 999)
    if (error) throw error
    for (const u of (data ?? []) as Unidad[]) unidades.set(u.id, u)
    if ((data ?? []).length < 1000) break
  }

  const nombres = new Map<string, string>()
  const ids = [...new Set(filas.map(f => f.member_id))]
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from('members')
      .select('id, first_name, last_name').in('id', ids.slice(i, i + 200))
    // Si esto falla el informe queda ilegible (ids en vez de nombres) y no se
    // puede aprobar a ciegas: mejor reventar.
    if (error) throw error
    for (const m of data ?? []) nombres.set(m.id, `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim())
  }
  const faltantes = ids.filter(i => !nombres.has(i))
  if (faltantes.length) throw new Error(`No se resolvieron ${faltantes.length} nombres; el informe sería ilegible.`)

  console.log('ANTES')
  console.log(`  unidades familiares: ${unidades.size}`)
  console.log(`  vínculos:            ${filas.length}`)
  console.log(`  personas:            ${new Set(filas.map(f => f.member_id)).size}`)

  const grupos = gruposAFusionar(filas)
  if (grupos.length === 0) {
    console.log('\nNo hay familias que fusionar. Nada que reparar.')
    return
  }

  console.log(`\nGRUPOS A FUSIONAR: ${grupos.length}\n`)
  let unidadesQueDesaparecen = 0
  const planes: Array<{ sobrevive: string; seEliminan: string[] }> = []

  for (const grupo of grupos) {
    const usAqui = grupo.map(id => unidades.get(id)!).filter(Boolean)
    const plan = planificarFusion(usAqui, filas)
    unidadesQueDesaparecen += plan.seEliminan.length
    planes.push({ sobrevive: plan.sobrevive!, seEliminan: plan.seEliminan })

    console.log(`── ${usAqui.map(u => `«${u.name}»`).join(' + ')}`)
    for (const u of usAqui) {
      const suyos = filas.filter(f => f.family_unit_id === u.id)
      const marca = u.id === plan.sobrevive ? 'SOBREVIVE' : 'se elimina'
      console.log(`   [${marca}] «${u.name}» (${u.created_at.slice(0, 10)})`)
      for (const f of suyos) console.log(`       · ${nombres.get(f.member_id) ?? f.member_id} — ${f.relation}`)
    }
    console.log(`   QUEDA: «${unidades.get(plan.sobrevive!)!.name}» con ${plan.integrantesFinales.length} integrantes:`)
    for (const i of plan.integrantesFinales) {
      console.log(`       · ${nombres.get(i.member_id) ?? i.member_id} — ${i.relation}`)
    }
    console.log()
  }

  console.log('DESPUÉS (proyectado)')
  console.log(`  unidades familiares: ${unidades.size - unidadesQueDesaparecen} (${unidadesQueDesaparecen} menos)`)
  console.log(`  vínculos:            ${new Set(filas.map(f => f.member_id)).size} (una fila por persona)`)

  if (!aplicar) {
    console.log('\nSIMULACRO. Nada se escribió. Volvé a correrlo con --aplicar.')
    return
  }

  console.log('\nAplicando…')
  for (const plan of planes) {
    const { error } = await sb.rpc('merge_family_units', {
      p_survivor: plan.sobrevive,
      p_losers: plan.seEliminan,
    })
    if (error) throw error
    console.log(`  ✓ «${unidades.get(plan.sobrevive)!.name}» absorbió ${plan.seEliminan.length}`)
  }

  const { count: unidadesFinal } = await sb.from('family_units').select('id', { count: 'exact', head: true })
  const { count: vinculosFinal } = await sb.from('family_members').select('id', { count: 'exact', head: true })
  console.log(`\nDESPUÉS (real): unidades=${unidadesFinal}  vínculos=${vinculosFinal}`)

  // La comprobación que importa: que ya no quede NADIE en dos familias.
  const { data: rest } = await sb.from('family_members').select('member_id, family_unit_id')
  const porPersona = new Map<string, Set<string>>()
  for (const r of rest ?? []) {
    const s = porPersona.get(r.member_id) ?? new Set()
    s.add(r.family_unit_id as string)
    porPersona.set(r.member_id, s)
  }
  const siguenMulti = [...porPersona].filter(([, s]) => s.size > 1)
  console.log(`Personas en 2+ familias: ${siguenMulti.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
