/**
 * Fusión de GRUPOS GEMELOS: el mismo grupo real cargado con dos nombres.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/fusionar-grupos.ts
 *   aplicar:  ... fusionar-grupos.ts --aplicar
 *
 * Se corre ANTES de limpiar matrículas duplicadas. Al revés no funciona: la
 * limpieza no ve como duplicadas dos matrículas en grupos distintos, así que
 * dejaría una en cada gemelo y la fusión las volvería a juntar.
 *
 * CÓMO SE DETECTAN: mismo plan, mismo dirigente, fechas de inicio a menos de
 * 120 días, y al menos UNA persona matriculada en los dos. Ese último dato es
 * el que distingue un gemelo de dos cohortes seguidas del mismo dirigente.
 *
 * LO QUE NO SE FUSIONA: si los nombres mencionan días u horarios DISTINTOS
 * (lunes/martes, mañana/noche, virtual/presencial) son grupos de verdad
 * distintos aunque compartan gente. Verificado el 2026-08-25: "Campaña José
 * Pablo Rojas Martes 2019" y "…Lunes 2019" comparten 8 personas y NO son el
 * mismo grupo.
 *
 * QUIÉN SOBREVIVE (decisión del usuario): la convención ESTÁNDAR, o sea el
 * nombre SIN el código de campaña ("Transformados. Luis Hernández. Julio 2025"
 * y no "Transformados 2025 - G104 Luis Javier Hernandez"). Si ninguno tiene
 * código, sobrevive el que tenga más matrículas.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

/** Trae la tabla COMPLETA. Sin esto PostgREST devuelve solo 1000 filas y el
 *  cálculo sale en cero sin dar ningún error — pasó tres veces el 2026-08-25
 *  con tablas de 2.225 y 40.000 filas. */
