/** El correo de contraseña, como lo ve un cliente que descarta el <style>. */
import { chromium } from 'playwright'
import { renderEmail } from '../../src/lib/email/baseLayout'

const CUERPO = `
  <p class="greeting">Hola, Carlos Andrés</p>
  <p>Pediste restablecer tu contraseña del sistema de Theos Place.</p>
  <div class="cta-wrapper"><a class="cta-button" href="https://admin.theosplace.org/auth/continuar">Cambiar mi contraseña →</a></div>
  <p>El enlace sirve <strong>una sola vez</strong> y vence, así que usalo apenas te llegue.</p>`

async function main() {
  const html = renderEmail(CUERPO)
  const b = await chromium.launch()
  for (const [caso, doc] of [
    ['con-estilos', html],
    ['sin-estilos', html.replace(/<style>[\s\S]*?<\/style>/, '')],
  ] as const) {
    const page = await b.newPage({ viewport: { width: 700, height: 620 } })
    await page.setContent(doc)
    await page.waitForLoadState('networkidle')
    const m = await page.evaluate(() => {
      const a = document.querySelector('a.cta-button') as HTMLElement
      const cs = getComputedStyle(a)
      const r = a.getBoundingClientRect()
      return { fondo: cs.backgroundColor, texto: cs.color, alto: Math.round(r.height), ancho: Math.round(r.width) }
    })
    console.log(`${caso}: fondo ${m.fondo} · texto ${m.texto} · ${m.ancho}×${m.alto}`)
    await page.screenshot({ path: `scripts/correo-2026-09/out-boton-${caso}.png` })
    await page.close()
  }
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
