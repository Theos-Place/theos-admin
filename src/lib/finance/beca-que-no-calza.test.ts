import { describe, it, expect } from 'vitest'
import { avisoDeBecaQueNoCalza } from './beca-que-no-calza'

describe('cuando hay beca pero no calza', () => {
  it('EL CASO DE WILLIAM: dice PARA QUÉ es la beca', () => {
    /**
     * El modal decía «no tiene una beca asignada para este cobro». Era verdad
     * y era inútil: le habían aprobado una el 30 de setiembre, para Nivel 3,
     * y el cobro era de Nivel 2. Floriana tuvo que preguntar.
     */
    const t = avisoDeBecaQueNoCalza([{ destino: 'Nivel 3', entity_type: 'study_plan' }])!
    expect(t).toContain('Nivel 3')
    expect(t).toContain('beca aprobada')
  })

  it('explica la regla, no solo el hecho', () => {
    // Sin el porqué, se lee como que el sistema falló.
    const t = avisoDeBecaQueNoCalza([{ destino: 'Nivel 3', entity_type: 'study_plan' }])!
    expect(t).toContain('solo al estudio o la actividad para la que se aprobó')
  })

  it('con varias, las nombra todas', () => {
    const t = avisoDeBecaQueNoCalza([
      { destino: 'Nivel 3', entity_type: 'study_plan' },
      { destino: 'Campa de Servidores', entity_type: 'event' },
    ])!
    expect(t).toContain('Nivel 3')
    expect(t).toContain('Campa de Servidores')
  })

  it('no repite un destino que aparece dos veces', () => {
    const t = avisoDeBecaQueNoCalza([
      { destino: 'Nivel 3', entity_type: 'study_plan' },
      { destino: 'Nivel 3', entity_type: 'study_plan' },
    ])!
    expect(t.match(/Nivel 3/g)).toHaveLength(1)
  })

  it('sin becas devuelve null: ahí el mensaje de siempre está bien', () => {
    expect(avisoDeBecaQueNoCalza([])).toBeNull()
  })

  it('y una beca sin destino legible tampoco inventa un aviso', () => {
    // «Tiene una beca para  » es peor que no decir nada.
    expect(avisoDeBecaQueNoCalza([{ destino: null, entity_type: 'study_plan' }])).toBeNull()
    expect(avisoDeBecaQueNoCalza([{ destino: '   ', entity_type: null }])).toBeNull()
  })
})
