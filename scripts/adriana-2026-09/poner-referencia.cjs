/** La referencia SINPE del comprobante vivía en el registro duplicado. Se pasa
 *  al que sobrevive, que es el mismo dinero. */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
;(async()=>{
  await c.connect()
  const r = await c.query(`update payments set reference_code=$1, updated_at=now()
    where id=$2 and reference_code is null`, ['2026083110284000493809137', '7bf0f757-a357-4f3f-a581-d9fe532f1902'])
  console.log(r.rowCount === 1 ? '✓ referencia guardada' : `sin cambios (${r.rowCount} filas)`)
  console.table((await c.query(`
    select to_char(payment_date,'YYYY-MM-DD') fecha, status, amount, reference_code, receipt_path is not null comprobante
    from payments where member_id='a729c17a-d79c-4936-8a93-599e3926af27'`)).rows)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
