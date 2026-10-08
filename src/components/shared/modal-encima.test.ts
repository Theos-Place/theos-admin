import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * UN MODAL SOBRE OTRO MODAL.
 *
 * Todos los modales compartían `z-[1000]`. Con el mismo z-index gana el que
 * esté más abajo en el DOM, que no tiene por qué ser el que se abrió último:
 * en la cola de pagos se abría el detalle, se apretaba «Ver comprobante» y el
 * comprobante cargaba DETRÁS del detalle, porque el modal del detalle está
 * después en el archivo (reportado por Floriana el 2026-10-07).
 *
 * Arreglarlo reordenando el JSX habría funcionado UNA vez y se habría roto
 * con el próximo modal que alguien agregue en medio. El orden del archivo no
 * puede ser lo que decide qué ve la gente.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const MODAL = sinComentarios('src/components/shared/Modal.tsx')
const COLA = sinComentarios('src/components/finance/PaymentReviewQueue.tsx')

describe('modal sobre modal', () => {
  it('el Modal compartido sabe ponerse encima', () => {
    expect(MODAL).toContain('encima')
    expect(MODAL).toContain("'z-[1100]'")
    expect(MODAL).toContain("'z-[1000]'")
  })

  it('y por default NO se pone encima: un modal suelto no cambia', () => {
    expect(MODAL).toContain('encima = false')
  })

  it('el comprobante de la cola de pagos lo usa', () => {
    // Es el caso que lo destapó: se abre desde el detalle del pago.
    const i = COLA.indexOf('titleId="receipt-title"')
    expect(i, 'tiene que existir el modal del comprobante').toBeGreaterThan(-1)
    expect(COLA.slice(i, i + 120)).toContain('encima')
  })

  it('el del DETALLE no lo usa: si los dos suben, vuelve el empate', () => {
    /**
     * El bug no era que el comprobante estuviera bajo; era que los dos
     * estaban iguales. Subir los dos lo reproduce con otro número.
     */
    const i = COLA.indexOf('titleId="detail-title"')
    expect(i).toBeGreaterThan(-1)
    expect(COLA.slice(i, i + 120)).not.toContain('encima')
  })

  it('nadie se inventa un z-index suelto para taparlo', () => {
    // Con un `zIndex` libre, en un año hay un z-[9999] y volvemos a empezar.
    for (const z of ['z-[2000]', 'z-[9999]', 'zIndex:']) {
      expect(COLA, z).not.toContain(z)
    }
  })
})
