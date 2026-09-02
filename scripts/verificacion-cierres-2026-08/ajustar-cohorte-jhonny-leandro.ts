/**
 * Correcciones a la cohorte de Jhonny Leandro (N3 junio 2026 → N4).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/ajustar-cohorte-jhonny-leandro.ts
 *   aplicar:  ... --aplicar
 *
 * Las dos filas que el conteo del cierre marcó como "arrastre de la
 * importación" no eran lo mismo, y ninguna era lo que parecía:
 *
 *  · LAURA SANDÍ co-dirige la cohorte, no es alumna. Estaba inscrita como
 *    estudiante con fecha de aprobación de 2022 (la importación la pegó ahí).
 *    Pasa a co_leader_id de los dos grupos y se le quita la inscripción.
 *    Como co-dirigente entra al desglose de folletos: el N4 pasa a 2 de
 *    dirigentes, y —por la regla de autoEnrollApprovedToNextLevel— un
 *    co-dirigente no paga matrícula.
 *
 *  · JESSICA SIBAJA sí llevó el N3 otra vez, en esta cohorte. Su fila tenía la
 *    aprobación de 2022 (la primera vez), así que se corrige a la fecha del
 *    cierre y se marca 'aprobado'. Con eso pasa a contar como aprobada de este
 *    cierre y avanza al N4 — repitiendo, porque ya lo aprobó en 2022, y
 *    pagando los ₡5.000 como el resto del grupo (decisión del usuario).
 *
 * Todo en una transacción: la mitad de esto aplicado deja el conteo de
 * folletos peor que antes.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const N3 = '14dbb886-f173-43a0-b019-ff532d048628'
const N4 = '45197544-64cb-45b7-aac8-7c9a69ff92ac'
const LAURA = 'ac075b7b-0621-48cc-a5be-7ec30fed6522'
const JESSICA = 'f04e361a-0000-0000-0000-000000000000' // se resuelve abajo
const FECHA_CIERRE = '2026-09-01'
const COSTO_N4 = 5000

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // El id de Jessica se busca, no se escribe a mano: hay varias Sibaja Rodriguez.
  const { rows: jes } = await c.query<{ id: string; nombre: string }>(`
    select m.id, m.first_name||' '||m.last_name nombre
    from members m join study_enrollments e on e.member_id = m.id
    where e.group_id = $1 and m.first_name = 'Jessica' and m.last_name like 'Sibaja%'`, [N3])
  if (jes.length !== 1) throw new Error(`se esperaba 1 Jessica en el N3, hay ${jes.length}`)
  const jessica = jes[0].id
  void JESSICA

  console.log('── antes ──')
  const antes = await c.query(`
    select g.name grupo, coalesce(cm.first_name||' '||cm.last_name,'(sin co-dirigente)') codirigente
    from study_groups g left join members cm on cm.id = g.co_leader_id
    where g.id in ($1,$2)`, [N3, N4])
  for (const r of antes.rows) console.log(`  ${r.grupo}: ${r.codirigente}`)
  const je = await c.query(`select status, notes, completed_at::date f from study_enrollments where group_id=$1 and member_id=$2`, [N3, jessica])
  console.log(`  Jessica en el N3: ${je.rows[0]?.status} · notes=${je.rows[0]?.notes ?? 'null'} · aprobada ${je.rows[0]?.f?.toISOString?.().slice(0,10) ?? je.rows[0]?.f}`)
  const enN4 = await c.query(`select count(*) n from study_enrollments where group_id=$1 and member_id=$2`, [N4, jessica])
  console.log(`  Jessica en el N4: ${enN4.rows[0].n === '0' ? 'sin matrícula' : 'ya matriculada'}`)

  console.log('\n── lo que se haría ──')
  console.log('  1. Laura Sandí → co-dirigente del N3 y del N4')
  console.log('  2. Laura Sandí → se elimina su inscripción de estudiante en el N3')
  console.log(`  3. Jessica Sibaja → aprobada del N3 con fecha ${FECHA_CIERRE}`)
  console.log(`  4. Jessica Sibaja → matriculada en el N4 + cobro pendiente de ₡${COSTO_N4.toLocaleString('es-CR')}`)
  console.log('  5. Tiquete de folletos → 7 estudiantes + 2 dirigentes = 9\n')

  if (!APLICAR) { console.log('(dry-run) Correlo con --aplicar.'); await c.end(); return }

  await c.query('begin')
  try {
    // 1 y 2 · Laura pasa de alumna a co-dirigente.
    const co = await c.query(
      `update study_groups set co_leader_id = $1, updated_at = now()
       where id in ($2,$3) and co_leader_id is null returning name`, [LAURA, N3, N4])
    console.log(`  ✓ Laura co-dirigente de ${co.rowCount} grupo(s)`)
    const borr = await c.query(
      `delete from study_enrollments where group_id = $1 and member_id = $2 returning id`, [N3, LAURA])
    console.log(`  ✓ inscripción de estudiante eliminada (${borr.rowCount})`)

    // 3 · Jessica aprobó ESTE N3, no el de 2022.
    const apr = await c.query(
      `update study_enrollments
       set status = 'completed', notes = 'aprobado', completed_at = $3::date, updated_at = now()
       where group_id = $1 and member_id = $2 returning id`, [N3, jessica, FECHA_CIERRE])
    console.log(`  ✓ Jessica aprobada del N3 (${apr.rowCount})`)

    // 4 · Matrícula en el N4 + cobro, igual que las otras 6 del grupo.
    //     Repite el nivel a propósito: ya lo aprobó en 2022.
    const ins = await c.query(
      `insert into study_enrollments (group_id, member_id, status, enrolled_at, notes)
       values ($1, $2, 'enrolled', $3::date, 'Repite el nivel: aprobó el N4 en 2022')
       returning id`, [N4, jessica, FECHA_CIERRE])
    const enrollmentId = (ins.rows[0] as { id: string }).id
    console.log(`  ✓ Jessica matriculada en el N4 (${enrollmentId.slice(0, 8)})`)

    const folleto = await c.query(`select id from folleto_requests where source_group_id = $1 limit 1`, [N4])
    const folletoId = (folleto.rows[0] as { id: string } | undefined)?.id ?? null
    await c.query(
      `insert into payments (member_id, enrollment_id, concept, amount, currency, status, folleto_request_id)
       values ($1, $2, 'matricula', $3, 'CRC', 'pending', $4)`,
      [jessica, enrollmentId, COSTO_N4, folletoId])
    console.log(`  ✓ cobro pendiente de ₡${COSTO_N4.toLocaleString('es-CR')} creado${folletoId ? ' y ligado al tiquete' : ''}`)

    // 5 · El tiquete: 7 estudiantes matriculados y 2 dirigentes.
    const { rows: cuenta } = await c.query<{ n: string }>(
      `select count(*) n from study_enrollments
       where group_id = $1 and status in ('enrolled','pendiente_de_pago')`, [N4])
    const fol = await c.query(
      `update folleto_requests set quantity = $2, quantity_leaders = 2, updated_at = now()
       where source_group_id = $1 returning quantity, quantity_leaders`, [N4, Number(cuenta[0].n)])
    const f = fol.rows[0] as { quantity: number; quantity_leaders: number } | undefined
    if (f) console.log(`  ✓ tiquete: ${f.quantity} estudiantes + ${f.quantity_leaders} dirigentes = ${f.quantity + f.quantity_leaders}`)

    await c.query('commit')
    console.log('\n  ✅ aplicado')
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
