/**
 * AUTH-1: crea cuentas de Supabase Auth para TODOS los miembros del padrón
 * que aún no tienen (activos, con correo válido), con contraseña ALEATORIA
 * fuerte que nadie conoce (no se guarda en ningún lado). Cada persona la
 * reclama después con el flujo de recuperación ("Creá tu contraseña" en el
 * login) — sin invitaciones que expiran.
 *
 *   npx tsx scripts/create-member-accounts.ts            → DRY-RUN (solo reporte)
 *   npx tsx scripts/create-member-accounts.ts --apply    → corrida real
 *
 * Reglas (docs/plan-desarrollo.md AUTH-1):
 *  · Excluidos: ya con cuenta, sin correo/correo inválido, inactivos,
 *    is_system, email_bounced, email_complained, y MENORES DE 12 años
 *    (decisión TI 2026-07-28; sin fecha de nacimiento se incluye).
 *  · Limpieza: si una corrida previa creó cuentas de menores de 12 (pasó con
 *    16 antes de agregar la regla), se BORRAN de Auth y se desenlazan — solo
 *    cuentas nunca activadas (account_confirmed_at IS NULL).
 *    GOTCHA: auth.admin.deleteUser devolvió 500 ({}) consistentemente en este
 *    proyecto; la limpieza de los 16 se hizo con DELETE SQL directo sobre
 *    auth.users (guard: email_confirmed_at IS NULL y last_sign_in_at IS NULL).
 *  · Correos duplicados entre miembros: NO se crean (un correo = una cuenta
 *    en Auth). Decisión TI 2026-07-28: se IGNORAN — es normal que un familiar
 *    registre a toda la familia bajo su correo; el titular ve los perfiles de
 *    su familia con su propia cuenta. Lógica pura en account-creation-rules.ts.
 *  · Cuenta creada con email_confirm:false → account_confirmed_at (espejo por
 *    trigger de email_confirmed_at) queda NULL hasta que la persona reclame la
 *    contraseña con el link de recuperación (verificado: resetPasswordForEmail
 *    funciona con usuarios sin confirmar y el verify confirma el correo).
 *  · Idempotente: re-correr no duplica (los enlazados quedan excluidos) y si
 *    el correo ya existe en Auth sin enlazar (corrida parcial), ENLAZA en vez
 *    de crear.
 */
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { classifyForAccountCreation, normalizeEmailForAccount, isUnder12, type MemberForAccount } from '../src/lib/auth/account-creation-rules'

const APPLY = process.argv.includes('--apply')

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
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ── 1. Padrón completo (paginado: PostgREST corta en ~1000) ─────────────────
async function loadMembers(): Promise<MemberForAccount[]> {
  const all: MemberForAccount[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from('members')
      .select('id, first_name, last_name, email, auth_user_id, is_active, is_system, email_bounced, email_complained, birth_date, account_confirmed_at')
      .order('id')
      .range(from, from + page - 1)
    if (error) throw error
    all.push(...(data as MemberForAccount[]))
    if (!data || data.length < page) break
  }
  return all
}

// ── 2. Usuarios ya existentes en Auth (email → id), para corridas parciales ─
async function loadAuthEmails(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) break
  }
  return map
}

