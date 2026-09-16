import { describe, it, expect } from 'vitest'
import {
  puedeCancelarse, motivoNormalizado, textoDeLaCancelacion,
  MOTIVO_MINIMO, MENSAJE_BLOQUEO_CANCELACION,
} from './cancelacion-de-beca'

const beca = (over: Partial<Parameters<typeof puedeCancelarse>[0]> = {}) => ({
  kind: 'asignada' as const, status: 'active' as const, used_count: 0, ...over,
})

describe('puedeCancelarse', () => {
  it('una beca activa y sin usar se puede cancelar', () => {
    expect(puedeCancelarse(beca())).toEqual({ ok: true })
  })

  it('una beca YA USADA no se toca', () => {
    // Cancelarla reescribiría un cobro que ya se cerró con ella.
    expect(puedeCancelarse(beca({ status: 'used' }))).toEqual({ ok: false, error: 'ya_usada' })
  })

  it('un cupón con redenciones tampoco, aunque siga activo', () => {
    // Un genérico queda 'active' mientras le quedan usos; lo que lo bloquea es
    // que alguien YA lo canjeó.
    expect(puedeCancelarse(beca({ kind: 'generica', used_count: 1 }))).toEqual({ ok: false, error: 'ya_usada' })
  })

  it('un cupón activo sin canjes sí se puede cancelar', () => {
    expect(puedeCancelarse(beca({ kind: 'generica' }))).toEqual({ ok: true })
  })

  it('una ya cancelada avisa distinto de una usada', () => {
    expect(puedeCancelarse(beca({ status: 'revoked' }))).toEqual({ ok: false, error: 'ya_cancelada' })
  })

  it('cada bloqueo tiene su mensaje', () => {
    for (const k of ['ya_usada', 'ya_cancelada'] as const) {
      expect(MENSAJE_BLOQUEO_CANCELACION[k].length).toBeGreaterThan(10)
    }
  })
})

describe('motivoNormalizado', () => {
  it('acepta un motivo de verdad y le quita los espacios sobrantes', () => {
    expect(motivoNormalizado('  se   emitió  por error ')).toBe('se emitió por error')
  })

  it('rechaza el motivo vacío o de puros espacios', () => {
    expect(motivoNormalizado('')).toBeNull()
    expect(motivoNormalizado('        ')).toBeNull()
  })

  it('rechaza un motivo demasiado corto', () => {
    // "error" dentro de seis meses no le dice nada a nadie.
    expect(motivoNormalizado('error')).toBeNull()
    expect(motivoNormalizado('x'.repeat(MOTIVO_MINIMO - 1))).toBeNull()
    expect(motivoNormalizado('x'.repeat(MOTIVO_MINIMO))).toBe('x'.repeat(MOTIVO_MINIMO))
  })

  it('el largo se mide DESPUÉS de limpiar, no antes', () => {
    // 20 espacios no son un motivo de 20 caracteres.
    expect(motivoNormalizado('  ab  ' + ' '.repeat(20))).toBeNull()
  })

  it('lo que no es texto no pasa', () => {
    expect(motivoNormalizado(null)).toBeNull()
    expect(motivoNormalizado(12345678901)).toBeNull()
    expect(motivoNormalizado({ motivo: 'se emitió por error' })).toBeNull()
  })
})

describe('textoDeLaCancelacion', () => {
  it('junta motivo, quién y cuándo', () => {
    expect(textoDeLaCancelacion({
      quien: 'TI Theos', cuando: '2026-09-16T17:00:12Z', motivo: 'Se emitió por error',
    })).toBe('Se emitió por error (TI Theos · 16 sept 2026)')
  })

  it('usa la fecha civil de Costa Rica, no la UTC', () => {
    // 2026-09-17 a las 03:00 UTC son todavía las 21:00 del 16 en Costa Rica.
    expect(textoDeLaCancelacion({
      quien: null, cuando: '2026-09-17T03:00:00Z', motivo: 'Se emitió por error',
    })).toBe('Se emitió por error (16 sept 2026)')
  })

  it('sin motivo no hay nada que mostrar', () => {
    expect(textoDeLaCancelacion({ quien: 'TI Theos', cuando: '2026-09-16T17:00:12Z', motivo: null })).toBeNull()
  })

  it('con motivo pero sin firma, muestra el motivo solo', () => {
    // Las canceladas viejas, anteriores a que se guardara quién.
    expect(textoDeLaCancelacion({ quien: null, cuando: null, motivo: 'Se emitió por error' }))
      .toBe('Se emitió por error')
  })

  it('una fecha corrupta no rompe la línea', () => {
    expect(textoDeLaCancelacion({ quien: 'TI Theos', cuando: 'ayer', motivo: 'Se emitió por error' }))
      .toBe('Se emitió por error (TI Theos)')
  })
})
