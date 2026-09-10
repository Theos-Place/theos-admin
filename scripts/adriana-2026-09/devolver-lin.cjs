/** Lin Ta Hsiang volvió a SCJ — Este SJ: lo sacaron por error (2026-09-10). */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const E='c0f55753-e6ec-4bce-adc3-87343b918c59'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const estado = async () => (await c.query(`
  select m.first_name||' '||m.last_name persona, g.name grupo, e.status, e.drop_reason,
    (select count(*) from study_enrollments x where x.group_id=e.group_id and x.status='enrolled')::int inscritos,
    g.max_students cupo,
    (select string_agg(p.status||' ₡'||p.amount,', ') from payments p where p.enrollment_id=e.id) pago
  from study_enrollments e join members m on m.id=e.member_id join study_groups g on g.id=e.group_id
  where e.id=$1`, [E])).rows
;(async()=>{
  await c.connect()
  console.log('ANTES'); console.table(await estado())
  const r = await c.query(`update study_enrollments
    set status='enrolled', dropped_at=null, drop_reason=null, updated_at=now()
    where id=$1 and status='cancelada'`, [E])
  if (r.rowCount !== 1) throw new Error(`esperaba 1 fila, cambié ${r.rowCount} — revisá antes de seguir`)
  console.log('DESPUÉS'); console.table(await estado())
  await c.end()
})().catch(e=>{console.error('✗', e.message);process.exit(1)})
