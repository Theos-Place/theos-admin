import { describe, it, expect } from 'vitest'
import { studySelectGroups, studySelectOptions } from './study-grouping'

/**
 * DIR-8 · Las campañas, separadas de las capacitaciones en los filtros.
 *
 * Pedido de Fabiola: en la lista de dirigentes, buscar «quién puede dar
 * Panorama» obligaba a pasar por encima de Transformados, Una Fe Audaz y
 * compañía, en una lista de más de treinta. Y son otra cosa: haber servido
 * en una campaña no capacita para dar un estudio.
 */
const TIPOS = [
  { code: 'N1', name: 'Nivel 1', stage: 'niveles' },
  { code: 'N2', name: 'Nivel 2', stage: 'niveles' },
  { code: 'PAN', name: 'Panorama', stage: 'intermedia' },
  { code: 'TRANS', name: 'Transformados', stage: 'campaña' },
  { code: 'UFA', name: 'Una Fe Audaz', stage: 'campaña' },
]

describe('campañas aparte', () => {
  it('las separa en dos grupos con nombre', () => {
    const g = studySelectGroups(TIPOS)
    expect(g.map(x => x.titulo)).toEqual(['Capacitaciones', 'Campañas'])
  })

  it('Transformados y Una Fe Audaz caen en Campañas', () => {
    const campanas = studySelectGroups(TIPOS).find(g => g.titulo === 'Campañas')!
    expect(campanas.opciones.map(o => o.value).sort()).toEqual(['TRANS', 'UFA'])
  })

  it('Panorama NO es campaña', () => {
    const caps = studySelectGroups(TIPOS).find(g => g.titulo === 'Capacitaciones')!
    expect(caps.opciones.map(o => o.value)).toContain('PAN')
  })

  it('los grupos de niveles y discípulos siguen en capacitaciones', () => {
    // Una opción de GRUPO agrupa códigos curriculares: nunca es campaña.
    const caps = studySelectGroups(TIPOS).find(g => g.titulo === 'Capacitaciones')!
    expect(caps.opciones.map(o => o.value)).toContain('GRP:niveles')
  })

  it('no se pierde ni se duplica ninguna opción', () => {
    // La suma de los dos grupos es exactamente la lista plana.
    const planas = studySelectOptions(TIPOS).map(o => o.value).sort()
    const agrupadas = studySelectGroups(TIPOS).flatMap(g => g.opciones.map(o => o.value)).sort()
    expect(agrupadas).toEqual(planas)
  })

  it('sin campañas, no devuelve un grupo vacío', () => {
    // Un optgroup sin opciones se ve como un encabezado que no hace nada.
    const g = studySelectGroups([{ code: 'PAN', name: 'Panorama', stage: 'intermedia' }])
    expect(g.map(x => x.titulo)).toEqual(['Capacitaciones'])
  })

  it('sin `stage` nada es campaña: no se adivina por el nombre', () => {
    const g = studySelectGroups([{ code: 'TRANS', name: 'Transformados' }])
    expect(g.map(x => x.titulo)).toEqual(['Capacitaciones'])
  })
})
