/**
 * QA-2 · Teclado y foco en las pantallas de los flujos críticos. Contra STAGING.
 *
 *   npx tsx scripts/qa/recorrer-teclado.ts
 *
 * Por pantalla: entra con la cuenta admin, presiona Tab hasta volver al
 * principio (o 120 veces) y en cada parada anota:
 *  · si el foco SE VE: compara outline / box-shadow / border del elemento
 *    enfocado contra el mismo elemento sin foco;
 *  · si tiene NOMBRE accesible (texto, aria-label, title, label asociado);
 *  · si se alcanzó la ACCIÓN PRINCIPAL del flujo (por texto).
 * Además, en las pantallas con modal, abre el modal con Enter, tabula 25
 * veces y verifica que el foco no se escapa, y que Escape lo cierra y devuelve
 * el foco al botón que lo abrió.
 */
import { chromium, type Page } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!
const REF = process.env.SUPABASE_STAGING_REF!
if (!SB || !REF || !SB.includes(REF)) { console.error('✗ No es staging. Abortado.'); process.exit(1) }
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
const EMAIL = process.env.QA_EMAIL ?? 'ti@theosplace.org'
const PASS = process.env.SEED_TEST_PASSWORD!

type Pantalla = {
  flujo: string
  ruta: string
  /** Texto de la acción principal que tiene que poder alcanzarse con Tab. */
  accion: RegExp
  /** Si se indica, el botón (por texto) que abre un modal, para probar el foco adentro. */
  abreModal?: RegExp
}

const PANTALLAS: Pantalla[] = (process.env.QA_PANTALLAS ? JSON.parse(process.env.QA_PANTALLAS) : []) as Pantalla[]

type Parada = { tag: string; nombre: string; visible: boolean; texto: string; enMain: boolean }

async function info(page: Page): Promise<Parada | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    const marcaFoco = `${cs.outlineStyle}|${cs.outlineWidth}|${cs.boxShadow}|${cs.borderColor}|${cs.backgroundColor}`
    // Mismo elemento SIN foco: se lo saca un instante y se compara el estilo.
    // EXCEPTO los inputs de fecha/hora: un focus() los devuelve al primer
    // segmento (día) y el Tab nunca sale del campo. Ahí se mira solo si hay
    // un anillo/outline puesto, que es lo que dibuja el foco en esos campos.
    const esFecha = el instanceof HTMLInputElement && /date|time|month|week/.test(el.type)
    let sinFoco: string
    if (esFecha) {
      sinFoco = (cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px') || cs.boxShadow !== 'none' ? '' : marcaFoco
    } else {
      const prev = el
      prev.blur()
      const cs2 = getComputedStyle(prev)
      sinFoco = `${cs2.outlineStyle}|${cs2.outlineWidth}|${cs2.boxShadow}|${cs2.borderColor}|${cs2.backgroundColor}`
      prev.focus({ preventScroll: true })
    }
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') ||
      (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : '') ||
      el.closest('label')?.textContent || el.innerText || (el as HTMLInputElement).placeholder || '').trim()
    return {
      tag: el.tagName.toLowerCase() + (el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''),
      nombre: label.replace(/\s+/g, ' ').slice(0, 60),
      visible: marcaFoco !== sinFoco,
      texto: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
      enMain: !!el.closest('main'),
    }
  })
}

async function main() {
  if (!PANTALLAS.length) { console.error('Pasá QA_PANTALLAS (JSON).'); process.exit(1) }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })

  const informe: unknown[] = []
  for (const pa of PANTALLAS) {
    const accion = new RegExp(pa.accion as unknown as string, 'i')
    await page.goto(BASE + pa.ruta, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(1500)
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    const paradas: Parada[] = []
    let primera = ''
    let alcanzo = false
    const TOPE = Number(process.env.QA_TOPE ?? 250)
    for (let i = 0; i < TOPE; i++) {
      await page.keyboard.press('Tab')
      const p = await info(page)
      if (!p || p.tag.startsWith('nextjs-portal')) continue
      const firma = `${p.tag}:${p.nombre}`
      if (paradas.length && `${paradas[paradas.length - 1].tag}:${paradas[paradas.length - 1].nombre}` === firma && p.tag === 'input') continue
      if (i > 3 && firma === primera) break
      if (!primera) primera = firma
      paradas.push(p)
      if (accion.test(p.nombre) || accion.test(p.texto)) alcanzo = true
    }
    const sinFoco = paradas.filter(p => !p.visible)
    const sinNombre = paradas.filter(p => !p.nombre)

    let modal: Record<string, unknown> | null = null
    if (pa.abreModal) {
      const abre = new RegExp(pa.abreModal as unknown as string, 'i')
      const boton = page.getByRole('button', { name: abre }).first()
      if (await boton.count()) {
        await boton.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(800)
        const hay = await page.locator('[role="dialog"]').count()
        let escapa = 0
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab')
          const dentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
          if (!dentro) escapa++
        }
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        const cerrado = (await page.locator('[role="dialog"]').count()) === 0
        const volvio = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim().slice(0, 40) ?? '')
        modal = { abrio: hay > 0, focoSeEscapo: escapa, escCierra: cerrado, focoVuelveA: volvio }
      } else modal = { abrio: false, motivo: 'no se encontró el botón' }
    }

    const r = {
      flujo: pa.flujo, ruta: pa.ruta, paradas: paradas.length,
      alcanzaAccion: alcanzo,
      /** Cuántos Tab hasta la primera parada dentro de <main>: el costo de no tener «saltar al contenido». */
      tabsHastaElContenido: paradas.findIndex(p => p.enMain) + 1,
      sinFocoVisible: sinFoco.map(p => `${p.tag} «${p.nombre || p.texto}»`),
      sinNombre: sinNombre.map(p => p.tag),
      secuencia: process.env.QA_SECUENCIA ? paradas.map(p => `${p.enMain ? 'M' : '-'} ${p.tag} ${p.nombre || p.texto}`) : undefined,
      modal,
    }
    informe.push(r)
    console.log(`▶ ${pa.flujo} ${pa.ruta}: ${paradas.length} paradas · ${paradas.findIndex(p => p.enMain) + 1} Tab hasta el contenido · acción ${alcanzo ? '✓' : '✗'} · sin foco visible ${sinFoco.length} · sin nombre ${sinNombre.length}${modal ? ' · modal ' + JSON.stringify(modal) : ''}`)
  }
  await browser.close()
  mkdirSync('docs/qa-2026-10', { recursive: true })
  writeFileSync('docs/qa-2026-10/teclado.json', JSON.stringify(informe, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
