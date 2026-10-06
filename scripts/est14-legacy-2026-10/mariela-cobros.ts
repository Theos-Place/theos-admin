/**
 * Mariela Saravia: partir su cobro en dos, exentarla y ajustar el folleto.
 *
 *   dry-run:  npx tsx scripts/est14-legacy-2026-10/mariela-cobros.ts
 *   aplicar:  ... --aplicar
 *
 * POR QUÉ. Su matrícula quedó con UN cobro de ₡10.000 que cubre N3+N4 —el
 * monto lo armó el bug de EST-14, aplicándole la regla de bloques a un grupo
 * legacy— mientras sus 8 compañeros tienen dos líneas de ₡5.000. El total es
 * el mismo; lo que cambia es que ella ve una sola línea y ellos dos. Floriana
 * pidió dejarlo igual (2026-10-05).
 *
 * NO ES UN ARREGLO DE PAGO. No se usa `createPaymentPlan`: un arreglo parte un
 * cobro en TRACTOS con vencimientos, y esto es otra cosa — son dos cobros de
 * dos niveles distintos, cada uno con su matrícula. Meterlo por ahí dejaría
 * un `payment_plan_id` mintiendo en la ficha.
 *
 * EXENCIÓN EN LOS DOS. Ella no sabe de ninguno de los dos cobros: el de N3 se
 * generó cuando la registraron dos minutos antes del cierre y el de N4 sale
 * de esta corrección. Misma fecha que el lote de la reparación.
 *
 * EL FOLLETO: el tiquete del grupo de N4 se creó por 8 y ahora son 9.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})
const APLICAR = process.argv.includes('--aplicar')
const PERSONA = 'Mariela Saravia Valverde'
/**
 * La exención se copia del LOTE de la reparación, no se escribe una fecha.
 *
 * La primera versión ponía '2026-10-19'::date, que es medianoche UTC — o sea
 * las 6 de la tarde del 18 en Costa Rica. Le quedaba un día menos que a sus
 * compañeros sin que se viera. Copiando el instante del lote, los 34 cobros
 * vencen exactamente igual.
 */
const EXENTO_DEL_LOTE = `(select max(p2.reminder_exempt_until) from payments p2
   where p2.reminder_exempt_until is not null)`

async function main() {
  await c.connect()
  const q = async (s: string, p?: unknown[]) => (await c.query(s, p as never)).rows

  const matriculas = await q(`
    select e.id, e.group_id, p.code nivel, g.name grupo, p.cost::int costo, p.currency
      from study_enrollments e
      join members m on m.id = e.member_id
      join study_groups g on g.id = e.group_id
      join study_plans p on p.id = g.plan_id
     where trim(m.first_name||' '||m.last_name) = $1 and p.code in ('N3','N4')
     order by p.code`, [PERSONA])
  const n3 = matriculas.find(m => m.nivel === 'N3')
  const n4 = matriculas.find(m => m.nivel === 'N4')
  if (!n3 || !n4) { console.log('Faltan sus matrículas de N3 y/o N4.'); await c.end(); return }

  const [cobro] = await q(`
    select pm.id, pm.amount::int monto, pm.status, pm.description
      from payments pm where pm.enrollment_id = $1 and pm.concept = 'matricula'
        and pm.status <> 'cancelado'`, [n3.id])
  if (!cobro) { console.log('No se encontró su cobro de Nivel 3.'); await c.end(); return }

  const yaTieneN4 = (await q(
    `select 1 from payments where enrollment_id = $1 and concept = 'matricula'
       and status <> 'cancelado'`, [n4.id])).length > 0

  // Guard: si el cobro ya no es el de ₡10.000, alguien lo tocó y este script
  // no debe pisarlo.
  const esperado = Number(n3.costo) + Number(n4.costo)
  console.log(`${PERSONA}${APLICAR ? '' : '   (DRY RUN)'}`)
  console.log(`  cobro actual: ₡${cobro.monto.toLocaleString('es-CR')} (${cobro.status}) · ${cobro.description}`)
  if (cobro.monto !== esperado) {
    console.log(`  ✗ se esperaba ₡${esperado.toLocaleString('es-CR')}. Alguien ya lo cambió: no se toca.`)
    await c.end(); process.exit(1)
  }
  console.log(`  queda:  ₡${Number(n3.costo).toLocaleString('es-CR')}  Matrícula · Nivel 3  → ${n3.grupo}`)
  console.log(`  nuevo:  ₡${Number(n4.costo).toLocaleString('es-CR')}  Matrícula · Nivel 4  → ${n4.grupo}`
    + (yaTieneN4 ? '   (YA existe, no se crea)' : ''))
  console.log('  los dos exentos del recordatorio, con la misma fecha del lote de la reparación')

  const [folleto] = await q(
    `select id, quantity from folleto_requests where source_group_id = $1`, [n4.group_id])
  const [{ n: matriculadosN4 }] = await q(
    `select count(*)::int n from study_enrollments
      where group_id = $1 and status in ('enrolled','pendiente_de_pago')`, [n4.group_id])
  console.log(`  folletos de N4: ${folleto ? `${folleto.quantity} → ${matriculadosN4}` : 'no hay tiquete'}`)

  if (!APLICAR) { console.log('\nPara aplicar: --aplicar'); await c.end(); return }

  await c.query('begin')
  try {
    await c.query(`
      update payments
         set amount = $2, description = 'Matrícula · Nivel 3',
             reminder_exempt_until = ${EXENTO_DEL_LOTE}
       where id = $1`, [cobro.id, n3.costo])
    if (!yaTieneN4) {
      await c.query(`
        insert into payments (member_id, amount, currency, payment_method, concept,
                              enrollment_id, study_group_id, entity_type, description,
                              status, reminder_exempt_until)
        select e.member_id, $2, $3, 'comprobante', 'matricula', e.id, e.group_id,
               'study_group', 'Matrícula · Nivel 4', 'pending', ${EXENTO_DEL_LOTE}
          from study_enrollments e where e.id = $1`,
      [n4.id, n4.costo, n4.currency ?? 'CRC'])
    }
    if (folleto && folleto.quantity !== matriculadosN4) {
      await c.query('update folleto_requests set quantity = $2 where id = $1',
        [folleto.id, matriculadosN4])
    }
    await c.query('commit')
    console.log('\n✓ aplicado')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
