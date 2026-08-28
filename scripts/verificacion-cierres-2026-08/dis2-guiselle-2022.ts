/**
 * Corrección del grupo "Discipulos 2. Guiselle Trejos. Junio 2022" con el
 * formulario de fin que la dirigente envió (tarde, el 2026-05-10).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/dis2-guiselle-2022.ts
 *   aplicar:  ... dis2-guiselle-2022.ts --aplicar
 *
 * QUÉ PASÓ. El formulario dice que tres personas REPROBARON y la base las tiene
 * como aprobadas (una, en_revision). El usuario confirmó que la dirigente tiene
 * razón, y aportó el dato que faltaba: esa gente volvió a llevar Discípulos 2
 * después y ahí sí lo pasó.
 *
 * POR QUÉ NO ES UN UPDATE Y YA. José Avendaño tiene UNA sola matrícula de DIS2
 * —la de 2022— y con `completed_at = 2025-04-17`: la aprobación del segundo
 * intento se escribió encima de la del primero, porque era la única fila donde
 * ponerla (el grupo del retake nunca entró al sistema; no hay ningún DIS2 que
 * termine entre febrero y mayo de 2025). Marcar esa fila como reprobada, sin
 * más, borraría la única prueba de que aprobó.
 *
 * Por eso se PARTE en dos: la del 2022 queda reprobada, y la aprobación se
 * mueve a una matrícula propia sin grupo. Sin grupo no es un parche: 22.343 de
 * las 36.680 matrículas de esta base son así, y 521 son DIS2 aprobados.
 */
import { writeFileSync } from 'node:fs'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const GRUPO = 'Discipulos 2. Guiselle Trejos. Junio 2022'
const NOTA = 'Reprobado según el formulario de fin de capacitación de la dirigente (Guiselle Trejos)'

/** Los tres que el formulario reporta como reprobados y la base no.
 *  `apruebaLuego` = fecha en que la persona volvió a llevar DIS2 y lo pasó; esa
 *  aprobación se conserva en una matrícula aparte. */
const CASOS: Array<{ nombre: string; deStatus: string; apruebaLuego: string | null }> = [
  { nombre: 'Jose Manuel Avendano Molina', deStatus: 'completed', apruebaLuego: '2025-04-17' },
  { nombre: 'Daniela Camacho Hernández', deStatus: 'completed', apruebaLuego: null },
  { nombre: 'Rigoberto Jimenez Chavarria', deStatus: 'en_revision', apruebaLuego: null },
]

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const db = createAdminClient() as unknown as {
    from: (t: string) => Record<string, (...a: unknown[]) => unknown>
  }

  const { data: g } = await (db.from('study_groups') as never as { select: (s: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { id: string; plan_id: string } | null }> } } })
    .select('id, plan_id').eq('name', GRUPO).maybeSingle()
  if (!g) { console.log('✗ grupo no encontrado'); process.exit(1) }

  const { data: filas } = await (db.from('study_enrollments') as never as { select: (s: string) => { eq: (a: string, b: string) => Promise<{ data: Array<{ id: string; member_id: string; status: string; completed_at: string | null; member: { first_name: string; last_name: string } }> | null }> } })
    .select('id, member_id, status, completed_at, member:members!study_enrollments_member_id_fkey(first_name, last_name)')
    .eq('group_id', g.id)
  const ins = (filas ?? []).map(f => ({ ...f, member: Array.isArray(f.member) ? f.member[0] : f.member }))

  const plan: Array<{ id: string; memberId: string; quien: string; deStatus: string; apruebaLuego: string | null }> = []
  let abortar = false
  for (const c of CASOS) {
    const f = ins.find(x => `${x.member.first_name} ${x.member.last_name}` === c.nombre)
    if (!f) { console.log(`✗ ${c.nombre}: no está en el grupo`); abortar = true; continue }
    // Guarda: la fila tiene que estar en el estado que se esperaba. Si alguien
    // ya la tocó, se salta en vez de pisar un cambio que no vimos.
    if (f.status !== c.deStatus) {
      console.log(`✗ ${c.nombre}: se esperaba '${c.deStatus}' y está en '${f.status}'`)
      abortar = true; continue
    }
    plan.push({ id: f.id, memberId: f.member_id, quien: c.nombre, deStatus: f.status, apruebaLuego: c.apruebaLuego })
  }

  console.log('══ PLAN ══')
  for (const p of plan) {
    console.log(`\n  ${p.quien}`)
    console.log(`    matrícula del grupo 2022: ${p.deStatus} → reprobado`)
    if (p.apruebaLuego) console.log(`    + matrícula NUEVA sin grupo: DIS2 completed el ${p.apruebaLuego} (el retake que sí pasó)`)
  }
  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const respaldo = ins.map(f => ({ enrollment_id: f.id, quien: `${f.member.first_name} ${f.member.last_name}`, status: f.status, completed_at: f.completed_at }))
  const ruta = `scripts/output/respaldo-dis2-guiselle-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(respaldo, null, 2))
  console.log(`\n  respaldo → ${ruta}`)

  console.log('\n── aplicando ──')
  for (const p of plan) {
    if (p.apruebaLuego) {
      const { error } = await (db.from('study_enrollments') as never as { insert: (v: unknown) => Promise<{ error: { message: string } | null }> }).insert({
        member_id: p.memberId, plan_id: g.plan_id, group_id: null,
        status: 'completed', completed_at: `${p.apruebaLuego}T12:00:00+00`,
        notes: 'Aprobado al llevar Discípulos 2 por segunda vez. El grupo de ese segundo intento no está en el sistema.',
      })
      if (error) { console.log(`  ✗ ${p.quien}: no se pudo crear la aprobación (${error.message}) — NO se marca reprobado`); continue }
      console.log(`  ✓ ${p.quien}: aprobación del ${p.apruebaLuego} guardada aparte`)
    }
    const { error } = await (db.from('study_enrollments') as never as { update: (v: unknown) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ error: { message: string } | null }> } } })
      .update({ status: 'reprobado', completed_at: null, notes: NOTA })
      .eq('id', p.id).eq('status', p.deStatus)
    if (error) { console.log(`  ✗ ${p.quien}: ${error.message}`); continue }
    console.log(`  ✓ ${p.quien}: matrícula de 2022 → reprobado`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
