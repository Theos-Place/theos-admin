import { describe, it, expect } from 'vitest'
import {
  ordenarCierres, prioridad, resumenDeCierres, etiquetaDeCompromiso, etiquetaDePlan,
  type CierreEnLista,
} from './cierres-prematrimoniales'

const c = (o: Partial<CierreEnLista> & { id: string }): CierreEnLista => ({
  pareja: 'Fulano y Fulana', grupo: 'Premat', mentores: 'Mentores',
  fecha: '2026-10-01', commitment: 'si', action_plan: 'listos',
  temas: 0, tiene_punto_ciego: false, ...o,
})

describe('orden: lo que pide acción va primero', () => {
  it('posponer antes que consejería, y consejería antes que listos', () => {
    // Posponer primero porque hay una fecha de boda de por medio.
    expect(prioridad({ action_plan: 'posponer' })).toBeLessThan(prioridad({ action_plan: 'consejeria' }))
    expect(prioridad({ action_plan: 'consejeria' })).toBeLessThan(prioridad({ action_plan: 'listos' }))
  })

  it('ordena una mezcla real', () => {
    const orden = ordenarCierres([
      c({ id: 'listo', action_plan: 'listos' }),
      c({ id: 'posponer', action_plan: 'posponer' }),
      c({ id: 'consejeria', action_plan: 'consejeria' }),
    ]).map(x => x.id)
    expect(orden).toEqual(['posponer', 'consejeria', 'listo'])
  })

  it('dentro del mismo plan, el más reciente primero', () => {
    const orden = ordenarCierres([
      c({ id: 'viejo', fecha: '2026-01-01' }),
      c({ id: 'nuevo', fecha: '2026-10-01' }),
    ]).map(x => x.id)
    expect(orden).toEqual(['nuevo', 'viejo'])
  })

  it('un plan desconocido NO se trata como listo', () => {
    // `needsFollowUp` es todo lo que no sea 'listos': una opción nueva
    // nace pidiendo atención, no pasando desapercibida.
    expect(prioridad({ action_plan: 'algo_nuevo' })).toBeLessThan(prioridad({ action_plan: 'listos' }))
  })
})

describe('resumen', () => {
  it('separa listos de los que siguen en seguimiento', () => {
    const r = resumenDeCierres([
      c({ id: '1', action_plan: 'listos' }),
      c({ id: '2', action_plan: 'consejeria' }),
      c({ id: '3', action_plan: 'posponer', tiene_punto_ciego: true }),
    ])
    expect(r).toEqual({ total: 3, listos: 1, enSeguimiento: 2, conPuntoCiego: 1 })
  })

  it('sin cierres no se cae ni inventa', () => {
    expect(resumenDeCierres([])).toEqual({ total: 0, listos: 0, enSeguimiento: 0, conPuntoCiego: 0 })
  })
})

describe('etiquetas', () => {
  it('usa el texto del catálogo', () => {
    expect(etiquetaDeCompromiso('en_proceso')).toBe('En proceso')
    expect(etiquetaDePlan('listos')).toBe('Listos para el matrimonio (cierre regular)')
  })

  it('un valor fuera del catálogo se muestra crudo, no vacío', () => {
    // Mejor un código a la vista que una celda en blanco que nadie explica.
    expect(etiquetaDeCompromiso('xyz')).toBe('xyz')
    expect(etiquetaDePlan('xyz')).toBe('xyz')
  })
})
