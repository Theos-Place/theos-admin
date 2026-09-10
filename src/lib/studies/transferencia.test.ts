import { describe, it, expect } from 'vitest'
import {
  motivoQueImpideTransferir, destinosPosibles, pagosQueViajan,
  notaDeTransferencia, resumenDeLaAccion, type GrupoParaTransferir,
} from './transferencia'

const base: GrupoParaTransferir = {
  id: 'a', name: 'SCJ — Lunes', plan_id: 'scj', costo: 5000, currency: 'CRC',
  status: 'en_matricula', max_students: 10, inscritos: 7,
}
const g = (over: Partial<GrupoParaTransferir>): GrupoParaTransferir => ({ ...base, ...over })

describe('motivoQueImpideTransferir', () => {
  it('mover a otro grupo del mismo plan se puede', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', name: 'SCJ — Martes' }) })).toBeNull()
  })

  it('al mismo grupo, no', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: base })?.code).toBe('mismo_grupo')
  })

  it('a un estudio DISTINTO se bloquea: mover el pago sería cobrar una cosa por otra', () => {
    const r = motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', plan_id: 'n1', name: 'Nivel 1' }) })
    expect(r?.code).toBe('plan_distinto')
    expect(r?.mensaje).toContain('finanzas')
  })

  it('mismo plan pero otro costo, tampoco: lo ajusta finanzas', () => {
    const r = motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', costo: 8000 }) })
    expect(r?.code).toBe('costo_distinto')
    expect(r?.mensaje).toContain('8000')
  })

  it('y tampoco si cambia la moneda con el mismo número', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', currency: 'USD' }) })?.code)
      .toBe('costo_distinto')
  })

  it('a un grupo finalizado, no', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', status: 'finalizado' }) })?.code)
      .toBe('grupo_cerrado')
  })

  it('a un grupo lleno, no', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', inscritos: 10 }) })?.code)
      .toBe('sin_cupo')
  })

  it('un grupo sin tope de cupo siempre acepta', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', max_students: null, inscritos: 99 }) }))
      .toBeNull()
  })

  it('si ya completó el destino, no se toca: es su registro académico', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b' }), estadoEnDestino: 'completed' })?.code)
      .toBe('ya_completado')
  })

  it('si ya está matriculada ahí, no hay nada que mover', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b' }), estadoEnDestino: 'enrolled' })?.code)
      .toBe('ya_matriculado')
  })

  it('pero sí se puede volver a un grupo del que se retiró', () => {
    expect(motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b' }), estadoEnDestino: 'dropped' })).toBeNull()
  })
})

describe('destinosPosibles', () => {
  it('ofrece solo los que se pueden, en orden alfabético', () => {
    const opciones = destinosPosibles(base, [
      g({ id: 'z', name: 'SCJ — Zapote' }),
      g({ id: 'x', name: 'Nivel 1', plan_id: 'n1' }),      // otro estudio
      g({ id: 'y', name: 'SCJ — Belén' }),
      g({ id: 'w', name: 'SCJ — Lleno', inscritos: 10 }),  // sin cupo
      base,                                                 // el mismo
    ])
    expect(opciones.map(o => o.name)).toEqual(['SCJ — Belén', 'SCJ — Zapote'])
  })

  it('no ofrece uno donde la persona ya completó', () => {
    const opciones = destinosPosibles(base, [g({ id: 'b', name: 'SCJ — Martes' })], { b: 'completed' })
    expect(opciones).toEqual([])
  })
})

describe('pagosQueViajan', () => {
  const p = (over: Partial<{ id: string; status: string; review_status: string | null; concept: string | null }>) =>
    ({ id: 'p', status: 'paid', review_status: 'aprobado', concept: 'matricula', ...over })

  it('el aprobado viaja: la matrícula nueva nace pagada', () => {
    expect(pagosQueViajan([p({})])).toHaveLength(1)
  })

  it('el comprobante en revisión viaja y sigue su cola', () => {
    expect(pagosQueViajan([p({ status: 'pending', review_status: 'en_revision' })])).toHaveLength(1)
  })

  it('el pendiente sin comprobante viaja: un solo cobro, no dos', () => {
    expect(pagosQueViajan([p({ status: 'pending', review_status: null })])).toHaveLength(1)
  })

  it('el rechazado NO viaja: ya no representa plata', () => {
    expect(pagosQueViajan([p({ review_status: 'rechazado' })])).toEqual([])
  })

  it('el cancelado tampoco', () => {
    expect(pagosQueViajan([p({ status: 'cancelado' })])).toEqual([])
  })

  it('el del folleto se queda: la persona ya tiene el folleto en la mano', () => {
    expect(pagosQueViajan([p({ concept: 'folletos' })])).toEqual([])
  })
})

describe('lo que se le dice al coordinador', () => {
  it('el resumen dice exactamente qué va a pasar', () => {
    expect(resumenDeLaAccion({ persona: 'Adriana', desde: 'SCJ — Lunes', hacia: 'SCJ — Martes', pagosQueViajan: 1 }))
      .toBe('Se cierra la matrícula de Adriana en «SCJ — Lunes» como transferida y queda matriculada en «SCJ — Martes». Su pago se traslada a la matrícula nueva; no se le cobra de nuevo.')
  })

  it('y no promete mover un pago que no existe', () => {
    expect(resumenDeLaAccion({ persona: 'Adriana', desde: 'A', hacia: 'B', pagosQueViajan: 0 }))
      .toContain('No hay ningún pago que mover.')
  })

  it('la traza del pago dice de dónde, a dónde y quién', () => {
    const nota = notaDeTransferencia({
      desde: 'SCJ — Lunes', hacia: 'SCJ — Martes', quien: 'Camila Coordinadora',
      cuando: new Date('2026-09-10T18:00:00Z'),
    })
    expect(nota).toContain('10/09/2026')
    expect(nota).toContain('SCJ — Lunes')
    expect(nota).toContain('SCJ — Martes')
    expect(nota).toContain('Camila Coordinadora')
    expect(nota).toContain('no se cobró de nuevo')
  })
})
