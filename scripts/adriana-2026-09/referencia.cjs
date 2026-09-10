const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const REFERENCIA='2026083110284000493809137'
const BUENO='7bf0f757-a357-4f3f-a581-d9fe532f1902'
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  console.log('— ¿reference_code tiene índice único? (si lo tuviera, el duplicado no habría entrado)')
  console.table((await c.query(`select indexname, indexdef from pg_indexes where tablename='payments' and indexdef ilike '%reference_code%'`)).rows)
  console.log('— ¿alguien más usa esa referencia?')
  console.table((await c.query(`select id, member_id, amount, status from payments where reference_code=$1`, [REFERENCIA])).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
