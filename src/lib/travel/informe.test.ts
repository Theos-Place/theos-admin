import { describe, it, expect } from 'vitest'
import {
  revisarInforme, informeEstaCompleto, avisarQueFaltaInforme, CAMPOS_DEL_INFORME,
  sePuedeInformar,
  type Informe,
} from './informe'

const informe = (over: Partial<Informe> = {}): Informe => ({
  actividades: 'Tres días de reuniones con la sede.',
  resultados: 'Quedó el plan de trabajo del cuatrimestre.',
  lecciones: null, recomendaciones: null, ...over,
})

describe('FIN-11 · qué se exige del informe', () => {
  it('con actividades y resultados, está completo', () => {
    expect(revisarInforme(informe())).toEqual([])
    expect(informeEstaCompleto(informe())).toBe(true)
  })

  it('falta decir qué se hizo', () => {
    expect(revisarInforme(informe({ actividades: '  ' }))[0].campo).toBe('actividades')
  })

  it('falta decir qué resultó', () => {
    expect(revisarInforme(informe({ resultados: null }))[0].campo).toBe('resultados')
  })

  it('LECCIONES Y RECOMENDACIONES NO SON OBLIGATORIAS, a propósito', () => {
    // Exigirlas lleva a que la gente escriba «ninguna» para poder seguir, y
    // un «ninguna» parece una respuesta cuando no lo es.
    expect(informeEstaCompleto(informe({ lecciones: null, recomendaciones: null }))).toBe(true)
    expect(CAMPOS_DEL_INFORME.filter(c => c.obligatorio).map(c => c.campo))
      .toEqual(['actividades', 'resultados'])
  })

  it('un informe vacío reporta los dos que faltan', () => {
    const p = revisarInforme({ actividades: null, resultados: null, lecciones: null, recomendaciones: null })
    expect(p.map(x => x.campo)).toEqual(['actividades', 'resultados'])
  })
})

describe('FIN-11 · el informe NO bloquea', () => {
  it('sin informe, cerrar avisa pero no impide', () => {
    // La plata y el reporte son dos trámites distintos: retener el reembolso
    // de alguien hasta que escriba un texto es una sanción que el reglamento
    // no pide. Lo que sí tiene que pasar es que quien cierra lo vea.
    const vacio = { actividades: null, resultados: null, lecciones: null, recomendaciones: null }
    expect(avisarQueFaltaInforme(vacio, true)).toContain('Se puede cerrar igual')
  })

  it('con informe completo, no avisa nada', () => {
    expect(avisarQueFaltaInforme(informe(), true)).toBeNull()
  })

  it('y fuera del cierre no molesta', () => {
    const vacio = { actividades: null, resultados: null, lecciones: null, recomendaciones: null }
    expect(avisarQueFaltaInforme(vacio, false)).toBeNull()
  })
})

describe('FIN-11 · los cuatro campos del anexo', () => {
  it('están los cuatro y en su orden', () => {
    expect(CAMPOS_DEL_INFORME.map(c => c.campo))
      .toEqual(['actividades', 'resultados', 'lecciones', 'recomendaciones'])
  })

  it('cada uno tiene etiqueta', () => {
    for (const c of CAMPOS_DEL_INFORME) expect(c.etiqueta).toBeTruthy()
  })
})

describe('FIN-11 · cuándo se puede informar', () => {
  it('desde que el viaje se aprueba', () => {
    // La gente arma el informe durante el viaje, no al final.
    for (const e of ['aprobada', 'anticipo_entregado', 'liquidacion_pendiente', 'liquidada']) {
      expect(sePuedeInformar(e), e).toBe(true)
    }
  })

  it('NO antes: no hay viaje del cual informar', () => {
    for (const e of ['borrador', 'enviada', 'en_revision', 'por_corregir']) {
      expect(sePuedeInformar(e), e).toBe(false)
    }
  })

  it('ni después de cerrado o rechazado', () => {
    for (const e of ['cerrada', 'rechazada', 'cancelada']) {
      expect(sePuedeInformar(e), e).toBe(false)
    }
  })
})
