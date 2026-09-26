import { describe, it, expect } from 'vitest'
import {
  planDePublicacion, cicloDe, textoDeConfirmacion, hayAlgoQuePublicar,
  ESTADO_PUBLICADO, ESTADO_DESACTIVADO,
} from './publicacion-mensual'

const AHORA = new Date('2026-10-02T12:00:00Z')
const v = (id: string, status: string, published_at: string | null = null) => ({ id, status, published_at })

describe('qué sube y qué baja', () => {
  it('sube lo que pidieron los comités', () => {
    const plan = planDePublicacion([v('a', 'creado'), v('b', 'enviado_lider')], AHORA)
    expect(plan.aPublicar).toEqual(['a', 'b'])
    expect(plan.aDesactivar).toEqual([])
  })

  it('baja lo publicado del mes PASADO', () => {
    const plan = planDePublicacion([v('vieja', ESTADO_PUBLICADO, '2026-09-02T00:00:00Z')], AHORA)
    expect(plan.aDesactivar).toEqual(['vieja'])
  })

  it('NO baja lo que se publicó este mismo mes: publicar dos veces no vacía la página', () => {
    // Un doble clic vaciaría la página pública si el ciclo no fuera el mes.
    const plan = planDePublicacion([v('nueva', ESTADO_PUBLICADO, '2026-10-01T00:00:00Z')], AHORA)
    expect(plan.aDesactivar).toEqual([])
    expect(hayAlgoQuePublicar(plan)).toBe(false)
  })

  it('una publicada SIN fecha se baja: es un dato inconsistente', () => {
    // Alguien la aprobó a mano sin publicarla. Bajarla es recuperable;
    // dejarla colgada para siempre no se nota.
    expect(planDePublicacion([v('huerfana', ESTADO_PUBLICADO, null)], AHORA).aDesactivar)
      .toEqual(['huerfana'])
  })

  it('no toca lo denegado ni lo ya cerrado', () => {
    const plan = planDePublicacion([
      v('no', 'denegado'), v('fin', ESTADO_DESACTIVADO, '2026-08-01T00:00:00Z'),
    ], AHORA)
    expect(plan).toEqual({ aPublicar: [], aDesactivar: [] })
  })

  it('cruza el año: diciembre es «el mes pasado» de enero', () => {
    const enero = new Date('2027-01-03T12:00:00Z')
    expect(planDePublicacion([v('dic', ESTADO_PUBLICADO, '2026-12-02T00:00:00Z')], enero).aDesactivar)
      .toEqual(['dic'])
  })

  it('una tanda mezclada se reparte bien', () => {
    const plan = planDePublicacion([
      v('a', 'creado'),
      v('b', ESTADO_PUBLICADO, '2026-09-02T00:00:00Z'),
      v('c', ESTADO_PUBLICADO, '2026-10-01T00:00:00Z'),
      v('d', 'denegado'),
    ], AHORA)
    expect(plan.aPublicar).toEqual(['a'])
    expect(plan.aDesactivar).toEqual(['b'])
  })
})

describe('cicloDe', () => {
  it('es el mes calendario', () => {
    expect(cicloDe('2026-10-02T00:00:00Z')).toBe('2026-10')
    expect(cicloDe(null)).toBeNull()
    expect(cicloDe('ayer')).toBeNull()
  })
})

describe('la confirmación dice los DOS números', () => {
  it('«publicar» suena a agregar, y además baja lo vigente', () => {
    const t = textoDeConfirmacion({ aPublicar: ['a', 'b'], aDesactivar: ['x'] })
    expect(t).toContain('2 puestos')
    expect(t).toContain('bajar el 1')
    expect(t).toContain('NO se borran')
  })

  it('sin nada que bajar, no habla de bajar', () => {
    const t = textoDeConfirmacion({ aPublicar: ['a'], aDesactivar: [] })
    expect(t).toBe('Se va a publicar 1 puesto.')
  })
})
