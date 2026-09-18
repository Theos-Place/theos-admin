import { describe, it, expect } from 'vitest'
import {
  scholarshipActionSchema, scholarshipMoveSchema, scholarshipCancelSchema,
  couponCreateSchema, idDelDestino,
} from './schema'
import { MOTIVO_MINIMO } from '@/lib/finance/cancelacion-de-beca'

const PLAN = '11111111-1111-4111-8111-111111111111'
const EVENTO = '22222222-2222-4222-8222-222222222222'

describe('scholarshipActionSchema', () => {
  it('acepta las dos acciones', () => {
    expect(scholarshipActionSchema.safeParse({ action: 'mover' }).success).toBe(true)
    expect(scholarshipActionSchema.safeParse({ action: 'cancelar' }).success).toBe(true)
  })

  it('rechaza cualquier otra, y también un body vacío o nulo', () => {
    for (const body of [{ action: 'borrar' }, {}, null, 'texto']) {
      expect(scholarshipActionSchema.safeParse(body).success, JSON.stringify(body)).toBe(false)
    }
  })
})

describe('mover', () => {
  it('EL BODY QUE MANDA LA PANTALLA pasa tal cual', () => {
    // BecasAsignadasTab manda SIEMPRE las dos claves, una en null. Si el
    // esquema no lo contemplara, mover una beca se caería con 400 en producción
    // y los tests de acá arriba no lo notarían.
    const r = scholarshipMoveSchema.safeParse({
      action: 'mover', entity_type: 'study_plan',
      plan_id: PLAN, event_id: null, motivo: 'el grupo se llenó', notificar: true,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(idDelDestino(r.data)).toBe(PLAN)
  })

  it('a un evento, con plan_id en null', () => {
    const r = scholarshipMoveSchema.safeParse({
      action: 'mover', entity_type: 'event', plan_id: null, event_id: EVENTO, motivo: null, notificar: false,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(idDelDestino(r.data)).toBe(EVENTO)
      expect(r.data.notificar).toBe(false)
    }
  })

  it('por omisión SÍ notifica', () => {
    const r = scholarshipMoveSchema.safeParse({ action: 'mover', entity_type: 'study_plan', plan_id: PLAN })
    expect(r.success && r.data.notificar).toBe(true)
  })

  it('EL AGUJERO DE LA VERSIÓN VIEJA: tipo evento con id de plan', () => {
    // Antes se elegía a mano `entity_type === 'study_plan' ? plan_id : event_id`,
    // así que este body pasaba la validación con event_id undefined y el plan se
    // ignoraba en silencio. Ahora falta el destino y se rechaza.
    expect(scholarshipMoveSchema.safeParse({
      action: 'mover', entity_type: 'event', plan_id: PLAN,
    }).success).toBe(false)
  })

  it('destino que no es uuid, o tipo desconocido', () => {
    expect(scholarshipMoveSchema.safeParse({ action: 'mover', entity_type: 'study_plan', plan_id: 'abc' }).success).toBe(false)
    expect(scholarshipMoveSchema.safeParse({ action: 'mover', entity_type: 'grupo', plan_id: PLAN }).success).toBe(false)
    expect(scholarshipMoveSchema.safeParse({ action: 'mover' }).success).toBe(false)
  })
})

describe('cancelar', () => {
  it('el motivo se normaliza: se recortan espacios y se colapsan los dobles', () => {
    const r = scholarshipCancelSchema.safeParse({ motivo: '  ya  no  lo necesita  ' })
    expect(r.success && r.data.motivo).toBe('ya no lo necesita')
  })

  it(`un motivo de menos de ${MOTIVO_MINIMO} caracteres no pasa`, () => {
    expect(scholarshipCancelSchema.safeParse({ motivo: 'no' }).success).toBe(false)
    // Y los espacios no cuentan para llegar al mínimo.
    expect(scholarshipCancelSchema.safeParse({ motivo: '  a  b  ' }).success).toBe(false)
  })

  it('sin motivo, o con un motivo que no es texto', () => {
    for (const m of [undefined, null, 42, { texto: 'largo y detallado' }]) {
      expect(scholarshipCancelSchema.safeParse({ motivo: m }).success, String(m)).toBe(false)
    }
  })
})

describe('cupón genérico', () => {
  const BASE = {
    entity_type: 'study_plan' as const, plan_id: PLAN, event_id: null,
    discount_type: 'percentage' as const, discount_value: 50,
    code: 'verano2026', expires_at: '2026-12-31T00:00:00.000Z',
  }

  it('EL BODY QUE MANDA LA PANTALLA pasa tal cual', () => {
    expect(couponCreateSchema.safeParse(BASE).success).toBe(true)
  })

  it('el código se guarda en MAYÚSCULAS y sin espacios', () => {
    const r = couponCreateSchema.safeParse({ ...BASE, code: '  verano2026 ' })
    expect(r.success && r.data.code).toBe('VERANO2026')
  })

  it('el monto puede venir como texto: lo mandaba así un input', () => {
    // Lo hacía el `Number(...)` de la versión vieja. Quitarlo habría roto el
    // formulario sin que ningún test lo dijera.
    const r = couponCreateSchema.safeParse({ ...BASE, discount_value: '2500' })
    expect(r.success && r.data.discount_value).toBe(2500)
  })

  it('un descuento de 0 o negativo no es un descuento', () => {
    expect(couponCreateSchema.safeParse({ ...BASE, discount_value: 0 }).success).toBe(false)
    expect(couponCreateSchema.safeParse({ ...BASE, discount_value: -5 }).success).toBe(false)
    expect(couponCreateSchema.safeParse({ ...BASE, discount_value: 'gratis' }).success).toBe(false)
  })

  it('el vencimiento es OBLIGATORIO: sin él, el cupón queda vivo para siempre', () => {
    expect(couponCreateSchema.safeParse({ ...BASE, expires_at: '' }).success).toBe(false)
    const { expires_at, ...sinFecha } = BASE
    void expires_at
    expect(couponCreateSchema.safeParse(sinFecha).success).toBe(false)
  })

  it('código vacío, tipo de descuento inventado', () => {
    expect(couponCreateSchema.safeParse({ ...BASE, code: '   ' }).success).toBe(false)
    expect(couponCreateSchema.safeParse({ ...BASE, discount_type: 'regalo' }).success).toBe(false)
  })

  it('REPORTA TODOS LOS ERRORES JUNTOS, que es el punto de migrar a zod', () => {
    // Con los `if`s encadenados el handler contestaba solo el primero, así que
    // quien llenaba mal tres campos los descubría de a uno.
    const r = couponCreateSchema.safeParse({
      ...BASE, discount_type: 'regalo', discount_value: -1, code: '', expires_at: '',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const campos = new Set(r.error.issues.map(i => i.path.join('.')))
      expect(campos).toContain('discount_type')
      expect(campos).toContain('discount_value')
      expect(campos).toContain('code')
      expect(campos).toContain('expires_at')
    }
  })
})
