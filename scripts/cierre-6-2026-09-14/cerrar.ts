/**
 * Cerrar los grupos que ya tienen a TODOS evaluados y siguen en curso.
 *   dry-run:  npx tsx scripts/cierre-6-2026-09-14/cerrar.ts
 *   aplicar:  ... cerrar.ts --aplicar
 *
 * DE DÓNDE SALEN. La migración de graduaciones de CCB (etapa3-graduaciones,
 * 24-ago 22:48) le escribió el resultado a cada inscripción una por una, pero
 * nunca tocó el estado del grupo — su encabezado lo dice: "solo cambia el
 * estado de matrículas que ya existen". Así quedaron grupos con las notas
 * puestas y la puerta abierta. El de Eric Arguello es el que lo destapó: su N1
 * de junio terminó el 10 de agosto, tiene 7 aprobados y 2 reprobados, y sus 7
 * aprobados ya están en el N2 de setiembre — pero el N1 seguía "en curso", así
 * que en pantalla parecían dos grupos vivos.
 *
 * SE CIERRA CON `results` VACÍO A PROPÓSITO. close_group solo toca las
 * inscripciones en 'enrolled' y acá no queda ninguna: los resultados ya están
 * escritos desde agosto. Mandar resultados sería reescribir lo que ya está.
 *
 * closed_by queda NULL. El dirigente no cerró estos grupos —los cerró una
 * migración— y firmar con su nombre sería inventar un dato.
 *
 * NO se pasa por la ruta /close, que además dispara la matrícula automática al
 * siguiente nivel. Acá no hace falta: se verificó uno por uno que los aprobados
 * ya están en su nivel siguiente. La única excepción va reportada aparte.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { closeGroup } from '../../src/lib/supabase/queries/studies'

const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const db = createAdminClient()

  const { data: todos, error } = await db
    .from('study_groups')
    .select('id, name, ends_at, plan:study_plans(code), enrollments:study_enrollments!study_enrollments_group_id_fkey(status)')
    .eq('status', 'en_curso')
  if (error) throw new Error(`consulta: ${error.message}`)
  type Fila = { id: string; name: string; ends_at: string | null
    plan: { code: string | null } | { code: string | null }[] | null
    enrollments: Array<{ status: string | null }> }
  const filas = (todos ?? []) as unknown as Fila[]

  const cerrables = filas.filter(g =>
    g.enrollments.length > 0 &&
    g.enrollments.every(e => e.status !== 'enrolled') &&
    !!g.ends_at && g.ends_at < new Date().toISOString().slice(0, 10))

  console.log(`grupos en curso: ${filas.length}`)
  console.log(`cerrables (todos evaluados y la fecha de fin ya pasó): ${cerrables.length}\n`)
  console.table(cerrables.map(g => ({
    grupo: g.name.slice(0, 46),
    plan: (Array.isArray(g.plan) ? g.plan[0] : g.plan)?.code ?? '—',
    termino: g.ends_at,
    inscritos: g.enrollments.length,
  })))

  if (!aplicar) { console.log('\n🔎 DRY RUN — no se cerró nada.'); return }

  let ok = 0
  for (const g of cerrables) {
    try { await closeGroup(g.id, [], null); ok++ }
    catch (e) { console.log(`  ❌ ${g.name}: ${(e as Error).message}`) }
  }
  console.log(`\ncerrados: ${ok} de ${cerrables.length}`)

  const { data: post } = await db.from('study_groups')
    .select('id, name, status, closed_at, closed_by').in('id', cerrables.map(g => g.id))
  console.table((post ?? []).map(g => {
    const x = g as { name: string; status: string; closed_at: string | null; closed_by: string | null }
    return { grupo: x.name.slice(0, 46), estado: x.status, cerrado: x.closed_at?.slice(0, 10) ?? '—', por: x.closed_by ?? '(migración)' }
  }))
  console.log('\n✅ APLICADO')
})().catch(e => { console.error(e); process.exit(1) })
