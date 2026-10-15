/**
 * QA-2 · Accesibilidad y móvil sobre las pantallas AUTENTICADAS, contra STAGING.
 *
 *   QA_EMAIL=ti@theosplace.org npx tsx scripts/qa/auditar-autenticadas.ts
 *
 * Inicia sesión una vez con la cuenta indicada (contraseña SEED_TEST_PASSWORD
 * de .env.staging.local), guarda la sesión y recorre TODAS las page.tsx de
 * src/app/(admin). Las rutas dinámicas usan un id real de staging, que el
 * script busca con la service key; si la tabla está vacía en staging la ruta
 * se salta y queda listada como «sin dato», no como limpia.
 *
 * Corre axe (WCAG 2.1 A/AA) en escritorio (1280) y en móvil (375) y mide el
 * desborde horizontal en móvil. Guarda el JSON crudo en docs/qa-2026-10/axe/.
 *
 * GUARD: aborta si la URL de Supabase del .env.staging.local es la de
 * producción. Este script inicia sesión y navega todo el admin: contra prod
 * sería tocar datos reales.
 */
import { chromium, devices, type BrowserContext } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── env de staging ──────────────────────────────────────────────────────
for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const REF = process.env.SUPABASE_STAGING_REF!
if (!SB || !REF || !SB.includes(REF)) {
  console.error('✗ .env.staging.local no apunta al proyecto de staging. Abortado.')
  process.exit(1)
}

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.QA_EMAIL ?? 'ti@theosplace.org'
const PASS = process.env.SEED_TEST_PASSWORD!
const SALIDA = 'docs/qa-2026-10'
const SOLO = process.env.QA_SOLO?.split(',')   // para re-correr un subconjunto

// ── rutas: todas las page.tsx de (admin) ────────────────────────────────
function paginas(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return paginas(p)
    return e === 'page.tsx' ? [p] : []
  })
}
const RUTAS = paginas('src/app/(admin)')
  .map(p => p.replace('src/app/(admin)', '').replace('/page.tsx', '') || '/')
  .sort()

