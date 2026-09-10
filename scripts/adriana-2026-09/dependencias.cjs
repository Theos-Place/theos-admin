const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  for (const tabla of ['study_enrollments','payments']) {
    console.log(`\n— qué apunta a ${tabla} y qué pasa al borrar una fila`)
    console.table((await c.query(`
      select tc.table_name tabla, kcu.column_name columna, rc.delete_rule "al borrar"
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
      join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name
      where tc.constraint_type='FOREIGN KEY' and ccu.table_name=$1 order by 1`, [tabla])).rows)
  }
  console.log('\n— estados que acepta payments.status y review_status')
  console.table((await c.query(`
    select conname, pg_get_constraintdef(oid) def from pg_constraint
    where conrelid='payments'::regclass and contype='c'`)).rows)
  console.log('\n— estados que acepta study_enrollments.status')
  console.table((await c.query(`
    select conname, pg_get_constraintdef(oid) def from pg_constraint
    where conrelid='study_enrollments'::regclass and contype='c'`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
