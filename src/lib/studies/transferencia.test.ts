import { describe, it, expect } from 'vitest'
import {
  motivoQueImpideTransferir, destinosPosibles, pagosQueViajan,
  notaDeTransferencia, resumenDeLaAccion, planDeDinero, familiaDelPlan, type GrupoParaTransferir,
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

  it('a otro ESTUDIO de la misma familia sí se puede: pasa que alguien se matricula en el equivocado', () => {
    // Caso real: se matriculó en Religiones del Mundo y le tocaba otro.
    expect(motivoQueImpideTransferir({
      origen: base, destino: g({ id: 'b', plan_id: 'rdm', name: 'Religiones del Mundo', costo: 20000 }),
    })).toBeNull()
  })

  it('lo único que bloquea del dinero es la MONEDA distinta', () => {
    const r = motivoQueImpideTransferir({ origen: base, destino: g({ id: 'b', currency: 'USD' }) })
    expect(r?.code).toBe('costo_distinto')
    expect(r?.mensaje).toContain('finanzas')
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
      g({ id: 'x', name: 'Hebreos', plan_id: 'heb', costo: 20000 }), // otro estudio, misma familia: SÍ
      g({ id: 'y', name: 'SCJ — Belén' }),
      g({ id: 'w', name: 'SCJ — Lleno', inscritos: 10 }),          // sin cupo
      g({ id: 'v', name: 'SCJ — Dólares', currency: 'USD' }),      // otra moneda
      base,                                                         // el mismo
    ])
    expect(opciones.map(o => o.name)).toEqual(['Hebreos', 'SCJ — Belén', 'SCJ — Zapote'])
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
    const dinero = planDeDinero({
      pagos: [{ id: 'p', status: 'paid', review_status: 'aprobado', concept: 'matricula', amount: 5000 }],
      costoDestino: 5000, moneda: 'CRC',
    })
    expect(resumenDeLaAccion({ persona: 'Adriana', desde: 'SCJ — Lunes', hacia: 'SCJ — Martes', mensajeDelDinero: dinero.mensaje }))
      .toBe('Se cierra la matrícula de Adriana en «SCJ — Lunes» como transferida y queda matriculada en «SCJ — Martes». Su pago se traslada a la matrícula nueva; no se le cobra de nuevo.')
  })

  it('NO dice "no se le cobra de nuevo" cuando sí se le va a cobrar', () => {
    // Se contradecía: creaba un cobro de ₡15.000 y en la misma frase decía que
    // no se cobraba nada.
    const dinero = planDeDinero({
      pagos: [{ id: 'p', status: 'paid', review_status: 'aprobado', concept: 'matricula', amount: 5000 }],
      costoDestino: 20000, moneda: 'CRC',
    })
    const texto = resumenDeLaAccion({ persona: 'Adriana', desde: 'A', hacia: 'B', mensajeDelDinero: dinero.mensaje })
    expect(texto).toContain('₡15.000')
    expect(texto).not.toContain('no se le cobra de nuevo')
  })

  it('y no promete mover un pago que no existe', () => {
    const dinero = planDeDinero({ pagos: [], costoDestino: 0, moneda: 'CRC' })
    expect(resumenDeLaAccion({ persona: 'Adriana', desde: 'A', hacia: 'B', mensajeDelDinero: dinero.mensaje }))
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

  it('la nota del cobro de la diferencia dice OTRA cosa, no se desmiente sola', () => {
    const nota = notaDeTransferencia({
      desde: 'A', hacia: 'B', quien: 'Camila', cuando: new Date('2026-09-10T18:00:00Z'), esDiferencia: true,
    })
    expect(nota).toContain('DIFERENCIA de precio')
    expect(nota).not.toContain('no se cobró de nuevo')
  })
})

describe('planDeDinero', () => {
  const pago = (over: Partial<{ id: string; status: string; review_status: string | null; concept: string | null; amount: number }>) =>
    ({ id: 'p1', status: 'paid', review_status: 'aprobado', concept: 'matricula', amount: 5000, ...over })

  it('mismo precio: el pago viaja y no se cobra nada', () => {
    const r = planDeDinero({ pagos: [pago({})], costoDestino: 5000, moneda: 'CRC' })
    expect(r).toMatchObject({ mover: ['p1'], cobrar: 0, saldoAFavor: 0, ajustar: null })
    expect(r.mensaje).toContain('no se le cobra de nuevo')
  })

  it('el caso de Religiones del Mundo: pagó ₡5.000 y el nuevo vale ₡20.000', () => {
    const r = planDeDinero({ pagos: [pago({})], costoDestino: 20000, moneda: 'CRC' })
    expect(r.cobrar).toBe(15000)
    expect(r.saldoAFavor).toBe(0)
    expect(r.mensaje).toContain('₡15.000')
    expect(r.mensaje).toContain('abono')
  })

  it('destino GRATIS: el pago la sigue acompañando y queda a favor', () => {
    const r = planDeDinero({ pagos: [pago({})], costoDestino: 0, moneda: 'CRC' })
    expect(r.mover).toEqual(['p1'])
    expect(r.saldoAFavor).toBe(5000)
    expect(r.cobrar).toBe(0)
    expect(r.mensaje).toContain('gratis')
    expect(r.mensaje).toContain('a favor')
  })

  it('destino más barato: la diferencia queda a favor, no se devuelve sola', () => {
    const r = planDeDinero({ pagos: [pago({ amount: 20000 })], costoDestino: 5000, moneda: 'CRC' })
    expect(r.saldoAFavor).toBe(15000)
    expect(r.cobrar).toBe(0)
  })

  it('todavía no pagó: se le corrige el monto al pendiente, no se le crea otro', () => {
    const r = planDeDinero({
      pagos: [pago({ status: 'pending', review_status: null })], costoDestino: 20000, moneda: 'CRC',
    })
    expect(r.ajustar).toEqual({ id: 'p1', monto: 20000 })
    expect(r.cobrar).toBe(0)
    expect(r.mensaje).toContain('un solo cobro')
  })

  it('pendiente al mismo precio: nada que ajustar', () => {
    const r = planDeDinero({
      pagos: [pago({ status: 'pending', review_status: null })], costoDestino: 5000, moneda: 'CRC',
    })
    expect(r.ajustar).toBeNull()
  })

  it('suma los pagos ya hechos antes de calcular lo que falta', () => {
    const r = planDeDinero({
      pagos: [pago({ id: 'a', amount: 5000 }), pago({ id: 'b', amount: 5000 })],
      costoDestino: 20000, moneda: 'CRC',
    })
    expect(r.cobrar).toBe(10000)
    expect(r.mover).toEqual(['a', 'b'])
  })

  it('sin pagos y destino gratis: no hay nada que mover ni que cobrar', () => {
    const r = planDeDinero({ pagos: [], costoDestino: 0, moneda: 'CRC' })
    expect(r.mensaje).toBe('No hay ningún pago que mover.')
    expect(r.cobrar).toBe(0)
  })

  it('sin pagos y destino con costo: se le cobra, y el mensaje no dice "pagó ₡0"', () => {
    // Venía de un grupo gratis (Nivel 1) y se pasa a uno que cuesta.
    const r = planDeDinero({ pagos: [], costoDestino: 5000, moneda: 'CRC' })
    expect(r.cobrar).toBe(5000)
    expect(r.mensaje).toContain('No tenía ningún pago')
    expect(r.mensaje).not.toContain('₡0')
  })
})

