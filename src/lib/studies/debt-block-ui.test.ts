// PAG-2 · El motivo de bloqueo por deuda viaja del servidor a la pantalla como
// TEXTO dentro de reasons_blocked. La pantalla lo compara para decidir si le
// agrega el enlace «pagalo acá y este estudio se habilita».
//
// Esa comparación es frágil por naturaleza: si alguien reescribe el mensaje en
// un lado, el otro deja de reconocerlo y el enlace desaparece sin que falle
// nada. Por eso el texto es una constante compartida y este test verifica que
// los dos lados la usen, en vez de repetir el string.
//
// No se pudo comprobar en vivo el 2026-08-24: la ventana de matrícula de todos
// los grupos abre el 31 de agosto, así que hoy no se renderiza ninguna tarjeta
// de estudio para nadie. La tarjeta grande de la deuda sí se verificó en el
// navegador con datos reales.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEBT_BLOCK_REASON } from './eligibility'

const PANTALLA = readFileSync('src/app/(admin)/matricula/page.tsx', 'utf8')

describe('el motivo de deuda lo comparten servidor y pantalla', () => {
  it('la pantalla compara contra la constante, no contra un string suelto', () => {
    expect(PANTALLA).toContain('r === DEBT_BLOCK_REASON')
    expect(PANTALLA).toContain("import { DEBT_BLOCK_REASON }")
  })

  it('la pantalla NO repite el texto a mano', () => {
    expect(PANTALLA).not.toContain(`'${DEBT_BLOCK_REASON}'`)
    expect(PANTALLA).not.toContain(`"${DEBT_BLOCK_REASON}"`)
  })

  // La regla es que el comprobante NO desbloquea: desbloquea la confirmación de
  // finanzas (decisión del 2026-08-24). El texto tiene que prometer eso y no
  // "en cuanto se registre", que sonaba a inmediato y no lo es.
  it('el texto promete la CONFIRMACIÓN, no el registro del comprobante', () => {
    expect(PANTALLA).toContain('En cuanto confirmemos')
    expect(PANTALLA).not.toContain('el pago quede registrado')
  })

  it('el motivo lleva a donde se resuelve', () => {
    // Sin el enlace, el bloqueo es un callejón: la persona lee que debe algo y
    // no sabe adónde ir.
    expect(PANTALLA).toContain('/mis-pagos')
  })
})
