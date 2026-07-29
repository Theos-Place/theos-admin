/**
 * SEC-1: matriz de acceso — recorre los endpoints principales con un usuario
 * de prueba por rol (seed-test-users) y verifica los códigos esperados, para
 * que las fugas de permisos no se vuelvan a colar.
 *
 *   BASE_URL=http://localhost:3000 npx tsx scripts/access-matrix.ts
 *
 * (BASE_URL default: http://localhost:3000 — levantá `npm run dev` antes.
 *  SEED_TEST_PASSWORD sale de .env.local. Falla con exit 1 si algo no calza.)
 */
import { readFileSync } from 'node:fs'

function loadEnv() {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
    }
  } catch { /* sin .env.local */ }
}
loadEnv()

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const PASSWORD = process.env.SEED_TEST_PASSWORD
if (!PASSWORD) { console.error('Falta SEED_TEST_PASSWORD'); process.exit(1) }

// Roles a probar (los clave de SEC-1) → su usuario seed.
const USERS: Record<string, string> = {
  miembro: 'miembro@theosplace.org',
  dirigente: 'dirigente@theosplace.org',
  lider_comite: 'lider@theosplace.org',
  coordinador_estudios: 'estudios@theosplace.org',
  admin: 'admin@theosplace.org',
}

// Endpoint → código esperado por rol. 'ok' = 2xx, 403/401 explícitos.
// NOTA: /api/studies/groups responde 200 al dirigente pero FILTRADO a sus
// grupos — el filtrado se verifica aparte (no por status code).
type Expected = Record<string, 'ok' | 403>
const MATRIX: Array<{ path: string; expected: Expected }> = [
  { path: '/api/dashboard', expected: { miembro: 403, dirigente: 403, lider_comite: 'ok', coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/dashboard/activity', expected: { miembro: 403, dirigente: 403, lider_comite: 'ok', coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/members', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/members/export', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/studies/groups', expected: { miembro: 403, dirigente: 'ok', lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/studies/leaders', expected: { miembro: 'ok', dirigente: 'ok', lider_comite: 'ok', coordinador_estudios: 'ok', admin: 'ok' } }, // saneado sin evaluaciones/is_donor para scope own
  { path: '/api/studies/analysis?study_code=N1', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/studies/prematrimonial', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/studies/requests?count=open', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
  { path: '/api/servers/committees', expected: { miembro: 403, dirigente: 403, lider_comite: 'ok', coordinador_estudios: 403, admin: 'ok' } }, // lider: 200 pero SOLO sus comités
  { path: '/api/servers/applications', expected: { miembro: 403, dirigente: 403, lider_comite: 'ok', coordinador_estudios: 403, admin: 'ok' } },
  { path: '/api/servers/position-requests', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 403, admin: 'ok' } },
  { path: '/api/finance/payments?page=1&pageSize=1', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } }, // REV-3: revision_pagos
  { path: '/api/payments/queue', expected: { miembro: 403, dirigente: 403, lider_comite: 403, coordinador_estudios: 'ok', admin: 'ok' } },
]

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${email} → ${res.status}`)
  const cookies = res.headers.getSetCookie?.() ?? []
  if (!cookies.length) throw new Error(`login ${email}: sin cookies`)
  return cookies.map(c => c.split(';')[0]).join('; ')
}

async function main() {
  let failures = 0
  const sessions: Record<string, string> = {}
  for (const [role, email] of Object.entries(USERS)) {
    sessions[role] = await login(email)
    console.log(`✓ login ${role}`)
  }

  for (const { path, expected } of MATRIX) {
    const row: string[] = []
    for (const [role, want] of Object.entries(expected)) {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie: sessions[role] } })
      const got = res.status
      const pass = want === 'ok' ? got >= 200 && got < 300 : got === want
      if (!pass) failures++
      row.push(`${role}:${got}${pass ? '' : ` ✗(esperaba ${want})`}`)
    }
    console.log(`${path}\n   ${row.join(' · ')}`)
  }

  // Verificaciones de CONTENIDO (no solo status):
  // 1) dirigente en /api/studies/groups: solo grupos donde es leader/co-leader.
  {
    const res = await fetch(`${BASE}/api/studies/groups`, { headers: { cookie: sessions.dirigente } })
    const data = await res.json()
    const groups: Array<{ leader_id?: string | null; co_leader_id?: string | null }> = Array.isArray(data) ? data : data.groups ?? []
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: sessions.dirigente } }).then(r => r.json())
    const myId = me?.user?.member_id ?? me?.member_id
    const foreign = groups.filter(g => g.leader_id !== myId && g.co_leader_id !== myId)
    const pass = foreign.length === 0
    if (!pass) failures++
    console.log(`/api/studies/groups (dirigente, contenido): ${groups.length} grupos, ${foreign.length} ajenos ${pass ? '✓' : '✗'}`)
  }
  // 2) dashboard de coordinador_estudios: sin bloque finance.
  {
    const res = await fetch(`${BASE}/api/dashboard`, { headers: { cookie: sessions.coordinador_estudios } })
    const data = await res.json()
    const pass = res.ok && data.finance === undefined && data.studies !== undefined
    if (!pass) failures++
    console.log(`/api/dashboard (coordinador, payload recortado): finance=${String(data.finance !== undefined)} studies=${String(data.studies !== undefined)} ${pass ? '✓' : '✗'}`)
  }

  console.log(failures === 0 ? '\nMATRIZ OK — sin fugas.' : `\n${failures} FALLOS en la matriz.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
