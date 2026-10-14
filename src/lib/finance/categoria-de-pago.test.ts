import { describe, it, expect } from 'vitest'
import {
  categoriaDePago, claveDeCategoria, etiquetaDeCategoria, cumpleFiltroDeCategoria, fechaDelPago, enRango,
} from './categoria-de-pago'

describe('REP-17 · categoría de un pago', () => {
  it('matrícula de N1–N4 es Estudios · Niveles (por código o por level)', () => {
    expect(categoriaDePago({ concept: 'matricula', plan_code: 'N3' })).toEqual({ area: 'estudios', categoria: 'niveles' })
    expect(categoriaDePago({ concept: 'matricula', plan_code: 'XX', plan_level: 'niveles' })).toEqual({ area: 'estudios', categoria: 'niveles' })
  })

  it('DIS1–DIS3 son Discípulos; el resto de planes, Capacitaciones', () => {
    expect(categoriaDePago({ concept: 'matricula', plan_code: 'DIS2' }).categoria).toBe('discipulos')
    expect(categoriaDePago({ concept: 'matricula', plan_code: 'HER', plan_level: 'etapa_avanzada' }).categoria).toBe('capacitaciones')
    expect(categoriaDePago({ concept: 'matricula', plan_code: 'SCJ', plan_level: 'etapa_inicial' }).categoria).toBe('capacitaciones')
  })

  it('prematrimonial va aparte dentro de Estudios', () => {
    expect(categoriaDePago({ concept: 'prematrimonial' })).toEqual({ area: 'estudios', categoria: 'prematrimonial' })
  })

  it('los folletos van con SU estudio, no en una categoría aparte', () => {
    // El caso real: los folletos de un N2 son plata de Niveles.
    expect(categoriaDePago({ concept: 'folletos', entity_type: 'study_group', plan_code: 'N2', plan_level: 'niveles' })).toEqual({ area: 'estudios', categoria: 'niveles' })
    expect(categoriaDePago({ concept: 'folletos', plan_code: 'HER', plan_level: 'etapa_avanzada' }).categoria).toBe('capacitaciones')
    // Sin grupo no se esconde: se dice.
    expect(categoriaDePago({ concept: 'folletos' })).toEqual({ area: 'estudios', categoria: 'folletos-sin-estudio' })
  })

  it('un evento se ubica por su TIPO; sin tipo, queda dicho', () => {
    expect(categoriaDePago({ concept: 'evento', event_type: 'sports' })).toEqual({ area: 'eventos', categoria: 'sports' })
    expect(categoriaDePago({ entity_type: 'event', event_type: null }).categoria).toBe('sin-tipo')
  })

  it('un cobro sin concepto ni entidad es Otros', () => {
    expect(categoriaDePago({})).toEqual({ area: 'otro', categoria: 'otro' })
  })

  it('la etiqueta usa el catálogo de tipos para eventos', () => {
    expect(etiquetaDeCategoria({ area: 'estudios', categoria: 'niveles' })).toBe('Estudios · Niveles')
    expect(etiquetaDeCategoria({ area: 'eventos', categoria: 'ayuda-social' }, s => (s === 'ayuda-social' ? 'Ayuda Social' : s))).toBe('Eventos · Ayuda Social')
    // Sin catálogo no se inventa: va el slug.
    expect(etiquetaDeCategoria({ area: 'eventos', categoria: 'sports' })).toBe('Eventos · sports')
  })
})

describe('REP-17 · filtro y rango', () => {
  const sports = { area: 'eventos' as const, categoria: 'sports' }

  it("'all' deja pasar todo; un área deja pasar sus categorías; una clave, solo esa", () => {
    expect(cumpleFiltroDeCategoria(sports, 'all')).toBe(true)
    expect(cumpleFiltroDeCategoria(sports, 'eventos')).toBe(true)
    expect(cumpleFiltroDeCategoria(sports, 'estudios')).toBe(false)
    expect(cumpleFiltroDeCategoria(sports, claveDeCategoria(sports))).toBe(true)
    expect(cumpleFiltroDeCategoria(sports, 'eventos:taller')).toBe(false)
  })

  it('un pago cancelado se fecha por paid_at; lo demás por created_at', () => {
    expect(fechaDelPago({ status: 'paid', paid_at: '2026-10-03T15:00:00Z', created_at: '2026-09-01T00:00:00Z' })).toBe('2026-10-03')
    expect(fechaDelPago({ status: 'pending', paid_at: null, created_at: '2026-09-01T00:00:00Z' })).toBe('2026-09-01')
    // Pagado sin paid_at (histórico): cae a created_at, no se pierde.
    expect(fechaDelPago({ status: 'paid', paid_at: null, created_at: '2026-09-01T00:00:00Z' })).toBe('2026-09-01')
  })

  it('el rango es inclusivo y cada lado es opcional', () => {
    expect(enRango('2026-10-01', '2026-10-01', '2026-10-31')).toBe(true)
    expect(enRango('2026-10-31', '2026-10-01', '2026-10-31')).toBe(true)
    expect(enRango('2026-11-01', '2026-10-01', '2026-10-31')).toBe(false)
    expect(enRango('2020-01-01', '', '2026-10-31')).toBe(true)
    expect(enRango('2030-01-01', '2026-10-01', '')).toBe(true)
  })
})