async function primerId(tabla: string, filtro = ''): Promise<string | null> {
  const col = tabla === 'study_leaders' ? 'member_id' : 'id'
  const r = await fetch(`${SB}/rest/v1/${tabla}?select=${col}&limit=1${filtro}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const d = await r.json() as Array<Record<string, string>>
  return Array.isArray(d) && d[0] ? d[0][col] : null
}

/** Qué id va en cada ruta dinámica. La clave es el prefijo de la ruta. */
async function idsPorRuta(): Promise<Record<string, string | null>> {
  return {
    '/accesos/[memberId]': await primerId('members', '&email=eq.ti@theosplace.org'),
    '/comunicaciones/[id]': await primerId('message_broadcasts'),
    '/comunicaciones/plantillas/[id]': await primerId('message_templates'),
    '/empleados/[id]': await primerId('employees'),
    '/empleados/puestos/[id]': await primerId('paid_positions'),
    '/empleados/viajes/[id]': await primerId('travel_requests'),
    '/estudios/dirigentes/[id]': await primerId('study_leaders'),
    '/estudios/folletos/[id]': await primerId('folleto_requests'),
    '/estudios/grupos/[id]': await primerId('study_groups', '&status=eq.en_curso'),
    '/estudios/plan/[id]': await primerId('study_plans'),
    '/eventos/[id]': await primerId('events', '&order=starts_at.desc'),
    '/finanzas/pagos/[id]': await primerId('payments'),
    '/formularios/[id]': await primerId('forms'),
    '/miembros/[id]': await primerId('members', '&email=eq.ti@theosplace.org'),
    '/miembros/listas/[id]': await primerId('member_lists'),
    '/servidores/[committeeId]': await primerId('areas', '&area_type=eq.committee'),
    '/servidores/aplicaciones/[id]': await primerId('applications'),
    '/servidores/puestos/[id]': await primerId('service_positions'),
  }
}

function resolver(ruta: string, ids: Record<string, string | null>): string | null {
  if (!ruta.includes('[')) return ruta
  const clave = Object.keys(ids).sort((a, b) => b.length - a.length).find(k => ruta.startsWith(k))
  if (!clave) return null
  const id = ids[clave]
  if (!id) return null
  return ruta.replace(/\[[a-zA-Z]+\]/, id)
}

type Hallazgo = {
  ruta: string; ancho: string; id: string; impacto: string
  descripcion: string; nodos: number; ejemplo: string
}

async function iniciarSesion(ctx: BrowserContext) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  const me = await page.evaluate(() => fetch('/api/auth/me').then(r => r.json()))
  await page.close()
  // La respuesta viene envuelta en { user }. Sin roles la auditoría no vale:
  // las pantallas responden AccessDenied y axe da cero sobre una pantalla vacía.
  const u = (me?.user ?? {}) as { email?: string; roles?: string[] }
  if (!u.roles?.length) throw new Error('La sesión no trae roles: revisá la cuenta en staging.')
  return u
}

async function main() {
  mkdirSync(`${SALIDA}/axe`, { recursive: true })
  mkdirSync(`${SALIDA}/capturas`, { recursive: true })
  const ids = await idsPorRuta()

  const browser = await chromium.launch()
  const hallazgos: Hallazgo[] = []
  const desbordes: Array<{ ruta: string; px: number }> = []
  const sinCargar: string[] = []
  const sinDato: string[] = []
  const redirigidas: Array<{ ruta: string; a: string }> = []

  const nombre = EMAIL.split('@')[0].replace(/[^a-z0-9]+/gi, '-')
  const ANCHOS = (process.env.QA_ANCHO ?? 'desktop,mobile').split(',')
  // Se guarda DESPUÉS DE CADA PANTALLA. La primera corrida se colgó en la
  // pantalla 116 de 260 y, como el JSON se escribía al final, se perdió todo.
  const guardar = () => writeFileSync(`${SALIDA}/axe/autenticadas-${nombre}-${ANCHOS.join('-')}${SOLO ? '-parcial' : ''}.json`,
    JSON.stringify({ cuenta: EMAIL, hallazgos, desbordes, sinCargar, sinDato, redirigidas }, null, 2))
  /** Nada de una pantalla puede tardar más que esto: si se cuelga, se anota y se sigue. */
  const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tope')), ms))])

  for (const [ancho, opciones] of ([
    ['desktop', { viewport: { width: 1280, height: 900 } }],
    ['mobile', { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } }],
  ] as const).filter(([a]) => ANCHOS.includes(a))) {
    const ctx = await browser.newContext(opciones)
    const me = await iniciarSesion(ctx)
    console.log(`▶ ${ancho} · sesión de ${me.email ?? EMAIL} · roles ${(me.roles ?? []).join(', ')}`)
    const page = await ctx.newPage()
    for (const ruta of RUTAS) {
      if (SOLO && !SOLO.some(s => ruta.startsWith(s))) continue
      const url = resolver(ruta, ids)
      if (!url) { if (ancho === 'desktop') sinDato.push(ruta); continue }
      try {
        await page.goto(BASE + url, { waitUntil: 'load', timeout: 45_000 })
        await page.waitForTimeout(2500)
      } catch {
        sinCargar.push(`${ancho} ${ruta}`)
        console.log(`  ✗ ${ancho} ${ruta}: no cargó`)
        continue
      }
      const final = new URL(page.url()).pathname
      if (final !== url && ancho === 'desktop') redirigidas.push({ ruta, a: final })
      let r: Awaited<ReturnType<AxeBuilder['analyze']>>
      try {
        r = await conTope(new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze(), 60_000)
      } catch {
        sinCargar.push(`${ancho} ${ruta} (axe no terminó)`); console.log(`  ✗ ${ancho} ${ruta}: axe no terminó`); guardar(); continue
      }
      for (const v of r.violations) {
        hallazgos.push({
          ruta, ancho, id: v.id, impacto: v.impact ?? 'n/a',
          descripcion: v.help, nodos: v.nodes.length,
          ejemplo: (v.nodes[0]?.html ?? '').replace(/\s+/g, ' ').slice(0, 160),
        })
      }
      if (ancho === 'mobile') {
        const sobra = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (sobra > 2) {
          desbordes.push({ ruta, px: sobra })
          await page.screenshot({
            path: `${SALIDA}/capturas/desborde${ruta.replace(/[/[\]]/g, '_')}.png`, fullPage: false,
          })
        }
      }
      console.log(`  ✓ ${ancho} ${ruta} · ${r.violations.length} reglas`)
      guardar()
    }
    await ctx.close()
  }
  await browser.close()

  guardar()
  console.log(`\nreglas violadas: ${hallazgos.length} · desbordes móvil: ${desbordes.length} · sin dato: ${sinDato.length} · no cargaron: ${sinCargar.length}`)
  if (sinCargar.length) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
