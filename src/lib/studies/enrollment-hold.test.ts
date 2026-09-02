import { describe, it, expect } from 'vitest'
import { HORAS_DE_GRACIA, MOTIVO_EXPIRADA, reservaExpirada } from './enrollment-hold'

const ahora = new Date('2026-09-02T12:00:00Z')
const haceHoras = (h: number) => new Date(ahora.getTime() - h * 3600_000).toISOString()

describe('reservaExpirada', () => {
  it('sin comprobante y pasada la ventana, se suelta el cupo', () => {
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: haceHoras(25), ahora })).toBe(true)
  })

  it('dentro de la ventana, se respeta', () => {
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: haceHoras(23), ahora })).toBe(false)
  })

  it('justo en el borde, expira', () => {
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: haceHoras(HORAS_DE_GRACIA), ahora })).toBe(true)
  })

  it('si YA mandó comprobante, no se toca por más viejo que sea', () => {
    // En revisión o rechazado son casos de finanzas, no abandono. Barrer a
    // alguien que sí pagó porque el revisor tardó sería el peor error posible.
    for (const reviewStatus of ['en_revision', 'aprobado', 'rechazado']) {
      expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus, creadaEn: haceHoras(500), ahora }), reviewStatus).toBe(false)
    }
  })

  it('las matrículas AUTOMÁTICAS del cierre nunca expiran', () => {
    // Nacen 'enrolled' con un cobro aparte: a esa persona no la puso nadie en
    // un flujo a medias, la matriculó el sistema al aprobar el nivel anterior.
    // Quitarle el cupo sería sacarla de una cohorte que ya avanzó con ella.
    expect(reservaExpirada({ status: 'enrolled', reviewStatus: null, creadaEn: haceHoras(5000), ahora })).toBe(false)
  })

  it('ningún otro estado se toca', () => {
    for (const status of ['completed', 'dropped', 'waitlist', 'reprobado', 'en_revision', 'transferred']) {
      expect(reservaExpirada({ status, reviewStatus: null, creadaEn: haceHoras(500), ahora }), status).toBe(false)
    }
  })

  it('una fecha ilegible no expira nada', () => {
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: 'ayer', ahora })).toBe(false)
  })

  it('el motivo dice qué pasó y cuánto se esperó', () => {
    expect(MOTIVO_EXPIRADA).toContain(String(HORAS_DE_GRACIA))
    expect(MOTIVO_EXPIRADA).toMatch(/liberó el cupo/i)
  })
})
