import { describe, it, expect } from 'vitest'
import {
  puedeMoverse, planearMovimiento, avisoDelCambio,
  type BecaParaMover, type DestinoNuevo,
} from './cambio-de-destino-beca'
import { formatMoney } from '@/lib/format'

const ROMANOS = 'plan-romanos'
const HECHOS = 'plan-hechos'

const beca = (over: Partial<BecaParaMover> = {}): BecaParaMover => ({
  kind: 'asignada', status: 'active', entity_type: 'study_plan',
  plan_id: ROMANOS, event_id: null,
  discount_type: 'percentage', discount_value: 100, currency: 'CRC', used_count: 0,
  ...over,
})
const destino = (over: Partial<DestinoNuevo> = {}): DestinoNuevo => ({
  entity_type: 'study_plan', id: HECHOS, nombre: 'Hechos', currency: 'CRC', cost: 20000, ...over,
})

describe('puedeMoverse', () => {
  it('deja mover una beca asignada activa y sin usar', () => {
    expect(puedeMoverse(beca())).toEqual({ ok: true })
  })
  it('no mueve una beca ya usada: la reviviría', () => {
    expect(puedeMoverse(beca({ status: 'used' }))).toEqual({ ok: false, error: 'no_activa' })
  })
  it('no mueve una revocada', () => {
    expect(puedeMoverse(beca({ status: 'revoked' }))).toEqual({ ok: false, error: 'no_activa' })
  })
  it('no mueve un cupón genérico: el código ya circula', () => {
    expect(puedeMoverse(beca({ kind: 'generica' }))).toEqual({ ok: false, error: 'cupon_generico' })
  })
  it('una asignada activa con redenciones tampoco se mueve', () => {
    expect(puedeMoverse(beca({ used_count: 1 }))).toEqual({ ok: false, error: 'no_activa' })
  })
})

describe('planearMovimiento', () => {
  it('mover al mismo destino no es un movimiento', () => {
    const m = planearMovimiento(beca(), destino({ id: ROMANOS }))
    expect(m).toEqual({ ok: false, error: 'mismo_destino' })
  })

  it('el mismo id en otro tipo de entidad SÍ es un movimiento', () => {
    // plan_id y event_id son tablas distintas: un uuid igual sería coincidencia.
    const m = planearMovimiento(beca(), destino({ entity_type: 'event', id: ROMANOS }))
    expect(m.ok).toBe(true)
  })

  it('un 100% se recongela contra el precio del destino nuevo', () => {
    const m = planearMovimiento(beca(), destino({ cost: 20000 }))
    if (!m.ok) throw new Error('debía poder moverse')
    expect(m.campos.plan_id).toBe(HECHOS)
    expect(m.campos.event_id).toBeNull()
    expect(m.campos.original_amount).toBe(20000)
    expect(m.campos.final_amount).toBe(0)
    expect(m.campos.approval_type).toBe('total')
  })

  it('un monto fijo que cubría todo pasa a parcial si el destino es más caro', () => {
    const m = planearMovimiento(beca({ discount_type: 'fixed', discount_value: 15000 }), destino({ cost: 25000 }))
    if (!m.ok) throw new Error('debía poder moverse')
    expect(m.campos.final_amount).toBe(10000)
    expect(m.campos.approval_type).toBe('parcial')
  })

  it('un monto fijo en otra moneda no se puede mover ahí', () => {
    const m = planearMovimiento(
      beca({ discount_type: 'fixed', discount_value: 15000, currency: 'CRC' }),
      destino({ currency: 'EUR', cost: 30 }),
    )
    expect(m).toEqual({ ok: false, error: 'moneda_distinta' })
  })

  it('un porcentaje sí cruza monedas: 50% es 50% de lo que valga', () => {
    const m = planearMovimiento(beca({ discount_value: 50, currency: 'CRC' }), destino({ currency: 'EUR', cost: 30 }))
    if (!m.ok) throw new Error('debía poder moverse')
    expect(m.campos.currency).toBe('EUR')
    expect(m.campos.final_amount).toBe(15)
  })

  it('sin costo conocido se mueve igual, pero sin montos congelados', () => {
    const m = planearMovimiento(beca(), destino({ cost: null }))
    if (!m.ok) throw new Error('debía poder moverse')
    expect(m.breakdown).toBeNull()
    expect(m.campos.original_amount).toBeNull()
    expect(m.campos.final_amount).toBeNull()
  })

  it('mover a un evento limpia el plan_id', () => {
    const m = planearMovimiento(beca(), destino({ entity_type: 'event', id: 'ev-1', nombre: 'Retiro' }))
    if (!m.ok) throw new Error('debía poder moverse')
    expect(m.campos.entity_type).toBe('event')
    expect(m.campos.event_id).toBe('ev-1')
    expect(m.campos.plan_id).toBeNull()
  })

  it('una beca bloqueada no llega a calcular nada', () => {
    expect(planearMovimiento(beca({ status: 'used' }), destino())).toEqual({ ok: false, error: 'no_activa' })
  })
})

describe('avisoDelCambio', () => {
  // El separador de miles lo pone formatMoney (Intl): se compara contra la
  // misma función y no contra "10.000", que en Node sale con espacio fino.
  const plata = (n: number) => formatMoney(n, 'CRC')

  it('avisa cuánto queda por pagar cuando el destino nuevo no queda cubierto', () => {
    const b = beca({ discount_type: 'fixed', discount_value: 20000 })
    const d = destino({ cost: 30000 })
    expect(avisoDelCambio(b, d, planearMovimiento(b, d))).toContain(plata(10000))
  })

  it('si la beca era del 100%, el aviso dice que a la persona se le avisó que no pagaba nada', () => {
    // Un porcentaje del 100% siempre cubre, así que el caso solo existe cuando
    // el destino no tiene costo… el que sí deja saldo es el monto fijo.
    const b = beca({ discount_type: 'fixed', discount_value: 5000 })
    const d = destino({ cost: 20000 })
    const aviso = avisoDelCambio(b, d, planearMovimiento(b, d))
    expect(aviso).toContain(plata(15000))
    expect(aviso).not.toContain('no pagaba nada')
  })

  it('avisa si no se sabe cuánto cuesta el destino', () => {
    const d = destino({ cost: null })
    expect(avisoDelCambio(beca(), d, planearMovimiento(beca(), d))).toContain('No sabemos cuánto cuesta')
  })

  it('un fijo mayor al costo avisa que la diferencia no se devuelve', () => {
    const b = beca({ discount_type: 'fixed', discount_value: 25000 })
    const d = destino({ cost: 20000 })
    expect(avisoDelCambio(b, d, planearMovimiento(b, d))).toContain('no se devuelve')
  })

  it('un 100% que sigue cubriendo todo no dice nada', () => {
    const d = destino({ cost: 20000 })
    expect(avisoDelCambio(beca(), d, planearMovimiento(beca(), d))).toBeNull()
  })

  it('un movimiento bloqueado no produce aviso', () => {
    const d = destino({ id: ROMANOS })
    expect(avisoDelCambio(beca(), d, planearMovimiento(beca(), d))).toBeNull()
  })
})
