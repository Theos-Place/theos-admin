import { describe, it, expect } from 'vitest'
import { estudioQueAbrir, elGrupoYaNoEsta, type EstudioConGrupos } from './grupo-preseleccionado'

const RESULTADOS: EstudioConGrupos[] = [
  { study_code: 'N1', available_groups: [{ group_id: 'g-escazu' }, { group_id: 'g-cartago' }] },
  { study_code: 'SCJ', available_groups: [{ group_id: 'g-scj' }] },
]

describe('EST-20 · llegar con un grupo ya elegido', () => {
  it('abre el estudio que contiene ese grupo', () => {
    expect(estudioQueAbrir(RESULTADOS, 'g-cartago')).toBe('N1')
    expect(estudioQueAbrir(RESULTADOS, 'g-scj')).toBe('SCJ')
  })

  it('sin grupo en el enlace, no abre nada', () => {
    expect(estudioQueAbrir(RESULTADOS, null)).toBeNull()
    expect(estudioQueAbrir(RESULTADOS, '')).toBeNull()
  })

  it('un grupo que ya no está disponible no abre nada', () => {
    // Se llenó entre que la persona vio la página pública y volvió del
    // login. Forzar un estudio la dejaría mirando una lista sin su grupo.
    expect(estudioQueAbrir(RESULTADOS, 'g-que-se-lleno')).toBeNull()
  })
})

describe('cuándo se avisa que el grupo ya no está', () => {
  it('cuando los resultados llegaron y el grupo no aparece', () => {
    expect(elGrupoYaNoEsta({
      grupoId: 'g-que-se-lleno', resultadosCargados: true, resultados: RESULTADOS,
    })).toBe(true)
  })

  it('NO mientras los resultados todavía no llegan', () => {
    // Antes de cargar, «no está» significa «todavía no sé». Avisar ahí
    // mostraría el error un instante en cada visita legítima.
    expect(elGrupoYaNoEsta({
      grupoId: 'g-escazu', resultadosCargados: false, resultados: [],
    })).toBe(false)
  })

  it('NO si el grupo sí está', () => {
    expect(elGrupoYaNoEsta({
      grupoId: 'g-escazu', resultadosCargados: true, resultados: RESULTADOS,
    })).toBe(false)
  })

  it('NO si nadie venía con un grupo', () => {
    expect(elGrupoYaNoEsta({
      grupoId: null, resultadosCargados: true, resultados: RESULTADOS,
    })).toBe(false)
  })
})
