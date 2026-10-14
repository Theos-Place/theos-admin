import { describe, it, expect } from 'vitest'
import {
  evaluarSeleccion, sePuedeIncluir, ofrecerPagoJunto, referenciasRepetidas,
  MAXIMO_POR_COMPROBANTE,
} from './comprobante-multiple'

const YO = 'm-1'
const cobro = (over: Partial<Parameters<typeof evaluarSeleccion>[0][number]> = {}) => ({
  id: 'p-' + Math.random().toString(36).slice(2, 7),
  amount: 10000,
  currency: 'CRC',
  queue_status: 'pendiente',
  member_id: YO,
  ...over,
})

describe('PAG-5 · qué cobro puede entrar en un comprobante compartido', () => {
  it('un pendiente, sí', () => {
    expect(sePuedeIncluir(cobro())).toBe(true)
  })

  it('uno EN REVISIÓN, no: ya tiene un comprobante encima', () => {
    // Meterlo en otro es contar el mismo dinero dos veces — el bug de FIN-6
    // entrando por la puerta nueva.
    expect(sePuedeIncluir(cobro({ queue_status: 'en_revision' }))).toBe(false)
  })

  it('uno ya cerrado, tampoco', () => {
    expect(sePuedeIncluir(cobro({ queue_status: 'aprobado' }))).toBe(false)
    expect(sePuedeIncluir(cobro({ queue_status: 'rechazado' }))).toBe(false)
  })
})

describe('PAG-5 · la selección', () => {
  it('dos pendientes de la misma moneda suman', () => {
    const r = evaluarSeleccion([cobro({ amount: 10000 }), cobro({ amount: 15000 })], YO)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.total).toBe(25000); expect(r.currency).toBe('CRC'); expect(r.ids).toHaveLength(2) }
  })

  it('un solo cobro NO usa este camino', () => {
    // No es un error del usuario: es que ya existe el botón de ese cobro, y
    // duplicar el flujo para N=1 duplica también el guard de FIN-6.
    const r = evaluarSeleccion([cobro()], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('uno_solo')
  })

  it('ninguno, tampoco', () => {
    const r = evaluarSeleccion([], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('ninguno')
  })

  it('NUNCA suma dos monedas (INT-3)', () => {
    // «₡30.000 + $20» no es un número.
    const r = evaluarSeleccion([cobro({ currency: 'CRC' }), cobro({ currency: 'USD' })], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.error.code).toBe('monedas_mezcladas'); expect(r.error.mensaje).toContain('USD') }
  })

  it('un cobro que dejó de estar pendiente frena TODO el grupo', () => {
    // Pasa de verdad: la persona deja la pantalla abierta, paga uno desde el
    // celular y vuelve a mandar la selección vieja.
    const r = evaluarSeleccion([cobro(), cobro({ queue_status: 'en_revision' })], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('no_pendiente')
  })

  it('cobros de OTRA persona no se juntan', () => {
    // Una familia pagando junta sí es legítima, pero se resuelve subiendo el
    // comprobante en cada ficha: así queda claro de quién es cada pago.
    const r = evaluarSeleccion([cobro(), cobro({ member_id: 'm-2' })], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('otra_persona')
  })

  it('hay un techo de cuántos se juntan', () => {
    const muchos = Array.from({ length: MAXIMO_POR_COMPROBANTE + 1 }, () => cobro())
    const r = evaluarSeleccion(muchos, YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('demasiados')
  })

  it('el total no arrastra basura de punto flotante', () => {
    const r = evaluarSeleccion([cobro({ amount: 0.1 }), cobro({ amount: 0.2 })], YO)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.total).toBe(0.3)
  })

  it('el orden del mensaje de error importa: primero de quién es, después el estado', () => {
    // Un cobro ajeno Y no pendiente tiene que decir que es ajeno: es el dato
    // que le explica a la persona por qué no puede.
    const r = evaluarSeleccion([cobro(), cobro({ member_id: 'm-2', queue_status: 'aprobado' })], YO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('otra_persona')
  })
})

describe('PAG-5 · cuándo ofrecer el modo', () => {
  it('con dos pendientes, sí', () => {
    expect(ofrecerPagoJunto([cobro(), cobro()])).toBe(true)
  })

  it('con uno solo pendiente, no', () => {
    expect(ofrecerPagoJunto([cobro(), cobro({ queue_status: 'aprobado' })])).toBe(false)
  })

  it('con ninguno, no', () => {
    expect(ofrecerPagoJunto([])).toBe(false)
  })
})

describe('PAG-5 · la banderita de referencia repetida no se dispara sola', () => {
  it('tres cobros de UN comprobante no son una referencia repetida', () => {
    // Una alarma que suena cuando todo está bien deja de mirarse.
    const repes = referenciasRepetidas([
      { reference_code: 'SINPE-123', comprobante_grupo: 'g1' },
      { reference_code: 'SINPE-123', comprobante_grupo: 'g1' },
      { reference_code: 'SINPE-123', comprobante_grupo: 'g1' },
    ])
    expect([...repes]).toEqual([])
  })

  it('pero la MISMA referencia cargada dos veces aparte, sí', () => {
    // Este es el bug de Adriana y Raquel: ₡5.000 transferidos una vez,
    // contados dos. Sigue sonando.
    const repes = referenciasRepetidas([
      { reference_code: 'SINPE-123', comprobante_grupo: null },
      { reference_code: 'SINPE-123', comprobante_grupo: null },
    ])
    expect([...repes]).toEqual(['SINPE-123'])
  })

  it('un grupo MÁS una carga suelta con la misma referencia, también suena', () => {
    const repes = referenciasRepetidas([
      { reference_code: 'X-9', comprobante_grupo: 'g1' },
      { reference_code: 'X-9', comprobante_grupo: 'g1' },
      { reference_code: 'X-9', comprobante_grupo: null },
    ])
    expect([...repes]).toEqual(['X-9'])
  })

  it('dos grupos distintos con la misma referencia suenan', () => {
    const repes = referenciasRepetidas([
      { reference_code: 'X-9', comprobante_grupo: 'g1' },
      { reference_code: 'X-9', comprobante_grupo: 'g2' },
    ])
    expect([...repes]).toEqual(['X-9'])
  })

  it('sin referencia no hay nada que comparar', () => {
    expect([...referenciasRepetidas([{ reference_code: null }, { reference_code: '  ' }])]).toEqual([])
  })

  it('es determinista: la misma entrada da el mismo resultado', () => {
    const filas = [
      { reference_code: 'A', comprobante_grupo: null },
      { reference_code: 'A', comprobante_grupo: null },
      { reference_code: 'B', comprobante_grupo: 'g' },
    ]
    expect([...referenciasRepetidas(filas)]).toEqual([...referenciasRepetidas(filas)])
  })
})
