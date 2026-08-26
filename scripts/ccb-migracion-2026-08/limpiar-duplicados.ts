/**
 * Limpieza de estudios completados DUPLICADOS y de la lista administrativa que
 * se coló como grupo.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/limpiar-duplicados.ts
 *   aplicar:  ... limpiar-duplicados.ts --aplicar
 *
 * Todo viene del import del 18-jul-2026. Nada de esto crea ni modifica datos de
 * personas: solo borra filas repetidas y despega matrículas de un grupo falso.
 *
 * REGLA DE DESEMPATE, en este orden:
 *   1) se queda la fila CON grupo (tiene más información que una suelta);
 *   2) entre varias, la de completed_at más ANTIGUO (la segunda es la recarga);
 *   3) NUNCA se borra una fila con pagos ligados.
 *
 * LO QUE NO SE TOCA, a propósito: cuando dos completados están separados por
 * MÁS DE SEIS MESES es una repetición real del estudio, no un duplicado, y
 * borrar uno sería borrar historia. Van al reporte.
 *
 * El criterio es el TIEMPO, no el grupo. La primera versión exigía además que
 * estuvieran en grupos distintos, y eso dejaba desprotegidos 606 pares: gente
 * que repitió el estudio años después pero cuya matrícula vieja no tiene grupo
 * (p. ej. N1 en 2018 y otra vez en 2023, las dos sueltas). Con el criterio de
 * grupo se habrían borrado.
 *
 * Por qué seis meses y no un año: los duplicados de carga se reconocen porque
 * comparten la fecha del LOTE. Verificado el 2026-08-25 — tres personas
 * distintas con UFA, todas con la fila del grupo el 2017-07-27 y la suelta el
 * 2017-12-20. Un estudio dura 8 a 12 semanas, así que dos completados a menos
 * de seis meses no son dos cohortes: son la misma cargada dos veces.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'

const APLICAR = process.argv.includes('--aplicar')
const LISTA = 'Nuevos EB- Transformados 2025'
/** Separación a partir de la cual dos completados NO se consideran el mismo
 *  hecho cargado dos veces, sino una repetición real del estudio. */
