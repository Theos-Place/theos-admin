// La ventana de asistencia se leyó mal en el centro de ayuda (2026-08-05): la
// guía decía "el mes en curso no cuenta todavía". Sí cuenta — lo que se excluye
// es el mes en curso del CONTEO de meses hacia atrás, no sus check-ins. Este
// test fija la regla para que la próxima vez no haya que deducirla del código.
import { describe, it, expect } from 'vitest'
import {
  attendanceWindowStart, attendanceRecencyStart, meetsAttendanceCriteria,
  ATTENDANCE_MONTHS, ATTENDANCE_MIN_CHARLAS, ATTENDANCE_MIN_CHARLAS_INTERMEDIA,
} from './attendance'

const AGOSTO_4 = new Date(2026, 7, 4) // 4 de agosto de 2026, hora local

describe('attendanceWindowStart', () => {
  it('arranca el día 1 del mes de hace 6 meses', () => {
    expect(attendanceWindowStart(ATTENDANCE_MONTHS, AGOSTO_4)).toBe('2026-02-01')
  })

  it('no tiene tope superior: el mes en curso entra', () => {
    const start = attendanceWindowStart(ATTENDANCE_MONTHS, AGOSTO_4)
    const hoy = '2026-08-04T10:00:00.000Z'
    expect(hoy >= start).toBe(true)
  })

  it('cruza bien el año', () => {
    expect(attendanceWindowStart(6, new Date(2026, 0, 15))).toBe('2025-07-01') // enero → julio del año pasado
  })
})

describe('meetsAttendanceCriteria', () => {
  /** n charlas repartidas hacia atrás desde `desde`, una cada 5 días. */
  const charlas = (n: number, desde = AGOSTO_4) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(desde)
      d.setDate(d.getDate() - i * 5)
      return d.toISOString()
    })

  it('una charla DE ESTE MES cuenta para el total', () => {
    // 5 charlas viejas (dentro de la ventana) + 1 de hoy = 6.
    const viejas = charlas(5, new Date(2026, 5, 20)) // junio
    const deHoy = [AGOSTO_4.toISOString()]
    expect(meetsAttendanceCriteria([...viejas, ...deHoy], { now: AGOSTO_4 })).toBe(true)
  })

  it('sin las 6 no alcanza, por más recientes que sean', () => {
    expect(meetsAttendanceCriteria(charlas(ATTENDANCE_MIN_CHARLAS - 1), { now: AGOSTO_4 })).toBe(false)
  })

  it('con 6 pero ninguna en los últimos 60 días, tampoco', () => {
    // Todas en febrero/marzo: entran en la ventana pero fallan la recencia.
    const viejas = charlas(8, new Date(2026, 1, 20))
    expect(meetsAttendanceCriteria(viejas, { now: AGOSTO_4 })).toBe(false)
  })

  it('las anteriores a la ventana no suman', () => {
    const antesDeLaVentana = charlas(10, new Date(2026, 0, 15)) // enero, fuera
    const recientes = charlas(1, AGOSTO_4)
    expect(meetsAttendanceCriteria([...antesDeLaVentana, ...recientes], { now: AGOSTO_4 })).toBe(false)
  })

  it('la reforzada es el doble, con la misma ventana y la misma recencia', () => {
    expect(ATTENDANCE_MIN_CHARLAS_INTERMEDIA).toBe(ATTENDANCE_MIN_CHARLAS * 2)
    const seis = charlas(6)
    expect(meetsAttendanceCriteria(seis, { now: AGOSTO_4 })).toBe(true)
    expect(meetsAttendanceCriteria(seis, { minCount: ATTENDANCE_MIN_CHARLAS_INTERMEDIA, now: AGOSTO_4 })).toBe(false)
    expect(meetsAttendanceCriteria(charlas(12), { minCount: ATTENDANCE_MIN_CHARLAS_INTERMEDIA, now: AGOSTO_4 })).toBe(true)
  })
})

describe('attendanceRecencyStart', () => {
  it('son 60 días hacia atrás', () => {
    expect(attendanceRecencyStart(60, AGOSTO_4).slice(0, 10)).toBe('2026-06-05')
  })
})
