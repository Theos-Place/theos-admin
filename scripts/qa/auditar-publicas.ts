/**
 * QA-1 · Accesibilidad y móvil sobre las páginas PÚBLICAS.
 *
 *   npx tsx scripts/qa/auditar-publicas.ts
 *
 * Solo las públicas, y es una decisión, no un olvido: las autenticadas
 * necesitarían volver a sembrar cuentas `[prueba]` en producción, y el set se
 * borró entero el 2026-09-22. Se retoman cuando exista staging (INF-1).
 *
 * Corre axe-core en dos anchos: escritorio (1280) y móvil (360), que es donde
 * aparecen el desbordamiento horizontal y los blancos de toque chicos.
 */
import { chromium, devices } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000'
const RUTAS = [
  '/login', '/registro', '/recuperar', '/terminos',
  '/calendario', '/vacantes', '/ayuda',
  '/ayuda/me-asignaron-una-beca', '/ayuda/como-me-matriculo',
]
const SALIDA = 'docs/qa-2026-09'

type Hallazgo = {
  ruta: string; ancho: string; id: string; impacto: string
  descripcion: string; nodos: number; ejemplo: string
}

async function main() {
  mkdirSync(`${SALIDA}/capturas`, { recursive: true })
  const browser = await chromium.launch()
  const hallazgos: Hallazgo[] = []
  const desbordes: string[] = []

  for (const [ancho, opciones] of [
    ['desktop', { viewport: { width: 1280, height: 900 } }],
    ['mobile', devices['iPhone 13']],
  ] as const) {
    const ctx = await browser.newContext(opciones)
    const page = await ctx.newPage()
    for (const ruta of RUTAS) {
      try {
        await page.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 30_000 })
      } catch {
        console.log(`  ✗ ${ancho} ${ruta}: no cargó`)
        continue
      }
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      for (const v of r.violations) {
        hallazgos.push({
          ruta, ancho, id: v.id, impacto: v.impact ?? 'n/a',
          descripcion: v.help, nodos: v.nodes.length,
          ejemplo: (v.nodes[0]?.html ?? '').replace(/\s+/g, ' ').slice(0, 120),
        })
      }
      if (ancho === 'mobile') {
        // Desbordamiento horizontal: el síntoma que se ve como "la pantalla se
        // corre" en el celular.
        const sobra = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (sobra > 2) desbordes.push(`${ruta}: ${sobra}px de más`)
        await page.screenshot({
          path: `${SALIDA}/capturas/mobile${ruta.replace(/\//g, '_') || '_home'}.png`,
          fullPage: true,
        })
      }
      console.log(`  ✓ ${ancho} ${ruta}`)
    }
    await ctx.close()
  }
  await browser.close()

  writeFileSync(`${SALIDA}/axe-publicas.json`, JSON.stringify({ hallazgos, desbordes }, null, 2))
  console.log(`\nviolaciones: ${hallazgos.length} · desbordes en móvil: ${desbordes.length}`)
  if (desbordes.length) console.log(desbordes.join('\n'))
}

main().catch(e => { console.error(e); process.exit(1) })
