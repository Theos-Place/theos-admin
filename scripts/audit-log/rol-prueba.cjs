const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
let email=''
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^TUTORIAL_USER_EMAIL=(.*)$/); if(m) email=m[1].trim().replace(/^["']|["']$/g,'') }
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const m = await c.query(`select id, first_name||' '||last_name n, email, is_active from members where lower(email)=lower($1)`,[email])
  console.log('cuenta de prueba: ' + JSON.stringify(m.rows[0] ?? email))
  if (m.rowCount) {
    const r = await c.query(`select role, is_active from member_roles where member_id=$1`,[m.rows[0].id])
    console.log('roles: ' + (r.rows.map(x=>`${x.role}${x.is_active?'':' (inactivo)'}`).join(', ') || 'ninguno'))
  }
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
