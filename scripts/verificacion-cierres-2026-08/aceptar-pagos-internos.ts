/**
 * Acepta los pagos de matrícula de los dos grupos sucesores del cierre.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/aceptar-pagos-internos.ts
 *   aplicar:  ... --aplicar
 *
 * POR QUÉ. Esos cobros se generaron solos al cerrar (la cohorte avanza y cada
 * quien queda con su matrícula por pagar), pero el usuario decidió el
 * 2026-09-02 manejar ese dinero de forma interna. Sin esto, doce personas
 * quedan con un cobro pendiente que nadie va a pagar por el sistema y con el
 * recordatorio semanal encima.
 *
 * CÓMO. Por el RPC `approve_payment`, no con UPDATE a mano. El RPC exige
 * `review_status = 'en_revision'` y estos llegan en NULL, así que primero se
 * los pone ahí y después se aprueban — dos pasos, pero pasando por el camino
 * de siempre. Escribir los UPDATE por fuera sería la forma segura de que este
 * camino y el de finanzas se separen con el tiempo.
 *
 * El revisor queda registrado: hubo una decisión humana y la auditoría tiene
 * que poder ver de quién. (En el auto-accept del comprobante va NULL porque
 * ahí nadie revisa nada; acá no es el caso.)
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Los dos sucesores del cierre de setiembre. */
const GRUPOS = [
  '45197544-64cb-45b7-aac8-7c9a69ff92ac', // Nivel 4. Jhonny Leandro
  '46b307f3-6184-484a-bb81-e4cadff84b36', // Nivel 4. Floriana Fonseca
]
const MOTIVO = 'Aceptado sin comprobante: la matrícula de esta cohorte se maneja de forma interna (decisión del 2026-09-02).'

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Quién aprueba: la cuenta institucional de TI, que es desde donde se tomó
  // la decisión. Se busca, no se escribe a mano.
  const { rows: rev } = await c.query<{ id: string; nombre: string }>(
    `select id, first_name||' '||last_name nombre from members where email = 'ti@theosplace.org'`)
  if (rev.length !== 1) throw new Error(`se esperaba 1 revisor, hay ${rev.length}`)
  const revisor = rev[0]

  const { rows } = await c.query<{
    id: string; persona: string; grupo: string; amount: string; status: string; review_status: string | null
  }>(`
    select p.id, m.first_name||' '||m.last_name persona, g.name grupo,
           p.amount, p.status, p.review_status
    from payments p
    join study_enrollments e on e.id = p.enrollment_id
    join study_groups g on g.id = e.group_id
    join members m on m.id = p.member_id
    where e.group_id = any($1::uuid[]) and p.status = 'pending'
    order by g.name, m.first_name`, [GRUPOS])

  if (rows.length === 0) { console.log('No hay pagos pendientes en esos grupos.'); await c.end(); return }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  console.log(`revisor: ${revisor.nombre}\n`)
  for (const r of rows) console.log(`  ${r.persona.padEnd(30)} ₡${Number(r.amount).toLocaleString('es-CR')}  ${r.grupo}`)
  console.log(`\n  ${rows.length} pagos · ₡${total.toLocaleString('es-CR')} en total`)

  if (!APLICAR) { console.log('\n(dry-run) Correlo con --aplicar.'); await c.end(); return }

  await c.query('begin')
  try {
    let ok = 0
    for (const r of rows) {
      // Paso 1: el RPC solo actúa sobre 'en_revision'.
      await c.query(
        `update payments set review_status = 'en_revision',
           description = coalesce(nullif(description, '') || ' · ', '') || $2
         where id = $1`, [r.id, MOTIVO])
      // Paso 2: el camino de siempre.
      const { rows: res } = await c.query<{ approve_payment: boolean }>(
        `select approve_payment($1::uuid, $2::uuid)`, [r.id, revisor.id])
      if (res[0]?.approve_payment) ok++
      else console.warn(`  ⚠ ${r.persona}: el RPC no lo aprobó`)
    }
    if (ok !== rows.length) throw new Error(`solo se aprobaron ${ok} de ${rows.length}`)
    await c.query('commit')
    console.log(`\n  ✅ aprobados ${ok} pagos · ₡${total.toLocaleString('es-CR')}`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
