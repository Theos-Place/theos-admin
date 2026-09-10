// ¿Cuánta gente de los dos SCJ tiene el MISMO comprobante cargado dos veces?
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— personas con MÁS DE UN pago aprobado en los dos grupos de SCJ')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name persona, count(*)::int pagos,
           sum(p.amount) total, string_agg(to_char(p.payment_date,'DD/MM')||' '||p.status, ', ' order by p.payment_date) detalle
    from payments p join members m on m.id=p.member_id
    where p.study_group_id in ('f9fb64b1-e42f-4a3f-950e-1200480ac5c7','6f287f18-8f58-49fa-b035-639b1b1a5252')
      and p.status='paid'
    group by 1 having count(*) > 1`)).rows)
  console.log('\n— en TODO el sistema: misma referencia SINPE en dos pagos distintos')
  console.table((await c.query(`
    select p.reference_code, count(*)::int veces, sum(p.amount) suma,
           string_agg(distinct m.first_name||' '||m.last_name, ' / ') personas
    from payments p join members m on m.id=p.member_id
    where p.reference_code is not null and p.status='paid'
    group by 1 having count(*) > 1 order by 2 desc limit 20`)).rows)
  console.log('\n— misma persona, mismo monto, mismo día, dos pagos aprobados (sin referencia)')
  console.table((await c.query(`
    select m.first_name||' '||m.last_name persona, p.payment_date, p.amount, count(*)::int veces
    from payments p join members m on m.id=p.member_id
    where p.status='paid'
    group by 1,2,3 having count(*) > 1 order by p.payment_date desc limit 15`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
