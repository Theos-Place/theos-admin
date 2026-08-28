/**
 * Reconstruye el filtro completo de las listas guardadas antes de la corrección.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/rehacer-listas.ts
 *   aplicar:  ... --aplicar
 *
 * EL PROBLEMA. Al guardar una lista solo se persistían `conditions` y `groups`,
 * mientras la pantalla de miembros filtraba además por los chips de
 * Donantes/Servidores y por el de asistencia. Sin esos, recalcular "Invitación
 * N1" da 14.848 en vez de 260.
 *
 * CÓMO SE RECUPERA LO QUE FALTA, sin adivinar:
 *
 *  · Los chips de Donantes/Servidores SÍ quedaron escritos, en `segment_label`
 *    (buildSegmentLabel los antepone: "Donadores · Servidores · ...").
 *
 *  · El de asistencia no quedó en ningún lado, así que se DEDUCE probando: se
 *    corre el filtro con cada valor posible y gana el que reproduce mejor la
 *    membresía que la lista ya tiene guardada. Es la misma idea que usar el
 *    roster para identificar un grupo: la respuesta correcta es la que explica
 *    los datos que ya existen.
 *
 * OJO CON LA DERIVA. Los datos cambiaron desde que se guardaron (el 21 de
 * agosto): hoy mismo se cerraron 15 grupos, y eso mueve los "no ha llevado".
 * Por eso no se exige coincidencia exacta sino la MEJOR, y se reporta cuánto
 * coincide para poder juzgarla.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

type Candidato = { attendance: undefined | true | 'estudios'; etiqueta: string }
const CANDIDATOS: Candidato[] = [
  { attendance: undefined, etiqueta: 'sin filtro de asistencia' },
  { attendance: true, etiqueta: 'chip "Activos"' },
  { attendance: 'estudios', etiqueta: 'chip "Asistencia estudios"' },
]

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 1 : inter / union
}

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { getMemberLists, updateMemberList } = await import('../../src/lib/supabase/queries/member-lists')
  const { getMemberIds } = await import('../../src/lib/supabase/queries/members')

  const listas = (await getMemberLists()).filter(l => l.filters?.conditions?.length && l.filters.v !== 2)
  console.log(`listas a reconstruir: ${listas.length}\n`)

  for (const l of listas) {
    // Los chips quedaron en la etiqueta. Se leen del PREFIJO, que es donde
    // buildSegmentLabel los pone, para no confundirlos con una condición que
    // diga "donor" en medio del texto.
    const lab = l.segment_label ?? ''
    const is_donor = /^Donadores(\s·|$)/.test(lab) || lab.startsWith('Donadores · ')
    const is_server = /(^|·\s)Servidores(\s·|$)/.test(lab)

    const guardados = new Set(l.member_ids)
    const pruebas: Array<{ c: Candidato; total: number; sim: number; ids: string[] }> = []
    for (const c of CANDIDATOS) {
      const { ids, total } = await getMemberIds({
        conditions: l.filters.conditions, groups: l.filters.groups,
        is_donor: is_donor || undefined, is_server: is_server || undefined,
        active_attendance: c.attendance,
      })
      pruebas.push({ c, total, sim: jaccard(guardados, new Set(ids)), ids })
    }
    pruebas.sort((a, b) => b.sim - a.sim)
    const [mejor, segundo] = pruebas

    console.log(`■ ${l.name}  (guardada con ${l.member_count})`)
    console.log(`    chips leídos de la etiqueta: ${[is_donor && 'Donantes', is_server && 'Servidores'].filter(Boolean).join(' + ') || 'ninguno'}`)
    for (const p of pruebas) {
      console.log(`      ${p === mejor ? '→' : ' '} ${p.c.etiqueta.padEnd(28)} da ${String(p.total).padStart(6)}  ·  coincide ${(p.sim * 100).toFixed(0)}%`)
    }
    // Si el mejor no despega del segundo, no hay una respuesta: se reporta.
    if (mejor.sim < 0.5 || (mejor.sim - segundo.sim) < 0.15) {
      console.log(`      ⚠️  NO SE PUEDE DECIDIR: el mejor no se despega del siguiente. Queda igual.\n`)
      continue
    }
    console.log(`      ✓ ${mejor.c.etiqueta} · quedaría con ${mejor.total}\n`)

    if (!APLICAR) continue
    await updateMemberList(l.id, {
      filters: {
        v: 2, conditions: l.filters.conditions, groups: l.filters.groups,
        is_donor: is_donor || undefined, is_server: is_server || undefined,
        active_attendance: mejor.c.attendance,
      },
      member_ids: mejor.ids, member_count: mejor.total,
    })
    console.log(`      guardada\n`)
  }
  if (!APLICAR) console.log('(dry-run — no se escribió nada)')
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
