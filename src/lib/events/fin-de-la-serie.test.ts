import { describe, it, expect } from 'vitest'
import {
  problemaDeLaSerie, impideGuardar, mensajeDelProblema,
  MENSAJE_FIN_ANTES, MENSAJE_UNA_SOLA, duracionSospechosa, mensajeDeDuracion,
} from './fin-de-la-serie'

describe('problemaDeLaSerie', () => {
  it('el caso real: evento el 2 de octubre, serie que termina el 18 de setiembre', () => {
    // Regla "cada 2 semanas, viernes" correcta, pero solo salía el 2.
    const p = problemaDeLaSerie(true, '2026-10-02', '2026-09-18')
    expect(p).toEqual({ clase: 'fin_antes_del_inicio' })
    expect(impideGuardar(p)).toBe(true)
    expect(mensajeDelProblema(p)).toBe(MENSAJE_FIN_ANTES)
  })

  it('el otro caso real: la serie termina el mismo día que empieza', () => {
    // Es válido —una sola fecha— pero casi nunca es lo que se quiso, así que se
    // avisa sin bloquear.
    const p = problemaDeLaSerie(true, '2026-10-02', '2026-10-02')
    expect(p).toEqual({ clase: 'una_sola_fecha' })
    expect(impideGuardar(p)).toBe(false)
    expect(mensajeDelProblema(p)).toBe(MENSAJE_UNA_SOLA)
  })

  it('un fin posterior está bien', () => {
    expect(problemaDeLaSerie(true, '2026-10-02', '2026-12-31')).toBeNull()
  })

  it('sin fin está bien: la serie no termina', () => {
    expect(problemaDeLaSerie(true, '2026-10-02', '')).toBeNull()
    expect(problemaDeLaSerie(true, '2026-10-02', null)).toBeNull()
  })

  it('un evento que no se repite no tiene serie que revisar', () => {
    expect(problemaDeLaSerie(false, '2026-10-02', '2026-01-01')).toBeNull()
  })

  it('acepta fechas ISO completas, no solo YYYY-MM-DD', () => {
    expect(problemaDeLaSerie(true, '2026-10-02T15:00:00Z', '2026-09-18T23:59:00Z'))
      .toEqual({ clase: 'fin_antes_del_inicio' })
  })

  it('sin problema no hay mensaje', () => {
    expect(mensajeDelProblema(null)).toBeNull()
    expect(impideGuardar(null)).toBe(false)
  })
})

describe('duracionSospechosa', () => {
  it('el caso real: "Fin" con la fecha de la segunda repetición', () => {
    // Inicio 2 oct 13:30, Fin 16 oct 15:30 → el evento "dura" 14 días.
    const d = duracionSospechosa(true, '2026-10-02T13:30:00', '2026-10-16T15:30:00')
    expect(d).toBe(14)
    expect(mensajeDeDuracion(d!)).toMatch(/no la última repetición/)
  })

  it('un evento de unas horas no dice nada', () => {
    expect(duracionSospechosa(true, '2026-10-02T13:30:00', '2026-10-02T15:30:00')).toBeNull()
  })

  it('cruzar la medianoche es normal y no se avisa', () => {
    expect(duracionSospechosa(true, '2026-10-02T22:00:00', '2026-10-03T02:00:00')).toBeNull()
  })

  it('si no se repite, que dure lo que quiera', () => {
    expect(duracionSospechosa(false, '2026-10-02T13:30:00', '2026-10-16T15:30:00')).toBeNull()
  })

  it('sin fin no hay nada que revisar', () => {
    expect(duracionSospechosa(true, '2026-10-02T13:30:00', null)).toBeNull()
  })
})
