/**
 * Prueba de punta a punta EN STAGING: un cierre legacy y uno de bloques.
 *
 *   npx tsx scripts/est14-legacy-2026-10/prueba-en-staging.ts
 *   …con --limpiar borra lo que creó y no prueba nada.
 *
 * QUÉ PRUEBA, y por qué no alcanza con los tests. Los tests de
 * `modalidad-de-bloques` fijan las REGLAS puras; esto recorre el camino de
 * verdad —`closeGroup` → `autoEnrollApprovedToNextLevel` →
 * `createAutoFolletoIfNeeded`— contra una base real, que es donde vivía el
 * bug: ninguna regla estaba mal, lo que faltaba era que alguien le dijera la
 * modalidad al cierre.
 *
 * LAS DOS MITADES:
 *   · Un N3 LEGACY con 3 estudiantes → al cerrar debe aparecer el grupo de
 *     N4, un tiquete de folletos de N4 y 3 cobros de ₡5.000.
 *   · Un N3 de BLOQUES con 2 estudiantes → al cerrar debe aparecer el grupo
 *     de N4 y NADA más: ni folletos ni cobros, porque el par se pagó al
 *     entrar.
 *   · Y el caso mixto: en el legacy, uno de los 3 lleva `cubre_bloque` y NO
 *     debe recibir cobro ni contarse en el folleto. Son 2 cobros, no 3.
 *
 * SOLO STAGING. Carga `.env.staging.local` ANTES de importar nada de la app,
 * porque `createAdminClient` lee el entorno al construirse. Si ese archivo no
 * existe, no corre: apuntarle a producción sería sembrar basura ahí.
 */
import { readFileSync, existsSync } from 'node:fs'

