/**
 * Borrar la aplicación de PRUEBA a «Colaborador de contenido audiovisual».
 *
 *   dry-run:  npx tsx scripts/srv-aplicacion-prueba-2026-10/borrar.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ ES: Jazmín Sánchez aplicó hoy a ese puesto del Comité Campamentos para
 * probar el flujo, y la aplicación quedó en la bandeja como si fuera real
 * (Floriana, 2026-10-07).
 *
 * POR QUÉ SE BORRA Y NO SE RECHAZA. Rechazarla la deja en el historial de
 * Jazmín como una aplicación que no prosperó, que es una historia que no
 * vivió. Una prueba no debería dejar rastro de una decisión que nadie tomó.
 *
 * LA FILA SE BUSCA, NO SE PEGA SU ID. Un id a mano no se puede verificar al
 * releerlo, y si alguien ya la borró este script no debe fallar ni —peor—
 * borrar otra cosa. Si la condición trae algo distinto de UNA fila, se
 * detiene.
 *
 * MEDIDO ANTES: nada referencia a `applications` (sin FKs entrantes) y la
 * vacante sigue con 0 de 2 cupos llenos, así que no hay contador que
 * devolver. Si estuviera aceptada habría que bajar `slots_filled`; está
 * pendiente.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const PERSONA = 'Jazmin Sanchez Arias'
const PUESTO = 'Colaborador de contenido audiovisual'
const COMITE = 'Comité Campamentos'
const APLICAR = process.argv.includes('--aplicar')

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await c.connect()
  const { rows } = await c.query(`
    select a.id, a.status, a.applied_at, a.vacancy_id, a.applicant_id,
           trim(m.first_name||' '||m.last_name) persona,
           v.title puesto, ar.name comite, v.slots_filled, v.slots_total
      from applications a
      join members m on m.id = a.applicant_id
      join vacancies v on v.id = a.vacancy_id
      left join areas ar on ar.id = v.committee_id
     where trim(m.first_name||' '||m.last_name) = $1
       and v.title = $2
       and ar.name = $3`, [PERSONA, PUESTO, COMITE])

  console.log(`${rows.length} aplicación(es) encontradas${APLICAR ? '' : '   (DRY RUN)'}`)
  for (const r of rows) {
    console.log(`  ${r.persona} → ${r.puesto} (${r.comite})`)
    console.log(`     estado: ${r.status} · aplicó: ${String(r.applied_at).slice(0, 10)}`)
    console.log(`     la vacante queda con ${r.slots_filled} de ${r.slots_total} cupos llenos`)
    console.log(`     id: ${r.id}`)
  }

  if (rows.length !== 1) {
    console.error(`\n✗ Se esperaba exactamente 1 y hay ${rows.length}. No se borra nada.`)
    await c.end(); process.exit(1)
  }
  const fila = rows[0]
  // Si estuviera aceptada, borrarla dejaría el contador de cupos inflado.
  if (fila.status === 'accepted') {
    console.error('\n✗ Está ACEPTADA: borrarla dejaría `slots_filled` contando a alguien '
      + 'que ya no está. Hay que rechazarla primero desde la pantalla.')
    await c.end(); process.exit(1)
  }

  if (!APLICAR) { console.log('\nPara aplicar: --aplicar'); await c.end(); return }

  await c.query('begin')
  try {
    // Queda en la bitácora QUÉ se borró, no solo que se borró algo: la fila
    // entera va al audit_log antes de desaparecer.
    await c.query(`
      insert into audit_log (action, entity_type, entity_id, old_data)
      values ('DELETE', 'applications', $1, $2::jsonb)`,
    [fila.id, JSON.stringify({
      persona: fila.persona, puesto: fila.puesto, comite: fila.comite,
      status: fila.status, applied_at: fila.applied_at,
      motivo: 'Aplicación de prueba, borrada a pedido de Floriana (2026-10-07)',
    })])
    const r = await c.query('delete from applications where id = $1', [fila.id])
    if (r.rowCount !== 1) throw new Error(`borró ${r.rowCount} filas, se esperaba 1`)
    await c.query('commit')
    console.log('\n✓ borrada, y la fila quedó en el audit_log')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