describe('familias de estudio (decisión 2026-09-10)', () => {
  const nivel = (over: Partial<GrupoParaTransferir> = {}): GrupoParaTransferir => ({
    id: 'n1', name: 'Nivel 3 — Lunes', plan_id: 'n3', plan_level: 'niveles', plan_code: 'N3',
    costo: 5000, currency: 'CRC', status: 'en_matricula', max_students: 10, inscritos: 2, ...over,
  })
  const capa = (over: Partial<GrupoParaTransferir> = {}): GrupoParaTransferir => ({
    id: 'c1', name: 'Panorama — Jueves', plan_id: 'pan', plan_level: 'etapa_intermedia', plan_code: 'PAN',
    costo: 20000, currency: 'CRC', status: 'en_matricula', max_students: 10, inscritos: 2, ...over,
  })

  it('de un Nivel solo se puede mover a otro Nivel', () => {
    expect(motivoQueImpideTransferir({ origen: nivel(), destino: nivel({ id: 'n2', plan_code: 'N4' }) })).toBeNull()
    const r = motivoQueImpideTransferir({ origen: nivel(), destino: capa() })
    expect(r?.code).toBe('otra_familia')
    expect(r?.mensaje).toContain('otro Nivel')
  })

  it('de una capacitación solo a otra capacitación', () => {
    expect(motivoQueImpideTransferir({ origen: capa(), destino: capa({ id: 'c2', plan_code: 'RDM' }) })).toBeNull()
    expect(motivoQueImpideTransferir({ origen: capa(), destino: nivel() })?.code).toBe('otra_familia')
  })

  it('las campañas cuentan como capacitación: se cruzan entre sí', () => {
    expect(motivoQueImpideTransferir({
      origen: capa({ plan_level: 'campanas', plan_code: 'TRANS' }),
      destino: capa({ id: 'c2', plan_level: 'etapa_avanzada', plan_code: 'HER' }),
    })).toBeNull()
  })

  it('el Prematrimonial no se mueve por acá, ni entrando ni saliendo', () => {
    const premat = capa({ id: 'pm', name: 'Prematrimonial', plan_code: 'PREMAT', plan_level: 'etapa_inicial' })
    expect(motivoQueImpideTransferir({ origen: capa(), destino: premat })?.code).toBe('plan_excluido')
    expect(motivoQueImpideTransferir({ origen: premat, destino: capa() })?.code).toBe('plan_excluido')
  })

  it('el selector solo ofrece la familia que corresponde', () => {
    const opciones = destinosPosibles(nivel(), [
      nivel({ id: 'a', name: 'Nivel 4 — Martes', plan_code: 'N4' }),
      capa({ id: 'b', name: 'Hebreos' }),
      capa({ id: 'c', name: 'Prematrimonial', plan_code: 'PREMAT' }),
      nivel({ id: 'd', name: 'Nivel 2 — Jueves', plan_code: 'N2' }),
    ])
    expect(opciones.map(o => o.name)).toEqual(['Nivel 2 — Jueves', 'Nivel 4 — Martes'])
  })
})

describe('familiaDelPlan', () => {
  it('N1 a N4 son niveles', () => {
    expect(familiaDelPlan('niveles', 'N1')).toBe('niveles')
  })
  it('todo lo demás es capacitación', () => {
    for (const l of ['etapa_inicial', 'etapa_intermedia', 'etapa_avanzada', 'campanas', null]) {
      expect(familiaDelPlan(l, 'X')).toBe('capacitaciones')
    }
  })
  it('Prematrimonial queda fuera, escrito como sea', () => {
    expect(familiaDelPlan('etapa_inicial', 'PREMAT')).toBe('excluido')
    expect(familiaDelPlan('etapa_inicial', 'premat')).toBe('excluido')
  })
})
