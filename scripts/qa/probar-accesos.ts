/**
 * QA-2 · ¿Cada rol ve lo suyo y NADA MÁS? Contra STAGING.
 *
 *   npx tsx scripts/qa/probar-accesos.ts
 *
 * Usa UNA cuenta de prueba sin roles (qa.roles@prueba.theosplace.invalid,
 * creada con scripts/staging/crear-usuario.mjs). Para cada rol de la matriz:
 * le deja SOLO ese rol, inicia sesión, abre pantallas por URL directa y llama
 * endpoints con fetch desde la página, y compara contra lo esperado. Al final
 * le saca todos los roles: la cuenta queda como estaba.
 *
 * Qué cuenta como «denegado»:
 *  · pantalla: termina en otra URL (el guard redirige) o muestra «Acceso
 *    restringido».
 *  · endpoint: responde 401 o 403.
 * Un `puede` que da denegado o un `no puede` que entra son hallazgos.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const REF = process.env.SUPABASE_STAGING_REF!
if (!SB || !REF || !SB.includes(REF)) { console.error('✗ No es staging. Abortado.'); process.exit(1) }
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
const EMAIL = 'qa.roles@prueba.theosplace.invalid'
const PASS = process.env.SEED_TEST_PASSWORD!

type Chequeo = { tipo: 'pagina' | 'api'; ruta: string; espera: 'entra' | 'denegado' }
const p = (ruta: string, espera: Chequeo['espera']): Chequeo => ({ tipo: 'pagina', ruta, espera })
const a = (ruta: string, espera: Chequeo['espera']): Chequeo => ({ tipo: 'api', ruta, espera })

/** La matriz. Sale de AGENTS.md, roles.ts y las decisiones documentadas. */
const MATRIZ: Record<string, Chequeo[]> = {
  '(sin rol)': [
    p('/mi-perfil', 'entra'), p('/matricula', 'entra'), p('/mis-pagos', 'entra'),
    p('/miembros', 'denegado'), p('/finanzas', 'denegado'), p('/finanzas/reportes', 'denegado'),
    p('/soporte', 'denegado'), p('/empleados/viajes', 'denegado'), p('/finanzas/adelantos', 'denegado'),
    a('/api/finance/payments', 'denegado'), a('/api/members?pageSize=5', 'denegado'),
    a('/api/finance/donations?page=1&pageSize=1', 'denegado'), a('/api/support-tickets', 'denegado'),
    a('/api/finance/credits', 'denegado'), a('/api/travel-requests', 'denegado'),
  ],
  encargado_eventos: [
    p('/eventos/checkin', 'entra'), p('/eventos', 'entra'),
    p('/finanzas/reportes', 'denegado'), p('/estudios/dirigentes', 'denegado'), p('/miembros', 'denegado'),
    a('/api/finance/donations?page=1&pageSize=1', 'denegado'), a('/api/finance/payments', 'denegado'),
    a('/api/support-tickets', 'denegado'),
  ],
  dirigente: [
    p('/estudios/grupos', 'entra'),
    p('/finanzas/pagos', 'denegado'), p('/finanzas', 'denegado'), p('/miembros', 'denegado'),
    a('/api/finance/payments', 'denegado'), a('/api/finance/donations?page=1&pageSize=1', 'denegado'),
  ],
  revision_pagos: [
    p('/finanzas/pagos', 'entra'),
    p('/finanzas/reportes', 'denegado'), p('/empleados/viajes', 'denegado'), p('/finanzas/saldos', 'denegado'),
    a('/api/finance/donaciones/reporte', 'denegado'), a('/api/finance/credits', 'denegado'),
  ],
  becas: [
    p('/finanzas/becas', 'entra'),
    p('/finanzas/pagos', 'denegado'), p('/finanzas/reportes', 'denegado'),
    a('/api/finance/payments', 'denegado'),
  ],
  soporte_tecnico: [
    p('/soporte', 'entra'), p('/miembros', 'entra'),
    p('/finanzas', 'denegado'), p('/reportes', 'denegado'), p('/estudios/grupos', 'denegado'),
    p('/finanzas/reportes', 'denegado'),
    a('/api/support-tickets', 'entra'), a('/api/finance/payments', 'denegado'),
    a('/api/finance/donations?page=1&pageSize=1', 'denegado'),
  ],
  colaborador_finanzas: [
    p('/finanzas/adelantos', 'entra'),
    p('/finanzas/pagos', 'denegado'), p('/finanzas/reportes', 'denegado'), p('/finanzas/saldos', 'denegado'),
    a('/api/finance/payments', 'denegado'), a('/api/finance/donations?page=1&pageSize=1', 'denegado'),
  ],
  comunicaciones: [
    p('/comunicaciones', 'entra'),
    p('/finanzas', 'denegado'), p('/finanzas/reportes', 'denegado'),
    a('/api/finance/payments', 'denegado'),
  ],
  editor_perfiles: [
    p('/miembros', 'entra'),
    p('/finanzas', 'denegado'), p('/soporte', 'denegado'),
    a('/api/finance/payments', 'denegado'), a('/api/support-tickets', 'denegado'),
  ],
  coordinador_estudios: [
    p('/estudios', 'entra'), p('/estudios/solicitudes', 'entra'),
    p('/finanzas/reportes', 'denegado'), p('/finanzas/saldos', 'denegado'),
    a('/api/finance/donations?page=1&pageSize=1', 'denegado'), a('/api/finance/credits', 'denegado'),
  ],
  finanzas: [
    p('/finanzas', 'entra'), p('/finanzas/reportes', 'entra'), p('/finanzas/saldos', 'entra'),
    p('/soporte', 'denegado'),
    a('/api/finance/payments', 'entra'), a('/api/finance/credits', 'entra'),
    a('/api/support-tickets', 'denegado'),
  ],
  direccion: [
    p('/finanzas/reportes', 'entra'), p('/estudios/dirigentes', 'entra'),
    a('/api/finance/donaciones/reporte', 'entra'),
    p('/soporte', 'denegado'), a('/api/support-tickets', 'denegado'),
  ],
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
async function memberId(): Promise<string> {
  const r = await fetch(`${SB}/rest/v1/members?select=id&email=eq.${encodeURIComponent(EMAIL)}`, { headers: H })
  const d = await r.json() as Array<{ id: string }>
  if (!d[0]) throw new Error(`No existe ${EMAIL}: correr scripts/staging/crear-usuario.mjs`)
  return d[0].id
}
async function dejarSolo(mid: string, rol: string | null) {
  await fetch(`${SB}/rest/v1/member_roles?member_id=eq.${mid}`, { method: 'DELETE', headers: H })
  if (rol) {
    const r = await fetch(`${SB}/rest/v1/member_roles`, {
      method: 'POST', headers: H, body: JSON.stringify({ member_id: mid, role: rol, is_active: true }),
    })
    if (!r.ok) throw new Error(`No se pudo dar ${rol}: ${await r.text()}`)
  }
}

type Resultado = Chequeo & { rol: string; obtuvo: 'entra' | 'denegado' | 'error'; detalle: string }

async function main() {
  const mid = await memberId()
  const browser = await chromium.launch()
  const resultados: Resultado[] = []
  try {
    for (const [rol, chequeos] of Object.entries(MATRIZ)) {
      await dejarSolo(mid, rol === '(sin rol)' ? null : rol)
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      const page = await ctx.newPage()
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await page.fill('input[placeholder*="ejemplo@correo"]', EMAIL)
      await page.fill('input[type="password"]', PASS)
      await page.getByRole('button', { name: 'Iniciar sesión' }).click()
      await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
      const me = await page.evaluate(() => fetch('/api/auth/me').then(r => r.json()))
      console.log(`▶ ${rol} · sesión con roles [${(me?.user?.roles ?? []).join(', ')}]`)
      for (const c of chequeos) {
        let obtuvo: Resultado['obtuvo'] = 'error'; let detalle = ''
        try {
          if (c.tipo === 'api') {
            const st = await page.evaluate(u => fetch(u).then(r => r.status), c.ruta)
            obtuvo = st === 401 || st === 403 ? 'denegado' : st < 400 ? 'entra' : 'error'
            detalle = `HTTP ${st}`
          } else {
            await page.goto(BASE + c.ruta, { waitUntil: 'networkidle', timeout: 45_000 })
            await page.waitForTimeout(1200)
            const final = new URL(page.url()).pathname
            const texto = await page.locator('main').innerText().catch(() => '')
            const restringido = /Acceso restringido/.test(texto)
            obtuvo = final !== c.ruta.split('?')[0] || restringido ? 'denegado' : 'entra'
            detalle = restringido ? 'Acceso restringido' : final !== c.ruta ? `→ ${final}` : 'ok'
          }
        } catch (e) { detalle = e instanceof Error ? e.message.slice(0, 80) : String(e) }
        const bien = obtuvo === c.espera
        console.log(`  ${bien ? '✓' : '✗'} ${c.tipo} ${c.ruta} · espera ${c.espera}, obtuvo ${obtuvo} (${detalle})`)
        resultados.push({ ...c, rol, obtuvo, detalle })
      }
      await ctx.close()
    }
  } finally {
    await dejarSolo(mid, null)   // la cuenta queda sin roles, como se encontró
    await browser.close()
  }
  mkdirSync('docs/qa-2026-10', { recursive: true })
  writeFileSync('docs/qa-2026-10/accesos.json', JSON.stringify(resultados, null, 2))
  const malos = resultados.filter(r => r.obtuvo !== r.espera)
  console.log(`\n${resultados.length} chequeos · ${malos.length} fuera de lo esperado`)
  for (const m of malos) console.log(`  ✗ [${m.rol}] ${m.tipo} ${m.ruta}: espera ${m.espera}, obtuvo ${m.obtuvo} (${m.detalle})`)
}

main().catch(e => { console.error(e); process.exit(1) })
