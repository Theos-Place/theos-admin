/**
 * Crea usuarios de prueba en Supabase Auth, uno por cada rol del sistema.
 * Para cada uno: usuario en auth.users + registro en members + member_roles + link auth_user_id.
 *
 * Uso (Node 20+ con soporte TS o tsx):
 *   SEED_TEST_PASSWORD=... npx tsx scripts/seed-test-users.ts
 * (lee también NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY de .env.local)
 *
 * La contraseña NUNCA está hardcodeada: viene de la env SEED_TEST_PASSWORD.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { RoleId } from '../src/types/auth'

// ── Cargar env desde .env.local (además de process.env) ──
function loadEnv() {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch { /* no .env.local: se usa process.env */ }
}
loadEnv()

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_TEST_PASSWORD

if (!SUPA_URL || !KEY) { console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY'); process.exit(1) }
if (!PASSWORD) { console.error('Falta SEED_TEST_PASSWORD (definila en .env.local o como env var)'); process.exit(1) }

const admin = createClient(SUPA_URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// email → { rol, nombre }. 'miembro' es el default (igual se inserta para que sea explícito).
const TEST_USERS: { email: string; role: RoleId; name: string }[] = [
  { email: 'admin@theosplace.org',          role: 'admin',                  name: 'Admin Sistema' },
  { email: 'direccion@theosplace.org',      role: 'direccion',              name: 'Usuario Dirección' },
  { email: 'finanzas@theosplace.org',       role: 'finanzas',               name: 'Usuario Finanzas' },
  { email: 'staff@theosplace.org',          role: 'encargado_staff',        name: 'Encargado de Staff' },
  { email: 'estudios@theosplace.org',       role: 'coordinador_estudios',   name: 'Coordinador de Estudios' },
  { email: 'dirigentes@theosplace.org',     role: 'coordinador_dirigentes', name: 'Coordinador de Dirigentes' },
  { email: 'comunicaciones@theosplace.org', role: 'comunicaciones',         name: 'Usuario Comunicaciones' },
  { email: 'dirigente@theosplace.org',      role: 'dirigente',              name: 'Usuario Dirigente' },
  { email: 'lider@theosplace.org',          role: 'lider_comite',           name: 'Líder de Comité' },
  { email: 'perfiles@theosplace.org',       role: 'editor_perfiles',        name: 'Editor de Perfiles' },
  { email: 'lectura@theosplace.org',        role: 'solo_lectura',           name: 'Usuario Solo Lectura' },
  { email: 'miembro@theosplace.org',        role: 'miembro',                name: 'Usuario Miembro' },
]

async function findAuthUserByEmail(email: string): Promise<string | null> {
  // listUsers pagina; con pocos usuarios de prueba alcanza la primera página.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

async function seedUser(u: { email: string; role: RoleId; name: string }) {
  // 1. Auth user (idempotente)
  let authId: string | null = null
  const created = await admin.auth.admin.createUser({
    email: u.email, password: PASSWORD!, email_confirm: true,
  })
  if (created.data?.user) {
    authId = created.data.user.id
  } else {
    authId = await findAuthUserByEmail(u.email)
    if (authId) await admin.auth.admin.updateUserById(authId, { password: PASSWORD! })
  }
  if (!authId) { console.error(`  ✗ ${u.email}: no se pudo crear/encontrar el usuario de auth`); return }

  // 2. Member (upsert por email)
  const [first, ...rest] = u.name.split(' ')
  const last = rest.join(' ') || '·'
  const { data: existing } = await admin.from('members').select('id').eq('email', u.email).maybeSingle()
  let memberId: string
  if (existing) {
    memberId = (existing as { id: string }).id
    await admin.from('members').update({ auth_user_id: authId, is_active: true }).eq('id', memberId)
  } else {
    const { data: ins, error } = await admin.from('members')
      .insert({ first_name: first, last_name: last, email: u.email, is_active: true, auth_user_id: authId })
      .select('id').single()
    if (error || !ins) { console.error(`  ✗ ${u.email}: member ${error?.message}`); return }
    memberId = (ins as { id: string }).id
  }

  // 3. member_roles (idempotente)
  const { data: role } = await admin.from('member_roles')
    .select('id').eq('member_id', memberId).eq('role', u.role).maybeSingle()
  if (role) {
    await admin.from('member_roles').update({ is_active: true }).eq('id', (role as { id: string }).id)
  } else {
    await admin.from('member_roles').insert({ member_id: memberId, role: u.role, is_active: true })
  }

  console.log(`  ✓ ${u.email.padEnd(30)} rol: ${u.role}`)
}

;(async () => {
  console.log(`Creando ${TEST_USERS.length} usuarios de prueba...`)
  for (const u of TEST_USERS) await seedUser(u)
  console.log('Listo.')
})()
