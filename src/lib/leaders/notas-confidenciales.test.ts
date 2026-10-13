import { describe, it, expect } from 'vitest'
import {
  puedeLeerNotas, puedeEscribirNotas, puedeVerBanderita, sinNotas, CAMPOS_DE_NOTA,
} from './notas-confidenciales'

describe('DIR-8 · quién ESCRIBE las notas', () => {
  it('coordinación de dirigentes, sí', () => {
    expect(puedeEscribirNotas(['coordinador_dirigentes'])).toBe(true)
  })

  it('admin también: es quien repara cuando algo se rompe', () => {
    expect(puedeEscribirNotas(['admin'])).toBe(true)
  })

  it('el LECTOR no escribe: para eso es lector', () => {
    expect(puedeEscribirNotas(['lector_dirigentes'])).toBe(false)
    expect(puedeLeerNotas(['lector_dirigentes'])).toBe(true)
  })

  it('`editor_dirigentes` NO, ni lee ni escribe', () => {
    // Es la distinción que justifica que existan dos roles: actualiza datos
    // del dirigente todos los días y las notas no son datos operativos.
    expect(puedeEscribirNotas(['editor_dirigentes'])).toBe(false)
    expect(puedeLeerNotas(['editor_dirigentes'])).toBe(false)
  })

  it('dirección y coordinación de estudios tampoco, aunque tengan el módulo', () => {
    // Decisión explícita de Floriana el 2026-10-12: exclusivo por ahora. Se
    // nombran roles en vez de heredar privilegio, igual que en DIR-5/DIR-6.
    for (const r of ['direccion', 'coordinador_estudios', 'solo_lectura', 'reportes']) {
      expect(puedeLeerNotas([r]), r).toBe(false)
    }
  })

  it('el dirigente NUNCA ve sus notas', () => {
    expect(puedeLeerNotas(['dirigente'])).toBe(false)
    expect(puedeLeerNotas([])).toBe(false)
    expect(puedeLeerNotas(null)).toBe(false)
  })
})

describe('DIR-8 · las notas no VIAJAN a quien no puede leerlas', () => {
  const ficha = {
    id: 'x',
    nota_revision: 'situación abierta',
    nota_cdeb: 'está llevando cursos',
    nota_decision_propia: 'no quiere por ahora',
    nota_pausa: 'viaje largo',
    nota_general: 'caso sensible',
  }

  it('a quien no puede, le llega la ficha SIN los campos', () => {
    // Se sanea el payload y no solo la pantalla: un campo que llega al
    // navegador es visible aunque no se pinte, y acá dice por qué alguien
    // está en revisión.
    const vista = sinNotas(ficha, ['editor_dirigentes'])
    for (const c of CAMPOS_DE_NOTA) {
      expect(c in vista, `${c} no debería viajar`).toBe(false)
    }
    expect(vista.id).toBe('x')
  })

  it('a quien sí puede, le llegan completas', () => {
    expect(sinNotas(ficha, ['lector_dirigentes']).nota_general).toBe('caso sensible')
  })

  it('no muta el objeto original', () => {
    const copia = { ...ficha }
    sinNotas(ficha, ['dirigente'])
    expect(ficha).toEqual(copia)
  })
})

describe('DIR-8 · la banderita va con las notas', () => {
  it('la ve quien lee notas, y nadie más', () => {
    // Dice que hay una situación abierta con una persona, así que es del
    // mismo orden que la nota, no del estado operativo.
    expect(puedeVerBanderita(['coordinador_dirigentes'])).toBe(true)
    expect(puedeVerBanderita(['lector_dirigentes'])).toBe(true)
    expect(puedeVerBanderita(['editor_dirigentes'])).toBe(false)
    expect(puedeVerBanderita(['direccion'])).toBe(false)
  })
})
