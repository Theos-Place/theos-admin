/**
 * Recalcula TODAS las listas guardadas que se puedan recalcular.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/refrescar-listas.ts
 *   aplicar:  ... --aplicar
 *
 * Puesta al día de una sola vez. Las listas guardaban `filters` pero nada los
 * volvía a correr, así que su membresía quedó congelada en el día que se
 * crearon (ver recomputeMemberList). De ahora en adelante las dinámicas se
 * recalculan solas al abrirlas; esto arregla lo acumulado.
 *
 * Una lista SIN filtros guardados no se toca: su membresía es la única
 * definición que tiene. Se reportan aparte porque hay que rehacerlas a mano.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { getMemberLists, recomputeMemberList } = await import('../../src/lib/supabase/queries/member-lists')
  const { getMemberIds } = await import('../../src/lib/supabase/queries/members')
  const { motivoNoRecalculable } = await import('../../src/lib/members/list-refresh')

  const listas = await getMemberLists()
  const bloqueadas = listas.filter(l => motivoNoRecalculable(l.filters))
  const recalculables = listas.filter(l => !motivoNoRecalculable(l.filters))

  console.log(`listas guardadas: ${listas.length} · recalculables: ${recalculables.length} · bloqueadas: ${bloqueadas.length}\n`)
  console.log('NOMBRE'.padEnd(44), 'TIPO'.padEnd(10), 'ANTES'.padStart(7), 'AHORA'.padStart(7), '  CAMBIO')
  for (const l of recalculables) {
    const f = l.filters
    let despues: number
    try {
      const r = APLICAR
        ? await recomputeMemberList(l.id)
        : { ok: true as const, despues: (await getMemberIds({
            conditions: f.conditions, groups: f.groups,
            is_donor: f.is_donor || undefined, is_server: f.is_server || undefined,
          })).total }
      if (!r.ok) { console.log(`${l.name.slice(0, 42).padEnd(44)} ✗ ${r.motivo}`); continue }
      despues = r.despues
    } catch (e) {
      console.log(`${l.name.slice(0, 42).padEnd(44)} ✗ falló: ${(e as Error).message}`); continue
    }
    const dif = despues - l.member_count
    console.log(
      l.name.slice(0, 42).padEnd(44),
      (l.is_dynamic ? 'dinámica' : 'snapshot').padEnd(10),
      String(l.member_count).padStart(7), String(despues).padStart(7),
      dif === 0 ? '   =' : `   ${dif > 0 ? '+' : ''}${dif}`,
    )
  }

  if (bloqueadas.length) {
    console.log(`\n══ NO SE TOCAN (${bloqueadas.length}) ══`)
    const porMotivo = new Map<string, typeof bloqueadas>()
    for (const l of bloqueadas) {
      const m = motivoNoRecalculable(l.filters)!
      porMotivo.set(m, [...(porMotivo.get(m) ?? []), l])
    }
    for (const [motivo, ls] of porMotivo) {
      console.log(`\n  ${motivo}`)
      for (const l of ls) {
        console.log(`    · ${l.name.padEnd(42)} ${l.is_dynamic ? 'dinámica' : 'snapshot'} · ${l.member_count} miembros`)
      }
    }
  }
  if (!APLICAR) console.log('\n(dry-run — no se escribió nada)')
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
