const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const R='932170b3-ebd2-4bf4-aa3c-9e3693c217ad', D='1e824723-6698-4845-bf72-78fe3e1fd3a9'
;(async()=>{
  await c.connect()
  for (const [nombre, id] of [['RAQUEL', R], ['DINA', D]]) {
    console.log(`\n══════ ${nombre}`)
    console.table((await c.query(`
      select p.id, to_char(p.created_at at time zone 'America/Costa_Rica','DD/MM HH24:MI') creado,
             p.status, p.review_status, p.amount, p.reference_code,
             p.receipt_path is not null comprobante, g.name grupo,
             e.status estado_matricula
      from payments p
      left join study_groups g on g.id=p.study_group_id
      left join study_enrollments e on e.id=p.enrollment_id
      where p.member_id=$1 order by p.created_at`, [id])).rows)
    console.log('  ¿el mismo archivo de comprobante en dos pagos?')
    console.table((await c.query(`
      select receipt_path, count(*)::int veces from payments
      where member_id=$1 and receipt_path is not null group by 1 having count(*)>1`, [id])).rows)
  }
  console.log('\n══════ ¿a cuántas personas MÁS les pasó? (dos pagos aprobados con la misma referencia)')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name persona, p.reference_code, count(*)::int veces, sum(p.amount) suma
    from payments p join members m on m.id=p.member_id
    where p.reference_code is not null and p.status='paid'
    group by 1,2 having count(*)>1 order by 1`)).rows)
  console.log('\n══════ pagos aprobados HUÉRFANOS (sin matrícula) creados este mes')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name persona, to_char(p.created_at at time zone 'America/Costa_Rica','DD/MM HH24:MI') creado,
           p.amount, p.reference_code, p.id
    from payments p join members m on m.id=p.member_id
    where p.enrollment_id is null and p.status='paid' and p.concept='matricula'
      and p.created_at >= '2026-09-01' order by p.created_at`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
