/**
 * Cuánto mide el encabezado del correo, medido de verdad en un navegador.
 *
 * Se mide DOS veces: con el <style> del correo, y SIN él. La segunda es la que
 * importa: Outlook de escritorio ignora el CSS por clase en las imágenes, así
 * que si el logo solo se sostiene por la hoja de estilos, ahí se ve el tamaño
 * real del archivo.
 */
import { chromium } from 'playwright'
import { renderEmail } from '../../src/lib/email/baseLayout'

async function main() {
  const html = renderEmail('<p class="greeting">Hola Denise</p><p>Se generó una solicitud de folletos.</p>')
  const b = await chromium.launch()

  for (const [caso, doc] of [
    ['con estilos (Gmail, Apple Mail)', html],
    ['SIN la hoja de estilos (lo que hace Outlook)', html.replace(/<style>[\s\S]*?<\/style>/, '')],
  ] as const) {
    const page = await b.newPage({ viewport: { width: 800, height: 900 } })
    await page.setContent(doc)
    await page.waitForLoadState('networkidle')
    const m = await page.evaluate(() => {
      const img = document.querySelector('img')!
      return { ancho: Math.round(img.getBoundingClientRect().width), alto: Math.round(img.getBoundingClientRect().height) }
    })
    console.log(`${caso}: logo ${m.ancho} × ${m.alto} px`)
    await page.screenshot({ path: `scripts/correo-2026-09/out-${caso.startsWith('con') ? 'con-estilos' : 'sin-estilos'}.png` })
    await page.close()
  }
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
