import { describe, it, expect } from 'vitest'
import { porcentajeDeAsistencia, porcentajesPorMiembro } from './asistencia-del-grupo'

describe('porcentajeDeAsistencia', () => {
  it('el caso que lo destapó: 4 de 5 en la única sesión', () => {
    // Un grupo en su clase 1 de 11. Quien vino tiene 100% de lo que hubo.
    expect(porcentajeDeAsistencia({ presentes: 1, sesiones: 1 })).toBe(100)
    expect(porcentajeDeAsistencia({ presentes: 0, sesiones: 1 })).toBe(0)
  })

  it('redondea', () => {
    expect(porcentajeDeAsistencia({ presentes: 2, sesiones: 3 })).toBe(67)
    expect(porcentajeDeAsistencia({ presentes: 1, sesiones: 3 })).toBe(33)
  })

  it('sin sesiones registradas es 0, no una división por cero', () => {
    expect(porcentajeDeAsistencia({ presentes: 0, sesiones: 0 })).toBe(0)
  })
})

describe('porcentajesPorMiembro', () => {
  const filas = [
    { member_id: 'a', present: true },  { member_id: 'b', present: false },
    { member_id: 'a', present: true },  { member_id: 'b', present: true },
  ]

  it('cuenta las presencias de cada quien sobre el total de sesiones', () => {
    const m = porcentajesPorMiembro(filas, 2)
    expect(m.get('a')).toBe(100)
    expect(m.get('b')).toBe(50)
  })

  it('el total de sesiones NO se deduce de las filas', () => {
    // Quien faltó a las dos no aparece con `present`, y si el total saliera de
    // ahí cada quien se mediría contra un denominador distinto.
    const soloUno = [{ member_id: 'a', present: true }]
    expect(porcentajesPorMiembro(soloUno, 4).get('a')).toBe(25)
  })

  it('quien no tiene ninguna presencia no queda en el mapa', () => {
    // El llamador lo resuelve como 0: así no hay que inventar la lista de
    // inscritos acá, que es de quien arma la pantalla.
    expect(porcentajesPorMiembro([{ member_id: 'x', present: false }], 3).has('x')).toBe(false)
  })
})
