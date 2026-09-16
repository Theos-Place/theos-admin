import { describe, it, expect } from 'vitest'
import { HORAS_DE_GRACIA, MOTIVO_EXPIRADA, reservaExpirada, relojDeLaReserva } from './enrollment-hold'

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

describe('relojDeLaReserva', () => {
  const pago = (over: Partial<{ concept: string | null; status: string | null; review_status: string | null; created_at: string }> = {}) => ({
    concept: 'matricula', status: 'pending', review_status: null, created_at: haceHoras(1), ...over,
  })

  it('EL BUG: una rematrícula no hereda la antigüedad de la fila vieja', () => {
    // study_enrollments se guarda con upsert sobre (group_id, member_id): al
    // volver al grupo la fila se REUSA y su created_at sigue siendo el del
    // primer intento. A María José la mataron 7 minutos después de
    // rematricularla porque la fila decía 4 días. El cobro sí es nuevo.
    const reloj = relojDeLaReserva({
      enrollmentCreatedAt: haceHoras(96),
      pagos: [pago({ created_at: haceHoras(0.1) })],
    })
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: reloj, ahora })).toBe(false)
  })

  it('sin cobro pendiente se cae al created_at de la matrícula', () => {
    expect(relojDeLaReserva({ enrollmentCreatedAt: haceHoras(30), pagos: [] })).toBe(haceHoras(30))
    expect(relojDeLaReserva({ enrollmentCreatedAt: haceHoras(30), pagos: null })).toBe(haceHoras(30))
  })

  it('un cobro CANCELADO de un intento anterior no cuenta', () => {
    // Los dos pagos de ella quedaron 'cancelado'; si contaran, el intento nuevo
    // nacería viejo otra vez.
    expect(relojDeLaReserva({
      enrollmentCreatedAt: haceHoras(96),
      pagos: [pago({ status: 'cancelado', created_at: haceHoras(96) }), pago({ created_at: haceHoras(2) })],
    })).toBe(haceHoras(2))
  })

  it('con varios cobros pendientes gana el MÁS RECIENTE', () => {
    expect(relojDeLaReserva({
      enrollmentCreatedAt: haceHoras(96),
      pagos: [pago({ created_at: haceHoras(50) }), pago({ created_at: haceHoras(3) })],
    })).toBe(haceHoras(3))
  })

  it('un cobro de otro concepto no fecha la reserva', () => {
    expect(relojDeLaReserva({
      enrollmentCreatedAt: haceHoras(30),
      pagos: [pago({ concept: 'folleto', created_at: haceHoras(1) })],
    })).toBe(haceHoras(30))
  })

  it('la que de verdad quedó abandonada sí expira', () => {
    const reloj = relojDeLaReserva({ enrollmentCreatedAt: haceHoras(40), pagos: [pago({ created_at: haceHoras(40) })] })
    expect(reservaExpirada({ status: 'pendiente_de_pago', reviewStatus: null, creadaEn: reloj, ahora })).toBe(true)
  })
})
