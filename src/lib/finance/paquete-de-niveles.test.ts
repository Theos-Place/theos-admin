import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cadenaDesde, admitePaquete, prepagadosDelPaquete, descripcionDelPaquete } from './paquete-de-niveles'

const base = { modalidad: 'legacy', planCode: 'N2', concept: 'matricula', status: 'pending', review_status: null }

describe('paquete de niveles (legacy, 2026-10-19)', () => {
  it('la cadena desde el nivel actual', () => {
    expect(cadenaDesde('N2')).toEqual(['N2', 'N3', 'N4'])
    expect(cadenaDesde('N4')).toEqual(['N4'])
  })

  it('solo legacy, solo matrícula pendiente, y con nivel siguiente', () => {
    expect(admitePaquete(base)).toBe(true)
    expect(admitePaquete({ ...base, modalidad: 'bloques' })).toBe(false)
    expect(admitePaquete({ ...base, concept: 'folletos' })).toBe(false)
    expect(admitePaquete({ ...base, status: 'paid' })).toBe(false)
    expect(admitePaquete({ ...base, review_status: 'en_revision' })).toBe(false)
    expect(admitePaquete({ ...base, planCode: 'N4' })).toBe(false)
  })

  it('el caso de Daniela Seas: N2+N3+N4 deja N3 y N4 prepagados', () => {
    expect(prepagadosDelPaquete('N2', ['N2', 'N3', 'N4'])).toEqual({ prepagados: ['N3', 'N4'] })
  })

  it('no se salta niveles ni empieza en otro', () => {
    expect('error' in prepagadosDelPaquete('N2', ['N2', 'N4'])).toBe(true)
    expect('error' in prepagadosDelPaquete('N2', ['N3', 'N4'])).toBe(true)
    expect('error' in prepagadosDelPaquete('N2', ['N2'])).toBe(true)
  })

  it('la descripción dice qué cubre', () => {
    expect(descripcionDelPaquete(['N2', 'N3', 'N4'])).toBe('Paquete de niveles N2 + N3 + N4 (esquema viejo)')
  })

  it('al cerrar, el sucesor legacy no cobra un nivel prepagado y la lista viaja', () => {
    const p = readFileSync('src/lib/supabase/queries/payments.ts', 'utf8')
    expect(p).toContain("if (modalidad === 'legacy') {")
    expect(p).toContain('|| yaPagaronElPar.has(memberId) || tienePrepagado(memberId)')
    expect(p).toContain('niveles_prepagados: (prepagados.get(memberId) ?? []).filter(c => c !== next),')
  })
})
