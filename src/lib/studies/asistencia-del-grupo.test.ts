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

describe('el payload cruza JSON: nada de Map', () => {
  // ROTO Y ARREGLADO EL 2026-09-22, EN LA MISMA HORA. La primera versión
  // mandaba `asistencia.pct` como Map. La ruta del detalle devuelve el objeto
  // del servidor TAL CUAL y el adapter corre en el CLIENTE, así que el Map
  // llegaba como `{}`, el `.get()` reventaba y la pantalla decía "Grupo no
  // encontrado" — un dirigente se quedó sin ver su grupo.
  it('un Map NO sobrevive la serialización, un objeto sí', () => {
    const mapa = porcentajesPorMiembro([{ member_id: 'a', present: true }], 1)
    expect(JSON.parse(JSON.stringify({ pct: mapa })).pct).toEqual({})

    const plano = Object.fromEntries(mapa)
    expect(JSON.parse(JSON.stringify({ pct: plano })).pct).toEqual({ a: 100 })
  })

  it('leer el porcentaje del objeto plano da lo mismo que del Map', () => {
    const filas = [
      { member_id: 'a', present: true }, { member_id: 'b', present: false },
    ]
    const mapa = porcentajesPorMiembro(filas, 1)
    const plano: Record<string, number> = Object.fromEntries(mapa)
    // Así lo lee el adapter. Quien faltó no está, y eso es 0.
    expect(plano['a'] ?? 0).toBe(100)
    expect(plano['b'] ?? 0).toBe(0)
  })
})
