import { describe, it, expect } from 'vitest'
import {
  matrizDeAsistencia, faltasSeguidasAlFinal, hayQueLlamar, FALTAS_PARA_AVISAR,
  type EstadoDeCelda,
} from './asistencia-por-participante'

const S = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]
const P = [
  { member_id: 'ana', nombre: 'Ana' },
  { member_id: 'beto', nombre: 'Beto' },
]

describe('matriz de asistencia', () => {
  it('pinta presente, ausente y sin registro, cada uno por su lado', () => {
    const m = matrizDeAsistencia({
      sesiones: S,
      participantes: P,
      marcas: [
        { session_id: 's1', member_id: 'ana', present: true },
        { session_id: 's2', member_id: 'ana', present: false },
        // Ana no tiene fila en s3; Beto solo en s3.
        { session_id: 's3', member_id: 'beto', present: true },
      ],
    })
    expect(m[0].celdas).toEqual(['presente', 'ausente', 'sin_registro'])
    expect(m[1].celdas).toEqual(['sin_registro', 'sin_registro', 'presente'])
  })

  it('EL PUNTO DEL MÓDULO: quien se matriculó tarde no arrastra faltas inventadas', () => {
    /**
     * Beto entró en la sesión 3 y fue. Si «sin registro» contara como falta,
     * su porcentaje sería 33% y el dirigente lo llamaría por un problema que
     * no existe. Las sesiones que no vivió no cuentan.
     */
    const m = matrizDeAsistencia({
      sesiones: S, participantes: P,
      marcas: [{ session_id: 's3', member_id: 'beto', present: true }],
    })
    const beto = m[1]
    expect(beto.registradas).toBe(1)
    expect(beto.presentes).toBe(1)
    expect(beto.porcentaje).toBe(100)
  })

  it('a quien nunca se le pasó lista, el porcentaje es null y no 0%', () => {
    // 0% se lee como «no viene nunca». La verdad es «no sabemos».
    const m = matrizDeAsistencia({ sesiones: S, participantes: P, marcas: [] })
    expect(m[0].porcentaje).toBeNull()
    expect(m[0].registradas).toBe(0)
  })

  it('el orden de las columnas lo manda `sesiones`, no el de las marcas', () => {
    // Si se desalinearan, la falta del martes aparecería el jueves.
    const m = matrizDeAsistencia({
      sesiones: S, participantes: [P[0]],
      marcas: [
        { session_id: 's3', member_id: 'ana', present: false },
        { session_id: 's1', member_id: 'ana', present: true },
      ],
    })
    expect(m[0].celdas).toEqual(['presente', 'sin_registro', 'ausente'])
  })

  it('una marca de alguien que ya no está en el grupo no agrega filas', () => {
    const m = matrizDeAsistencia({
      sesiones: S, participantes: [P[0]],
      marcas: [{ session_id: 's1', member_id: 'fantasma', present: true }],
    })
    expect(m).toHaveLength(1)
    expect(m[0].member_id).toBe('ana')
  })

  it('sin sesiones no revienta: la matriz queda vacía', () => {
    const m = matrizDeAsistencia({ sesiones: [], participantes: P, marcas: [] })
    expect(m[0].celdas).toEqual([])
    expect(m[0].porcentaje).toBeNull()
  })
})

describe('a quién llamar', () => {
  const c = (s: string): EstadoDeCelda[] =>
    [...s].map(ch => (ch === 'P' ? 'presente' : ch === 'A' ? 'ausente' : 'sin_registro'))

  it('cuenta las faltas del FINAL, no las del total', () => {
    // Faltó tres veces en agosto y volvió: no hay que llamarlo.
    expect(faltasSeguidasAlFinal(c('AAAPPP'))).toBe(0)
    expect(hayQueLlamar(c('AAAPPP'))).toBe(false)
    // Lleva tres seguidas ahora: sí.
    expect(faltasSeguidasAlFinal(c('PPPAAA'))).toBe(3)
    expect(hayQueLlamar(c('PPPAAA'))).toBe(true)
  })

  it('«sin registro» corta la racha en vez de sumarla', () => {
    // No se le pasó lista la última vez; dar eso por falta sería inventar.
    expect(faltasSeguidasAlFinal(c('AAA-'))).toBe(0)
    expect(hayQueLlamar(c('AAA-'))).toBe(false)
  })

  it('con menos del umbral todavía no avisa', () => {
    expect(FALTAS_PARA_AVISAR).toBe(3)
    expect(hayQueLlamar(c('PPAA'))).toBe(false)
    expect(hayQueLlamar(c('PAAA'))).toBe(true)
  })

  it('una lista vacía no avisa', () => {
    expect(hayQueLlamar([])).toBe(false)
  })
})
