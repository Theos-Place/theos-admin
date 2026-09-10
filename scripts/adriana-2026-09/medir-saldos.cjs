const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  const q = `
    with pagado as (
      select e.id enrollment_id, e.member_id, e.group_id,
             coalesce(sum(p.amount) filter (where p.status='paid'), 0) pagado
      from study_enrollments e
      left join payments p on p.enrollment_id = e.id and p.concept = 'matricula'
      where e.status in ('enrolled','pendiente_de_pago','en_revision')
      group by 1,2,3
    )
    select pg.enrollment_id, m.first_name||' '||m.last_name persona, g.name grupo,
           pg.pagado, coalesce(sp.cost,0) costo, pg.pagado - coalesce(sp.cost,0) saldo,
           sp.currency
    from pagado pg
    join members m on m.id = pg.member_id
    left join study_groups g on g.id = pg.group_id
    left join study_plans sp on sp.id = g.plan_id
    where pg.pagado - coalesce(sp.cost,0) <> 0
    order by 6 desc`
  const { rows } = await c.query(q)
  console.log('matrículas con diferencia (a favor o debiendo):', rows.length)
  console.log('  a favor:', rows.filter(r=>Number(r.saldo)>0).length, '· debiendo:', rows.filter(r=>Number(r.saldo)<0).length)
  console.table(rows.slice(0, 20))
  const total = rows.reduce((n, r) => n + Number(r.saldo), 0)
  console.log('total a favor: ₡' + total.toLocaleString('es-CR'))
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
