/**
 * Jessica Sibaja llevó el Nivel 3 DOS veces: en 2022 y otra vez en 2026 con
 * Jhonny Leandro. Las dos aprobaciones se quedan, cada una en su fila.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/restaurar-n3-2022-jessica.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ PASÓ. Al corregir la aprobación de esta cohorte le sobreescribí la fecha
 * de la fila existente (2022-01-28 → 2026-09-01), y con eso desapareció el
 * registro de que ya lo había llevado en 2022. La corrección era necesaria
 * —esa fila SÍ es la de la cohorte de Jhonny— pero le faltaba crear la otra.
 *
 * CÓMO SE GUARDA. Con `plan_id` y sin grupo, que es exactamente el patrón de
 * sus otras aprobaciones históricas: el N1 de 2020, el N2 de 2022 y el REDESC
 * de 2021 están todos así. No se le inventa un grupo de 2022 porque no hay
 * forma de saber cuál fue — existen seis candidatos y ninguna evidencia.
 *
 * Y no es un caso raro: la misma Jessica ya tiene el N1 dos veces (2020 y
 * 2026) y el N2 dos veces (2022 y 2026), en filas separadas. Esto la deja
 * consistente con su propio historial.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** La fecha que traía la fila antes de que yo la sobreescribiera. */
const APROBACION_2022 = '2022-01-28'

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows: jes } = await c.query<{ id: string; nombre: string }>(
    `select id, first_name||' '||last_name nombre from members
     where first_name = 'Jessica' and last_name like 'Sibaja%'`)
  if (jes.length !== 1) throw new Error(`se esperaba 1 Jessica Sibaja, hay ${jes.length}`)
  const { id: jessica, nombre } = jes[0]

  const { rows: plan } = await c.query<{ id: string }>(`select id from study_plans where code = 'N3'`)
  if (plan.length !== 1) throw new Error('no se encontró el plan N3')
  const planN3 = plan[0].id

  console.log(`${nombre}\n`)
  console.log('── aprobaciones del N3 que tiene hoy ──')
  const { rows: hoy } = await c.query<{ apr: string | null; grupo: string | null; notes: string | null }>(
    `select e.completed_at::date::text apr, g.name grupo, e.notes
     from study_enrollments e
     left join study_groups g on g.id = e.group_id
     left join study_plans p on p.id = g.plan_id
     where e.member_id = $1 and (e.plan_id = $2 or p.id = $2)
     order by e.completed_at`, [jessica, planN3])
  for (const r of hoy) console.log(`  ${r.apr ?? '(sin fecha)'} · ${r.grupo ?? '(sin grupo)'} · notes=${r.notes ?? 'null'}`)

  const yaEsta = hoy.some(r => r.apr === APROBACION_2022)
  if (yaEsta) { console.log('\nLa de 2022 ya está: no hay nada que hacer.'); await c.end(); return }

  console.log(`\n── se agregaría ──`)
  console.log(`  ${APROBACION_2022} · (sin grupo) · plan_id del N3 · notes='Primera vez que llevó el nivel'`)
  console.log(`\n  Queda con ${hoy.length + 1} aprobaciones del N3, sin unificar.`)

  if (!APLICAR) { console.log('\n(dry-run) Correlo con --aplicar.'); await c.end(); return }

  const { rows: creada } = await c.query<{ id: string }>(
    `insert into study_enrollments (member_id, plan_id, status, completed_at, enrolled_at, notes)
     values ($1, $2, 'completed', $3::date, $3::date, 'Primera vez que llevó el nivel (aprobación de 2022, sin grupo registrado)')
     returning id`, [jessica, planN3, APROBACION_2022])
  console.log(`\n  ✓ aprobación de ${APROBACION_2022} restaurada (${creada[0].id.slice(0, 8)})`)

  const { rows: final } = await c.query<{ apr: string; grupo: string | null }>(
    `select e.completed_at::date::text apr, g.name grupo
     from study_enrollments e
     left join study_groups g on g.id = e.group_id
     left join study_plans p on p.id = g.plan_id
     where e.member_id = $1 and (e.plan_id = $2 or p.id = $2)
     order by e.completed_at`, [jessica, planN3])
  console.log('\n  N3 de Jessica, estado final:')
  for (const r of final) console.log(`    ${r.apr} · ${r.grupo ?? '(sin grupo)'}`)
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