async function todo<T>(tabla: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await admin.from(tabla).select(select).range(d, d + 999).order('id')
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

/** Palabras que indican grupos DISTINTOS aunque compartan dirigente y fecha. */
const DISTINTO = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|tarde|noche|virtual|presencial)\b/i
/** Código de campaña: "G104", "G31". Es la convención que NO sobrevive. */
const CODIGO_CAMPANA = /\bG\s?\d+\b/

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')

  const grupos = await todo<any>('study_groups', 'id, name, plan_id, leader_id, starts_at, created_at, status')
  const enr = await todo<any>('study_enrollments', 'id, member_id, group_id')
  const porGrupo = new Map<string, Array<{ id: string; member_id: string }>>()
  for (const e of enr) {
    if (!e.group_id) continue
    porGrupo.set(e.group_id, [...(porGrupo.get(e.group_id) ?? []), e])
  }
  const ms = (g: any) => new Date(g.starts_at ?? g.created_at ?? 0).getTime()

  type Par = { queda: any; sobra: any; comunes: number }
  const fusiones: Par[] = [], noFusionar: string[] = []
  const lista = grupos
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j]
      if (a.plan_id !== b.plan_id || !a.leader_id || a.leader_id !== b.leader_id) continue
      if (Math.abs(ms(a) - ms(b)) >= 120 * 86_400_000) continue
      const ma = new Set((porGrupo.get(a.id) ?? []).map(e => e.member_id))
      const comunes = (porGrupo.get(b.id) ?? []).filter(e => ma.has(e.member_id)).length
      if (comunes === 0) continue
      const dA = (a.name.match(DISTINTO) ?? [])[0]?.toLowerCase()
      const dB = (b.name.match(DISTINTO) ?? [])[0]?.toLowerCase()
      if (dA && dB && dA !== dB) {
        noFusionar.push(`${a.name}  ·vs·  ${b.name}   ("${dA}" / "${dB}")`)
        continue
      }
      // Sobrevive el que NO trae código de campaña; si empatan, el de más gente.
      const aEsCampana = CODIGO_CAMPANA.test(a.name), bEsCampana = CODIGO_CAMPANA.test(b.name)
      let queda = a, sobra = b
      if (aEsCampana && !bEsCampana) { queda = b; sobra = a }
      else if (aEsCampana === bEsCampana) {
        const na = (porGrupo.get(a.id) ?? []).length, nb = (porGrupo.get(b.id) ?? []).length
        if (nb > na) { queda = b; sobra = a }
      }
      fusiones.push({ queda, sobra, comunes })
    }
  }

  let mover = 0, borrarEnr = 0
  console.log(`══ FUSIONES (${fusiones.length}) ══`)
  for (const f of fusiones) {
    const enQueda = new Set((porGrupo.get(f.queda.id) ?? []).map(e => e.member_id))
    const delSobra = porGrupo.get(f.sobra.id) ?? []
    const aMover = delSobra.filter(e => !enQueda.has(e.member_id))
    const aBorrar = delSobra.filter(e => enQueda.has(e.member_id))
    mover += aMover.length; borrarEnr += aBorrar.length
    console.log(`  ✓ queda: ${f.queda.name}`)
    console.log(`    borra: ${f.sobra.name}`)
    console.log(`           ${aBorrar.length} matrículas repetidas · ${aMover.length} se mueven al que queda`)
  }
  if (noFusionar.length) {
    console.log(`\n══ NO SE FUSIONAN (${noFusionar.length}) — son grupos distintos ══`)
    for (const n of noFusionar) console.log(`  · ${n}`)
  }
  // ¿Hay algo MÁS colgando de los grupos que se van? study_groups tiene 15
  // claves foráneas apuntándole; borrar sin mirar arrastraría datos en cascada
  // (evaluaciones, tickets de folletos, sesiones) o los dejaría en NULL.
  const idsSobran = fusiones.map(f => f.sobra.id)
  const REFS: Array<[string, string]> = [
    ['leader_evaluations', 'group_id'], ['study_sessions', 'group_id'],
    ['finance_requests', 'study_group_id'], ['folleto_requests', 'source_group_id'],
    ['payments', 'study_group_id'], ['evaluation_tickets', 'group_id'],
    ['cdeb_recommendations', 'group_id'], ['member_recommendations', 'study_group_id'],
    ['prematrimonial_evaluations', 'group_id'],
  ]
  const colgando: string[] = []
  for (const [tabla, col] of REFS) {
    const { data, error } = await admin.from(tabla).select('id').in(col, idsSobran).limit(5)
    if (error) { colgando.push(`${tabla}: no se pudo consultar (${error.message})`); continue }
    if ((data ?? []).length) colgando.push(`${tabla}.${col}: ${(data ?? []).length}+ filas`)
  }
  console.log(`\n══ ¿QUEDA ALGO COLGANDO DE LOS 27? ══`)
  console.log(colgando.length ? '  ⚠️  ' + colgando.join('\n  ⚠️  ') : '  nada: solo tenían matrículas')

  console.log(`\n  grupos a eliminar:       ${fusiones.length}`)
  console.log(`  matrículas a mover:      ${mover}`)
  console.log(`  matrículas a borrar:     ${borrarEnr}`)

  if (colgando.length) {
    console.log('\n✗ ABORTADO: hay datos colgando de los grupos a borrar. Revisar antes.')
    return
  }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  console.log('\n── aplicando ──')
  for (const f of fusiones) {
    const enQueda = new Set((porGrupo.get(f.queda.id) ?? []).map(e => e.member_id))
    const delSobra = porGrupo.get(f.sobra.id) ?? []
    const aMover = delSobra.filter(e => !enQueda.has(e.member_id)).map(e => e.id)
    const aBorrar = delSobra.filter(e => enQueda.has(e.member_id)).map(e => e.id)
    if (aBorrar.length) {
      const { error } = await admin.from('study_enrollments').delete().in('id', aBorrar)
      if (error) { console.log(`  ✗ ${f.sobra.name}: ${error.message}`); continue }
    }
    if (aMover.length) {
      const { error } = await admin.from('study_enrollments').update({ group_id: f.queda.id }).in('id', aMover)
      if (error) { console.log(`  ✗ mover ${f.sobra.name}: ${error.message}`); continue }
    }
    const { error } = await admin.from('study_groups').delete().eq('id', f.sobra.id)
    console.log(error ? `  ✗ borrar ${f.sobra.name}: ${error.message}` : `  ✓ ${f.sobra.name}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