const ENV = '.env.staging.local'
if (!existsSync(ENV)) {
  console.error(`✗ No existe ${ENV}. Esta prueba NO corre contra producción.`)
  process.exit(1)
}
for (const l of readFileSync(ENV, 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/ellequrgrrqhtqksfrug/.test(url)) {
  console.error(`✗ La URL no es la de staging: ${url}`)
  process.exit(1)
}
console.log(`staging: ${url}\n`)

/** Marca para poder encontrar y borrar TODO lo que crea esta prueba. */
const MARCA = '[prueba-est14]'

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const sb = createAdminClient()

  if (process.argv.includes('--limpiar')) { await limpiar(sb); return }
  await limpiar(sb)   // de una corrida anterior

  const plan = async (code: string) => {
    const { data } = await sb.from('study_plans').select('id, code, cost').eq('code', code).maybeSingle()
    if (!data) throw new Error(`falta el plan ${code} en staging`)
    return data as { id: string; code: string; cost: number | null }
  }
  const n3 = await plan('N3'), n4 = await plan('N4')
  console.log(`catálogo: N3 ₡${n3.cost} · N4 ₡${n4.cost}\n`)

  // Personas de prueba. Se reusan si ya existen.
  const personas: string[] = []
  for (let i = 1; i <= 5; i++) {
    const { data } = await sb.from('members')
      .insert({ first_name: '[prueba]', last_name: `EST14 Estudiante ${i}`, is_active: true })
      .select('id').single()
    personas.push((data as { id: string }).id)
  }

  const crearGrupo = async (nombre: string, modalidad: 'legacy' | 'bloques', miembros: string[], conPar: string[] = []) => {
    const { data: g } = await sb.from('study_groups').insert({
      plan_id: n3.id, name: `${MARCA} ${nombre}`, modalidad,
      status: 'en_curso', zone: `${MARCA} ${modalidad}`, schedule_time: '19:00',
      starts_at: '2026-08-01', ends_at: '2026-09-30',
    }).select('id').single()
    const groupId = (g as { id: string }).id
    for (const m of miembros) {
      await sb.from('study_enrollments').insert({
        group_id: groupId, member_id: m, plan_id: n3.id,
        status: 'enrolled', cubre_bloque: conPar.includes(m),
      })
    }
    return groupId
  }

  // El legacy lleva 3, y el tercero YA pagó el par (el caso de Michelle Guier).
  const legacy = await crearGrupo('N3 legacy', 'legacy', personas.slice(0, 3), [personas[2]])
  const bloques = await crearGrupo('N3 bloques', 'bloques', personas.slice(3, 5))

  const cerrar = async (groupId: string, miembros: string[]) => {
    const { closeGroup } = await import('@/lib/supabase/queries/studies')
    const { autoEnrollApprovedToNextLevel } = await import('@/lib/supabase/queries/payments')
    const { createAutoFolletoIfNeeded } = await import('@/lib/supabase/queries/folletos')
    const results = miembros.map(m => ({ member_id: m, status_result: 'aprobado' as const }))
    await closeGroup(groupId, results, null)
    const { next_group_id } = await autoEnrollApprovedToNextLevel(groupId, miembros, null)
    if (next_group_id) {
      await createAutoFolletoIfNeeded(next_group_id, 'cierre', '2026-10-05', null, groupId)
    }
    return next_group_id
  }

  const sucLegacy = await cerrar(legacy, personas.slice(0, 3))
  const sucBloques = await cerrar(bloques, personas.slice(3, 5))

  const medir = async (sucesorId: string | null) => {
    if (!sucesorId) return { matriculados: 0, cobros: 0, monto: 0, folletos: 0, folletoQty: 0 }
    const [{ count: matriculados }, { data: pagos }, { data: fols }] = await Promise.all([
      sb.from('study_enrollments').select('id', { count: 'exact', head: true }).eq('group_id', sucesorId),
      sb.from('payments').select('amount').eq('study_group_id', sucesorId).eq('concept', 'matricula'),
      sb.from('folleto_requests').select('id, target_level_code, quantity').eq('source_group_id', sucesorId),
    ])
    const ps = (pagos ?? []) as Array<{ amount: number }>
    const fs = (fols ?? []) as Array<{ target_level_code: string; quantity: number }>
    return {
      matriculados: matriculados ?? 0,
      cobros: ps.length, monto: ps.reduce((s, p) => s + Number(p.amount), 0),
      folletos: fs.length, folletoQty: fs[0]?.quantity ?? 0, folletoNivel: fs[0]?.target_level_code ?? '—',
    }
  }

  const rl = await medir(sucLegacy), rb = await medir(sucBloques)
  console.log('LEGACY  (3 estudiantes, 1 de ellos ya pagó el par)')
  console.log(`   sucesor: ${sucLegacy ? 'sí' : 'NO'} · matriculados ${rl.matriculados}`)
  console.log(`   cobros:  ${rl.cobros} por ₡${rl.monto.toLocaleString('es-CR')}`)
  console.log(`   folletos: ${rl.folletos} tiquete(s), nivel ${rl.folletoNivel}, cantidad ${rl.folletoQty}`)
  console.log('BLOQUES (2 estudiantes)')
  console.log(`   sucesor: ${sucBloques ? 'sí' : 'NO'} · matriculados ${rb.matriculados}`)
  console.log(`   cobros:  ${rb.cobros} por ₡${rb.monto.toLocaleString('es-CR')}`)
  console.log(`   folletos: ${rb.folletos} tiquete(s)`)

  const esperado = Number(n4.cost ?? 0) * 2
  const checks: Array<[string, boolean]> = [
    ['el legacy crea el grupo de Nivel 4', !!sucLegacy],
    ['el legacy COBRA, y solo a los 2 que no pagaron el par', rl.cobros === 2 && rl.monto === esperado],
    ['el legacy pide folletos de N4', rl.folletos === 1 && rl.folletoNivel === 'N4'],
    ['y pide 2, no 3: a quien ya tiene el par no se le imprime', rl.folletoQty === 2],
    ['el de bloques crea el grupo de Nivel 4', !!sucBloques],
    ['el de bloques NO cobra nada', rb.cobros === 0],
    ['el de bloques NO pide folletos', rb.folletos === 0],
  ]
  console.log('')
  let ok = true
  for (const [q, pasa] of checks) { console.log(`  ${pasa ? '✓' : '✗'} ${q}`); if (!pasa) ok = false }
  console.log(ok ? '\n✓ TODO BIEN' : '\n✗ HAY FALLAS')

  console.log(`\nQueda sembrado en staging para que lo mires en la pantalla.`)
  console.log(`Para borrarlo: npx tsx scripts/est14-legacy-2026-10/prueba-en-staging.ts --limpiar`)
  if (!ok) process.exit(1)
}

async function limpiar(sb: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>) {
  const { data: gs } = await sb.from('study_groups').select('id').like('name', `${MARCA}%`)
  const ids = ((gs ?? []) as Array<{ id: string }>).map(g => g.id)
  if (ids.length) {
    await sb.from('folleto_requests').delete().in('source_group_id', ids)
    await sb.from('payments').delete().in('study_group_id', ids)
    await sb.from('study_enrollments').delete().in('group_id', ids)
    await sb.from('study_groups').delete().in('id', ids)
  }
  const { data: ms } = await sb.from('members').select('id').like('last_name', 'EST14 Estudiante%')
  const mids = ((ms ?? []) as Array<{ id: string }>).map(m => m.id)
  if (mids.length) {
    await sb.from('payments').delete().in('member_id', mids)
    await sb.from('study_enrollments').delete().in('member_id', mids)
    await sb.from('members').delete().in('id', mids)
  }
  if (process.argv.includes('--limpiar')) console.log(`limpiado: ${ids.length} grupos, ${mids.length} personas`)
}

main().catch(e => { console.error(e); process.exit(1) })