const SEIS_MESES_MS = 181 * 24 * 3600 * 1000
const admin = createAdminClient() as unknown as { from: (t: string) => any }

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

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')

  const grupos = await todo<any>('study_groups', 'id, name')
  const nombreDe = new Map(grupos.map(g => [g.id, g.name]))
  const listaId = grupos.find(g => g.name === LISTA)?.id ?? null
  const enrolls = await todo<any>('study_enrollments', 'id, member_id, plan_id, group_id, status, completed_at')
  const pagos = await todo<any>('payments', 'enrollment_id')
  const conPago = new Set(pagos.map(p => p.enrollment_id).filter(Boolean))

  // ── A · la lista administrativa ────────────────────────────────────────────
  const enLista = listaId ? enrolls.filter(e => e.group_id === listaId) : []
  const tieneOtroTrans = new Set<string>()
  if (listaId) {
    const planLista = enrolls.find(e => e.group_id === listaId)?.plan_id
    for (const e of enrolls) {
      if (e.plan_id === planLista && e.group_id && e.group_id !== listaId) tieneOtroTrans.add(e.member_id)
    }
  }
  const listaBorrar = enLista.filter(e => tieneOtroTrans.has(e.member_id) && !conPago.has(e.id))
  const listaDespegar = enLista.filter(e => !tieneOtroTrans.has(e.member_id))

  console.log('══ A · LISTA ADMINISTRATIVA ══')
  console.log(`  "${LISTA}" · ${enLista.length} matrículas`)
  console.log(`    a BORRAR (ya tienen el estudio en un grupo real): ${listaBorrar.length}`)
  console.log(`    a DESPEGAR del grupo, conservando el completado:  ${listaDespegar.length}`)
  console.log(`    → son gente cuyo ÚNICO Transformados es este. Borrarlo se lo quita;`)
  console.log(`      despegarlo deja la matrícula sin grupo, como las 25.610 del histórico.`)
  console.log(`    y después se borra el grupo (queda vacío).`)

  // ── B · duplicados generales ───────────────────────────────────────────────
  // Se calcula SIN las filas de la lista, que ya se resolvieron arriba.
  const idsLista = new Set([...listaBorrar, ...listaDespegar].map(e => e.id))
  const completadas = enrolls.filter(e => e.status === 'completed' && !idsLista.has(e.id))
  const porClave = new Map<string, any[]>()
  for (const e of completadas) {
    const k = `${e.member_id}|${e.plan_id}`
    porClave.set(k, [...(porClave.get(k) ?? []), e])
  }

  const borrar: any[] = [], repeticionReal: string[] = [], bloqueadasPorPago: string[] = []
  const heredarFecha: Array<{ id: string; completed_at: string }> = []
  for (const [, filas] of porClave) {
    if (filas.length < 2) continue
    // Repetición REAL: más de seis meses entre completados.
    //
    // Se mide solo con las filas QUE TIENEN fecha. Las que no la tienen no son
    // una repetición: son la misma cosa cargada sin ese dato, y no aportan nada
    // que la fechada no tenga. La primera versión mandaba todo el par a
    // "repetición real" en cuanto una fecha faltaba, y así protegía cientos de
    // duplicados obvios (misma persona, mismo plan, una con fecha y otra sin).
    const fechas = filas.map(f => f.completed_at ? new Date(f.completed_at).getTime() : null)
      .filter((x): x is number => x !== null).sort((a, b) => a - b)
    if (fechas.length >= 2 && fechas[fechas.length - 1] - fechas[0] > SEIS_MESES_MS) {
      repeticionReal.push(filas
        .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)))
        .map(f => `${nombreDe.get(f.group_id) ?? '(sin grupo)'} (${String(f.completed_at).slice(0, 10)})`).join('  ·  '))
      continue
    }
    const orden = [...filas].sort((a, b) =>
      (a.group_id ? 0 : 1) - (b.group_id ? 0 : 1)
      || String(a.completed_at ?? '9999').localeCompare(String(b.completed_at ?? '9999')))
    const [queda, ...sobran] = orden
    // Si el que se queda es el del GRUPO pero no tiene fecha, y una de las que
    // se van sí la tiene, se la hereda. Si no, quedarse con el grupo costaría
    // perder la fecha — y las dos cosas son datos reales del mismo hecho.
    if (!queda.completed_at) {
      const conFecha = sobran.map(f => f.completed_at).filter(Boolean).sort()[0]
      if (conFecha) heredarFecha.push({ id: queda.id, completed_at: conFecha })
    }
    for (const s of sobran) {
      if (conPago.has(s.id)) { bloqueadasPorPago.push(s.id); continue }
      borrar.push(s)
    }
  }

  console.log(`\n══ B · DUPLICADOS ══`)
  console.log(`  filas a borrar:                       ${borrar.length}`)
  console.log(`  bloqueadas por tener pagos:           ${bloqueadasPorPago.length}`)
  console.log(`  repeticiones REALES que NO se tocan:  ${repeticionReal.length}`)
  console.log(`  filas que HEREDAN la fecha de su duplicada: ${heredarFecha.length}`)
  console.log(`    (más de 6 meses entre completados, o alguna sin fecha)`)
  for (const r of repeticionReal.slice(0, 8)) console.log(`      · ${r}`)
  if (repeticionReal.length > 8) console.log(`      … y ${repeticionReal.length - 8} más`)

  // ── VERIFICACIÓN QUE NO PUEDE FALLAR ───────────────────────────────────────
  // Después de borrar, TODA combinación (persona, plan) que tenía al menos un
  // completado tiene que seguir teniendo al menos uno. Si esto no se cumple,
  // alguien pierde un estudio de su expediente y hay que parar.
  const aBorrar = new Set([...listaBorrar, ...borrar].map(e => e.id))
  const antes = new Set<string>(), despues = new Set<string>()
  for (const e of enrolls) {
    if (e.status !== 'completed') continue
    const k = `${e.member_id}|${e.plan_id}`
    antes.add(k)
    if (!aBorrar.has(e.id)) despues.add(k)
  }
  // Las despegadas conservan su completado: siguen contando.
  for (const e of listaDespegar) despues.add(`${e.member_id}|${e.plan_id}`)
  const perdidos = [...antes].filter(k => !despues.has(k))

  console.log(`\n══ VERIFICACIÓN ══`)
  console.log(`  combinaciones (persona, estudio) con completado ANTES:   ${antes.size}`)
  console.log(`  ídem DESPUÉS:                                            ${despues.size}`)
  console.log(`  ${perdidos.length === 0 ? '✓ nadie pierde un estudio' : `✗ ${perdidos.length} PERDERÍAN un estudio — PARAR`}`)
  const personas = new Set([...listaBorrar, ...borrar].map(e => e.member_id)).size
  console.log(`  personas tocadas: ${personas}`)

  console.log(`\n══ TOTAL A BORRAR: ${listaBorrar.length + borrar.length} filas ══`)

  if (perdidos.length > 0) {
    console.log('\n✗ ABORTADO: la limpieza dejaría a alguien sin un estudio que tenía.')
    return
  }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  console.log('\n── aplicando ──')
  let n = 0
  for (const grupo of [listaBorrar, borrar]) {
    for (let i = 0; i < grupo.length; i += 200) {
      const ids = grupo.slice(i, i + 200).map(e => e.id)
      const { error } = await admin.from('study_enrollments').delete().in('id', ids)
      if (error) { console.log(`  ✗ lote: ${error.message}`); continue }
      n += ids.length
    }
  }
  console.log(`  filas borradas: ${n}`)
  for (const h of heredarFecha) {
    const { error } = await admin.from('study_enrollments')
      .update({ completed_at: h.completed_at }).eq('id', h.id).is('completed_at', null)
    if (error) console.log(`  ✗ heredar fecha: ${error.message}`)
  }
  if (heredarFecha.length) console.log(`  fechas heredadas: ${heredarFecha.length}`)
  if (listaDespegar.length) {
    const ids = listaDespegar.map(e => e.id)
    const { error } = await admin.from('study_enrollments').update({ group_id: null }).in('id', ids)
    console.log(error ? `  ✗ despegar: ${error.message}` : `  despegadas del grupo: ${ids.length}`)
  }
  if (listaId) {
    const { error } = await admin.from('study_groups').delete().eq('id', listaId)
    console.log(error ? `  ✗ borrar la lista: ${error.message}` : `  lista "${LISTA}" borrada`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
