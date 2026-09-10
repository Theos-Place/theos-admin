/**
 * Adriana Jiménez Sanabria (2026-09-10): dejarla matriculada en el SCJ de
 * Douglas Montero —el primero que matriculó, el del comprobante del 31 de
 * agosto— y limpiar el enredo que le hicimos nosotros.
 *
 *   1. Inscripción al grupo de Douglas Montero → 'enrolled', sin la baja.
 *   2. Pago PENDIENTE fantasma → borrado.
 *   3. Inscripción al grupo de Josue Sánchez → borrada.
 *
 * NO se toca el pago duplicado bf8f3a4a: está en 'paid' y es plata, no un
 * enredo de matrícula. Queda para decidirlo aparte.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const ELLA='a729c17a-d79c-4936-8a93-599e3926af27'
const QUEDA='7c511a4a-1300-4132-b882-c2a55f1e3d95'
const SEVA ='66bacce6-8fd7-46d8-be8b-2a75efc15d5e'
const PAGO_PENDIENTE='f20a09f3-e1b3-4771-931d-7b30a2ad7207'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  await c.query('BEGIN')
  const r1 = await c.query(`update study_enrollments
    set status='enrolled', dropped_at=null, drop_reason=null, updated_at=now()
    where id=$1 and member_id=$2`, [QUEDA, ELLA])
  const r2 = await c.query(`delete from payments where id=$1 and member_id=$2 and status='pending'`, [PAGO_PENDIENTE, ELLA])
  const r3 = await c.query(`delete from study_enrollments where id=$1 and member_id=$2`, [SEVA, ELLA])
  if (r1.rowCount !== 1 || r2.rowCount !== 1 || r3.rowCount !== 1) {
    await c.query('ROLLBACK')
    throw new Error(`filas afectadas inesperadas: matrícula ${r1.rowCount}, pago ${r2.rowCount}, borrado ${r3.rowCount}`)
  }
  await c.query('COMMIT')
  console.log('══ cómo quedó')
  console.table((await c.query(`
    select g.name grupo, m.first_name||' '||m.last_name dirigente, e.status,
           to_char(g.starts_at,'YYYY-MM-DD') arranca, g.schedule_time hora, g.location lugar
    from study_enrollments e join study_groups g on g.id=e.group_id
    left join members m on m.id=g.leader_id
    where e.member_id=$1 and g.name ilike 'SCJ%'`, [ELLA])).rows)
  console.table((await c.query(`
    select id, to_char(payment_date,'YYYY-MM-DD') fecha, status, amount, enrollment_id is not null ligado_a_matricula
    from payments where member_id=$1 order by created_at`, [ELLA])).rows)
  await c.end()
})().catch(e=>{console.error('✗', e.message);process.exit(1)})