async function main() {
const members = await loadMembers()
const authByEmail = await loadAuthEmails()
const { eligible, excluded, duplicates } = classifyForAccountCreation(members)

// Limpieza: menores de 12 con cuenta creada por una corrida previa y NUNCA
// activada → borrar de Auth y desenlazar (quedan excluidos de ahora en más).
const now = new Date()
const minorsWithAccount = members.filter(m =>
  m.auth_user_id && isUnder12(m.birth_date, now)
  && (m as MemberForAccount & { account_confirmed_at?: string | null }).account_confirmed_at == null)
console.log(`Menores de 12 con cuenta sin activar (a limpiar): ${minorsWithAccount.length}`)

const byCause = new Map<string, number>()
for (const e of excluded) byCause.set(e.cause, (byCause.get(e.cause) ?? 0) + 1)

console.log(APPLY ? '=== CORRIDA REAL ===' : '=== DRY-RUN (nada se escribió) ===')
console.log(`Padrón: ${members.length} miembros · usuarios en Auth: ${authByEmail.size}`)
console.log(`Elegibles para cuenta nueva: ${eligible.length}`)
console.log('Excluidos por causa:', Object.fromEntries([...byCause.entries()].sort()))
console.log(`\nCorreos duplicados entre miembros (${duplicates.length}) — se ignoran (familias bajo un correo), no se crean:`)
for (const d of duplicates) {
  console.log(` ! ${d.email}: ${d.members.map(m => `${m.first_name} ${m.last_name} (${m.id}${m.auth_user_id ? ', ya con cuenta' : ''})`).join(' · ')}`)
}

// Elegibles cuyo correo YA existe en Auth (corrida parcial previa): enlazar.
const toLink = eligible.filter(m => authByEmail.has(normalizeEmailForAccount(m.email)!))
const toCreate = eligible.filter(m => !authByEmail.has(normalizeEmailForAccount(m.email)!))
console.log(`\nA crear en Auth: ${toCreate.length} · a solo ENLAZAR (ya existían en Auth): ${toLink.length}`)

if (!APPLY) {
  console.log('\nDry-run: corré con --apply para ejecutar.')
  return
}

let cleaned = 0
for (const m of minorsWithAccount) {
  const { error: delErr } = await db.auth.admin.deleteUser(m.auth_user_id!)
  if (delErr && !/not found/i.test(delErr.message)) {
    console.log(` ✗ limpieza ${m.id}: ${delErr.message}`)
    continue
  }
  const { error: unlinkErr } = await db.from('members').update({ auth_user_id: null }).eq('id', m.id)
  if (unlinkErr) { console.log(` ✗ desenlace ${m.id}: ${unlinkErr.message}`); continue }
  cleaned++
}
if (minorsWithAccount.length) console.log(`Cuentas de menores limpiadas: ${cleaned}/${minorsWithAccount.length}`)

let created = 0, linked = 0, failed = 0
const failures: string[] = []

for (const m of toLink) {
  const authId = authByEmail.get(normalizeEmailForAccount(m.email)!)!
  const { error } = await db.from('members').update({ auth_user_id: authId }).eq('id', m.id).is('auth_user_id', null)
  if (error) { failed++; failures.push(`${m.email}: link → ${error.message}`) } else linked++
}

// Pool acotado: ~18k llamadas al admin API; secuencial tomaría >1h.
const CONCURRENCY = 6
let done = 0
async function createOne(m: MemberForAccount) {
  const email = normalizeEmailForAccount(m.email)!
  // Contraseña aleatoria fuerte que NADIE conoce: no se guarda ni se loguea.
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: crypto.randomBytes(32).toString('base64url'),
    email_confirm: false,
  })
  if (error || !data.user) {
    failed++
    failures.push(`${email}: create → ${error?.message ?? 'sin usuario'}`)
    return
  }
  const { error: linkErr } = await db.from('members').update({ auth_user_id: data.user.id }).eq('id', m.id).is('auth_user_id', null)
  if (linkErr) { failed++; failures.push(`${email}: link post-create → ${linkErr.message}`); return }
  created++
}
const queue = [...toCreate]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let m = queue.shift(); m; m = queue.shift()) {
    await createOne(m)
    done++
    if (done % 500 === 0) console.log(`  … ${done}/${toCreate.length}`)
  }
}))

console.log(`\nResultado: ${created} cuentas creadas · ${linked} enlazadas · ${failed} fallos`)
for (const f of failures.slice(0, 40)) console.log(' ✗', f)
if (failures.length > 40) console.log(` … y ${failures.length - 40} más`)
}

main().catch(e => { console.error(e); process.exit(1) })
