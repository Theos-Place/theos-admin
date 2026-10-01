import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/lib/auth/password-link.ts', 'utf8')

/**
 * El correo del enlace de contraseña avisa que pedir otro MATA al anterior.
 *
 * CASO REAL (Nestor Gamboa, 2026-10-01): pidió el enlace tres veces en dos
 * minutos, abrió el primer correo y le dijo «vencido». Volvió a pedir, abrió
 * uno viejo otra vez, y así — un círculo perfecto del que no se sale, porque
 * el correo decía que el enlace «vence» pero no que **el siguiente anula al
 * anterior**. Esas son dos cosas distintas y solo una explica lo que le pasa.
 *
 * Es la causa más probable de cualquier «el link no me sirve» futuro: 8.194
 * cuentas todavía no han entrado nunca.
 */
describe('el correo explica por qué un enlace recién llegado puede estar vencido', () => {
  it('lo dice con todas las letras', () => {
    expect(SRC).toContain('abrí el correo más reciente')
    expect(SRC).toContain('Cada enlace nuevo deja sin efecto a los anteriores')
  })

  it('y sigue diciendo que es de un solo uso', () => {
    // No reemplaza el aviso viejo: son dos motivos distintos de fallo y la
    // persona no sabe en cuál cayó.
    expect(SRC).toContain('una sola vez')
  })

  it('el aviso va en los DOS tipos de enlace', () => {
    // `invite` y `recovery` comparten el mismo cuerpo: quien recibe una
    // invitación puede pedirla dos veces igual que quien recupera.
    const cuerpo = SRC.slice(SRC.indexOf('function body('), SRC.indexOf('function body(') + 2200)
    expect(cuerpo).toContain('Cada enlace nuevo deja sin efecto')
    expect(cuerpo.indexOf('Cada enlace nuevo')).toBeGreaterThan(cuerpo.indexOf("kind === 'invite'"))
  })
})
