import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { patronDeCorreo } from '../../src/lib/email/correo-exacto'
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
for (const correo of ['paoc_27@hotmail.com','mari_fer_c@hotmail.com']) {
  const antes = await sb.from('members').select('first_name,last_name,email').ilike('email', correo.toLowerCase())
  const ahora = await sb.from('members').select('first_name,last_name,email').ilike('email', patronDeCorreo(correo))
  console.log(`\n${correo}`)
  console.log('  ANTES:', (antes.data??[]).map(m=>`${m.first_name} ${m.last_name} <${m.email}>`).join(' | '), antes.error?.message??'')
  console.log('  AHORA:', (ahora.data??[]).map(m=>`${m.first_name} ${m.last_name} <${m.email}>`).join(' | '), ahora.error?.message??'')
}
