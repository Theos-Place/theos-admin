// INF-1 · Crea (o repara) una cuenta en STAGING: ficha en `members`, usuario de
// Supabase Auth con la contraseña de prueba, y los roles que se le pasen.
//
// Existe porque el seed de staging trae una cuenta por ROL genérico
// (direccion@, estudios@…) y a veces hace falta la cuenta REAL de alguien para
// probar con lo que esa persona ve de verdad.
//
// Idempotente: si la ficha o el usuario ya existen, los reusa y solo
// sincroniza la contraseña y los roles.
//
// Uso:
//   node scripts/staging/crear-usuario.mjs ti@theosplace.org "TI" "Theos" admin
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const [email, nombre, apellido, ...roles] = process.argv.slice(2)
if (!email) { console.error('Uso: node scripts/staging/crear-usuario.mjs <email> <nombre> <apellido> [roles...]'); process.exit(1) }

const env = Object.fromEntries(
  readFileSync('.env.staging.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'
if (env.NEXT_PUBLIC_SUPABASE_URL.includes(REF_PRODUCCION)) {
  console.error('✗ Esto apunta a PRODUCCIÓN. Abortado.'); process.exit(1)
}
const clave = env.SEED_TEST_PASSWORD
if (!clave) { console.error('✗ Falta SEED_TEST_PASSWORD en .env.staging.local'); process.exit(1) }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}`)

// 1) Ficha
let { data: miembro } = await db.from('members').select('id').eq('email', email).maybeSingle()
if (!miembro) {
  const { data, error } = await db.from('members').insert({
    first_name: nombre ?? 'Usuario', last_name: apellido ?? 'de Prueba',
    email, is_active: true,
  }).select('id').single()
  if (error) throw error
  miembro = data
  console.log(`✓ ficha creada: ${miembro.id}`)
} else {
  console.log(`· ficha existente: ${miembro.id}`)
}

// 2) Usuario de Auth. `createUser` falla si ya existe, así que se busca antes.
const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
let usuario = (lista?.users ?? []).find(u => u.email?.toLowerCase() === email.toLowerCase())
if (!usuario) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: clave, email_confirm: true,
    user_metadata: { member_id: miembro.id },
  })
  if (error) throw error
  usuario = data.user
  console.log(`✓ usuario creado: ${usuario.id}`)
} else {
  const { error } = await db.auth.admin.updateUserById(usuario.id, {
    password: clave, email_confirm: true, user_metadata: { member_id: miembro.id },
  })
  if (error) throw error
  console.log(`· usuario existente, contraseña sincronizada: ${usuario.id}`)
}

// 3) Vínculo ficha ↔ usuario. La columna es `auth_user_id`, no `user_id`:
// sin esto la sesión entra pero queda SIN FICHA y media app se apaga.
await db.from('members').update({ auth_user_id: usuario.id }).eq('id', miembro.id)

// 4) Roles
for (const role of roles) {
  const { error } = await db.from('member_roles')
    .upsert({ member_id: miembro.id, role, origen: 'manual' }, { onConflict: 'member_id,role' })
  if (error) console.warn(`  ⚠️ rol ${role}: ${error.message}`)
  else console.log(`✓ rol ${role}`)
}

console.log(`\nEntrá con ${email} / ${clave}`)
