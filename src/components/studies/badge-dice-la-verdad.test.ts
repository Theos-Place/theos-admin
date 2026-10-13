import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * DIR-9 · El badge de la ficha no puede decir «Disponible» de alguien que
 * tiene un grupo abierto.
 *
 * MEDIDO EL 2026-10-13: 109 dirigentes tenían un grupo en curso o en
 * matrícula y 106 de ellos mostraban `disponibilidad = 'disponible'`. El
 * reporte nuevo ya lo deriva; si la ficha no, las dos pantallas dicen cosas
 * distintas de la misma persona — que es exactamente el tipo de bug que
 * este mes apareció tres veces (REP-15, REP-16 y este).
 *
 * El test mira la FUENTE porque no hay testing-library en el repo. Es
 * frágil a un renombre, y está bien: un renombre de estas dos cosas merece
 * que alguien vuelva a leer este comentario.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const FORM = sinComentarios('src/components/studies/EstadoDelDirigente.tsx')
const FICHA = sinComentarios('src/app/(admin)/estudios/dirigentes/[id]/page.tsx')

describe('la ficha del dirigente deriva «dirigiendo», no se fía del campo', () => {
  it('el badge muestra el estado EFECTIVO y no el guardado', () => {
    // `resumen(e)` era el bug: `e` es lo guardado.
    expect(FORM).toContain('resumen(efectivo)')
    expect(FORM).not.toMatch(/\{resumen\(e\)\}/)
  })

  it('y lo calcula con la misma función que el reporte', () => {
    expect(FORM).toContain('disponibilidadEfectiva')
  })

  it('la pantalla le pasa si tiene grupo, filtrando los que no ocupan', () => {
    // Sin `ocupaAlDirigente` contaría el prematrimonial, que por decisión de
    // DIR-8 no ocupa al dirigente.
    expect(FICHA).toContain('ocupaAlDirigente')
    expect(FICHA).toMatch(/dirigiendo=\{[^}]*ocupaAlDirigente/)
  })

  it('pero el SELECTOR sigue mostrando lo que eligió coordinación', () => {
    // Si el selector se derivara, el coordinador elegiría «disponible» y
    // vería que su elección no quedó. La derivación es para mostrar, no
    // para pisar una decisión.
    expect(FORM).toContain("value={e.disponibilidad ?? 'disponible'}")
  })
})
