import { describe, it, expect } from 'vitest'
import { revisarReferencia, tieneReferenciaComparable, type PagoConReferencia } from './referencia-repetida'

const p = (over: Partial<PagoConReferencia> = {}): PagoConReferencia => ({
  id: 'p1', member_id: 'ana', amount: 5000, status: 'paid', review_status: 'aprobado',
  descripcion: 'Matrícula · SCJ', creado: '2026-08-31T21:49:00Z', ...over,
})

describe('revisarReferencia', () => {
  it('el caso de Adriana: la misma persona subiendo el mismo comprobante otra vez', () => {
    const v = revisarReferencia({ member_id: 'ana', amount: 5000 }, [p()])
    expect(v.nivel).toBe('bloqueo')
    if (v.nivel === 'bloqueo') {
      expect(v.mensaje).toContain('₡5.000')
      expect(v.mensaje).toContain('31 de agosto')
      expect(v.pagoExistente).toBe('p1')
    }
  })

  it('bloquea aunque el monto sea distinto: la referencia es de UNA transferencia', () => {
    expect(revisarReferencia({ member_id: 'ana', amount: 20000 }, [p()]).nivel).toBe('bloqueo')
  })

  it('una familia pagando junta NO se bloquea: es una transferencia para varios', () => {
    // Caso real: Diana Tseng, Lin Ta Hsiang y Roy Muñoz, ₡15.000 en un SINPE.
    const v = revisarReferencia({ member_id: 'roy', amount: 5000 }, [
      p({ id: 'a', member_id: 'diana' }), p({ id: 'b', member_id: 'lin' }),
    ])
    expect(v.nivel).toBe('aviso')
    if (v.nivel === 'aviso') expect(v.mensaje).toContain('pagando juntos')
  })

  it('una referencia libre no molesta a nadie', () => {
    expect(revisarReferencia({ member_id: 'ana', amount: 5000 }, [])).toEqual({ nivel: 'ninguno' })
  })

  it('un pago RECHAZADO no bloquea: volver a subir el comprobante es lo correcto', () => {
    expect(revisarReferencia({ member_id: 'ana', amount: 5000 }, [p({ review_status: 'rechazado' })]))
      .toEqual({ nivel: 'ninguno' })
  })

  it('ni uno cancelado', () => {
    expect(revisarReferencia({ member_id: 'ana', amount: 5000 }, [p({ status: 'cancelado' })]))
      .toEqual({ nivel: 'ninguno' })
  })

  it('un pendiente de la misma persona SÍ bloquea: ya está esa plata contada', () => {
    expect(revisarReferencia({ member_id: 'ana', amount: 5000 }, [p({ status: 'pending', review_status: 'en_revision' })]).nivel)
      .toBe('bloqueo')
  })

  it('el mensaje dice qué hacer, no solo que no se puede', () => {
    const v = revisarReferencia({ member_id: 'ana', amount: 5000 }, [p()])
    if (v.nivel === 'bloqueo') expect(v.mensaje).toContain('usá el número de referencia de esa otra')
  })
})

describe('tieneReferenciaComparable', () => {
  it('sin referencia no hay nada que comparar', () => {
    expect(tieneReferenciaComparable(null)).toBe(false)
    expect(tieneReferenciaComparable('')).toBe(false)
    expect(tieneReferenciaComparable('123')).toBe(false)
  })
  it('una referencia de verdad sí', () => {
    expect(tieneReferenciaComparable('2026083110284000493809137')).toBe(true)
  })
})
