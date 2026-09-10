/**
 * Borra el pago duplicado de Adriana (decisión del usuario, 2026-09-10).
 *
 * bf8f3a4a está en 'paid' por ₡5.000 pero lleva la MISMA referencia SINPE que
 * el pago del 31 de agosto: es el mismo comprobante subido dos veces, uno por
 * cada grupo. Ella transfirió ₡5.000 una sola vez.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const ELLA='a729c17a-d79c-4936-8a93-599e3926af27'
const DUP='bf8f3a4a-1f1f-4913-bacc-ee3f696d1101'
const BUENO='7bf0f757-a357-4f3f-a581-d9fe532f1902'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  // Antes de borrar: ¿alguien más cuelga de este pago?
  console.log('— qué se iría con él')
  for (const [tabla, col] of [['refunds','payment_id'], ['finance_requests','payment_id'], ['prematrimonial_requests','payment_id']]) {
    const { rows } = await c.query(`select count(*)::int n from ${tabla} where ${col}=$1`, [DUP])
    console.log(`   ${tabla}: ${rows[0].n}`)
  }
  const { rows: archivo } = await c.query(`select receipt_path from payments where id=$1`, [DUP])
  console.log(`   comprobante en Storage: ${archivo[0]?.receipt_path ?? '—'}`)
  console.log('   (el mismo comprobante sigue guardado en el pago del 31 de agosto)')

  await c.query('BEGIN')
  const r = await c.query(`delete from payments where id=$1 and member_id=$2 and status='paid'`, [DUP, ELLA])
  if (r.rowCount !== 1) { await c.query('ROLLBACK'); throw new Error(`esperaba borrar 1 fila, borré ${r.rowCount}`) }
  await c.query('COMMIT')

  console.log('\n══ los pagos de Adriana ahora')
  console.table((await c.query(`
    select id, to_char(payment_date,'YYYY-MM-DD') fecha, status, amount, reference_code,
           receipt_path is not null comprobante, enrollment_id is not null ligado
    from payments where member_id=$1 order by created_at`, [ELLA])).rows)
  const { rows: total } = await c.query(`select coalesce(sum(amount),0) total from payments where member_id=$1 and status='paid'`, [ELLA])
  console.log(`total pagado según el sistema: ₡${total[0].total} — y transfirió ₡5.000`)
  console.log('el que queda es el bueno:', BUENO)
  await c.end()
})().catch(e=>{console.error('✗', e.message);process.exit(1)})
