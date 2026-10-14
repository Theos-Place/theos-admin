/**
 * La hoja impresa es lo ÚNICO que sale en el papel.
 *
 * QUÉ PASÓ (2026-10-14). El bloque `@media print` de SRV-14 traía un
 * comentario que decía «al imprimir se oculta TODO lo demás —el menú, el
 * encabezado del sistema, los botones»… y esa regla no existía. Nadie la
 * había escrito. O sea que todo PDF guardado desde la hoja del aplicante
 * salía con la barra lateral del sistema impresa al lado.
 *
 * Se descubrió preguntándole al navegador qué reglas de `print` había de
 * verdad, en vez de creerle al comentario. Este test existe para que el
 * comentario y el CSS no vuelvan a decir cosas distintas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/app/globals.css', 'utf8')
const bloqueDePrint = css.slice(css.indexOf('@media print'))

describe('impresión · solo la hoja llega al papel', () => {
  it('todo lo demás se esconde', () => {
    expect(bloqueDePrint).toMatch(/body \*\s*\{\s*visibility:\s*hidden/)
  })

  it('y la hoja, con todo lo de adentro, se ve', () => {
    expect(bloqueDePrint).toMatch(/\.hoja-impresa,\s*\n?\s*\.hoja-impresa \*\s*\{\s*visibility:\s*visible/)
  })

  it('se usa `visibility` y NO `display: none`', () => {
    // Hay que esconder a los ANTEPASADOS de la hoja sin esconderla a ella:
    // con `display` se iría también el contenido.
    expect(bloqueDePrint).not.toMatch(/body \*\s*\{\s*display:\s*none/)
  })

  it('la hoja se coloca arriba a la izquierda, donde quedó el hueco', () => {
    expect(bloqueDePrint).toMatch(/\.hoja-impresa\s*\{[^}]*position:\s*absolute/)
  })

  it('la página es carta con margen', () => {
    expect(bloqueDePrint).toContain('@page { size: letter; margin: 12mm; }')
  })

  it('los colores de marca se conservan en el papel', () => {
    expect(bloqueDePrint).toContain('print-color-adjust: exact')
  })
})
