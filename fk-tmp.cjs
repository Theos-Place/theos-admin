const { readFileSync } = require('fs'); const { Client } = require('pg')
for (const f of ['.env','.env.local']) { try { for (const l of readFileSync(f,'utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') } } catch {} }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)?.[1]
const cn=`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`
const GID='6e298d0b-44aa-4ae9-988f-f04c6ef19161'
;(async()=>{
  const c=new Client({connectionString:cn,ssl:{rejectUnauthorized:false}}); await c.connect()
  const { rows: fks } = await c.query(`
    select tc.table_name, kcu.column_name, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    where tc.constraint_type='FOREIGN KEY' and ccu.table_name='study_groups' and ccu.column_name='id'
    order by tc.table_name`)
  console.log('TABLAS QUE APUNTAN A study_groups:')
  for (const f of fks) {
    const { rows } = await c.query(`select count(*)::int n from ${f.table_name} where ${f.column_name} = $1`, [GID])
    console.log(`  ${f.table_name}.${f.column_name.padEnd(22)} on delete ${String(f.delete_rule).padEnd(9)} filas de este grupo: ${rows[0].n}`)
  }
  await c.end()
})().catch(e=>{console.error('ERROR:',e.message);process.exit(1)})
