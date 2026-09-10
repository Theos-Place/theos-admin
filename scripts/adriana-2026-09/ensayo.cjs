// Ensayo del arreglo de Adriana. Aplica TODO y hace ROLLBACK.
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const ELLA='a729c17a-d79c-4936-8a93-599e3926af27'
const QUEDA='7c511a4a-1300-4132-b882-c2a55f1e3d95'   // Douglas Montero
const SEVA ='66bacce6-8fd7-46d8-be8b-2a75efc15d5e'   // Josue Sanchez
const PAGO_BUENO='7bf0f757-a357-4f3f-a581-d9fe532f1902' // 31 ago, el del comprobante
const PAGO_PENDIENTE='f20a09f3-e1b3-4771-931d-7b30a2ad7207'
const PAGO_DUPLICADO='bf8f3a4a-1f1f-4913-bacc-ee3f696d1101' // misma referencia SINPE
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const foto = async (t) => (await c.query(`
  select e.id, g.name grupo, e.status, e.dropped_at is not null soltada, e.drop_reason
  from study_enrollments e left join study_groups g on g.id=e.group_id
  where e.member_id=$1 and e.group_id in ('f9fb64b1-e42f-4a3f-950e-1200480ac5c7','6f287f18-8f58-49fa-b035-639b1b1a5252')`, [ELLA])).rows
const pagos = async () => (await c.query(`
  select id, to_char(payment_date,'YYYY-MM-DD') fecha, status, review_status, amount, reference_code, enrollment_id
  from payments where member_id=$1 order by created_at`, [ELLA])).rows
;(async()=>{
  await c.connect()
  console.log('══ ANTES · inscripciones en los dos SCJ'); console.table(await foto())
  console.log('══ ANTES · pagos'); console.table(await pagos())
  console.log('cupo del grupo de Douglas:')
  console.table((await c.query(`select max_students cupo,
      (select count(*) from study_enrollments where group_id=g.id and status='enrolled')::int inscritos
    from study_groups g where id='f9fb64b1-e42f-4a3f-950e-1200480ac5c7'`)).rows)

  await c.query('BEGIN')
  try {
    // 1. La que se queda: matriculada de verdad, sin la baja.
    await c.query(`update study_enrollments
      set status='enrolled', dropped_at=null, drop_reason=null, updated_at=now() where id=$1`, [QUEDA])
    // 2. El pago pendiente fantasma: se va.
    await c.query(`delete from payments where id=$1`, [PAGO_PENDIENTE])
    // 3. La matrícula del otro grupo: se va.
    await c.query(`delete from study_enrollments where id=$1`, [SEVA])
    console.log('\n══ DESPUÉS · inscripciones'); console.table(await foto())
    console.log('══ DESPUÉS · pagos'); console.table(await pagos())
    console.log('\nel pago duplicado quedaría así (sigue contando ₡5.000):')
    console.table((await c.query(`select id, status, review_status, amount, reference_code, enrollment_id, study_group_id from payments where id=$1`, [PAGO_DUPLICADO])).rows)
    console.log('el pago bueno, intacto:')
    console.table((await c.query(`select id, status, review_status, amount, receipt_path is not null tiene_comprobante, enrollment_id from payments where id=$1`, [PAGO_BUENO])).rows)
  } finally { await c.query('ROLLBACK'); await c.end() }
})().catch(e=>{console.error(e.message);process.exit(1)})
