import { describe, it, expect } from 'vitest'
import { esPuestoDeEncargado, encargadosDelComite, planDeEncargado } from './encargados'

describe('esPuestoDeEncargado', () => {
  it('reconoce los títulos reales del catálogo', () => {
    for (const t of [
      'Encargado', 'Encargado Comité', 'Encargado de comité', 'Encargado Comite',
      'Encargado Dirigentes', 'Encargado Oración', 'Encargado Worship', 'Encargado Sede',
    ]) expect(esPuestoDeEncargado(t), t).toBe(true)
  })

  it('"Encargado Logística" no es la cabeza: es operación de la sede', () => {
    expect(esPuestoDeEncargado('Encargado Logística')).toBe(false)
    expect(esPuestoDeEncargado('Encargado de Logistica')).toBe(false)
  })

  it('"Asistente de Encargado" tampoco', () => {
    expect(esPuestoDeEncargado('Asistente de Encargado')).toBe(false)
    expect(esPuestoDeEncargado('Asistente Encargado')).toBe(false)
  })

  it('no confunde puestos que apenas contienen la palabra', () => {
    for (const t of ['Colaborador', 'Teacher', 'Orador Sede', 'Coordinador Bienvenida'])
      expect(esPuestoDeEncargado(t), t).toBe(false)
  })

  it('ignora acentos, mayúsculas y artículos', () => {
    expect(esPuestoDeEncargado('  ENCARGADO DE COMITÉ ')).toBe(true)
  })
})

describe('encargadosDelComite', () => {
  const p = (title: string, member_id: string, status = 'active') => ({ title, member_id, status })

  it('admite varios encargados en el mismo comité', () => {
    // Comité Matrimonios tiene 4 en producción.
    expect(encargadosDelComite([
      p('Encargado Comité', 'a'), p('Encargado Comité', 'b'),
      p('Colaborador', 'c'),
    ])).toEqual(['a', 'b'])
  })

  it('no repite a quien tiene dos puestos de encargado', () => {
    expect(encargadosDelComite([p('Encargado Comité', 'a'), p('Encargado de comité', 'a')])).toEqual(['a'])
  })

  it('un encargado dado de baja dejó de serlo', () => {
    expect(encargadosDelComite([p('Encargado Comité', 'a', 'inactive')])).toEqual([])
  })

  it('sin encargado devuelve vacío, no null', () => {
    expect(encargadosDelComite([p('Colaborador', 'a')])).toEqual([])
    expect(encargadosDelComite([])).toEqual([])
  })
})

describe('planDeEncargado', () => {
  const puesto = (id: string, title: string, ocupa = false, ocupantes = 1) => ({ id, title, ocupa, ocupantes })

  it('marcar SUMA el puesto de encargado sin quitarle el que ya tenía', () => {
    const plan = planDeEncargado([
      puesto('p1', 'Colaborador', true),
      puesto('p2', 'Encargado Comité', false, 1),
    ], true)
    expect(plan).toEqual({ accion: 'sumar', puestoId: 'p2' })
  })

  it('si el comité no tiene puesto de encargado, hay que crearlo', () => {
    expect(planDeEncargado([puesto('p1', 'Colaborador', true)], true)).toEqual({ accion: 'crear_y_sumar' })
  })

  it('con dos variantes del título gana la que la gente usa, no la más vieja', () => {
    // Comité de Planificación tiene "Encargado Comité" (1 ocupante) y
    // "Encargado de comité" (0), las dos activas.
    const plan = planDeEncargado([
      puesto('viejo', 'Encargado de comité', false, 0),
      puesto('usado', 'Encargado Comité', false, 1),
    ], true)
    expect(plan).toEqual({ accion: 'sumar', puestoId: 'usado' })
  })

  it('marcar a quien ya es encargado no hace nada', () => {
    expect(planDeEncargado([puesto('p1', 'Encargado Comité', true)], true)).toEqual({ accion: 'nada' })
  })

  it('desmarcar quita TODOS sus puestos de encargado', () => {
    const plan = planDeEncargado([
      puesto('p1', 'Encargado Comité', true),
      puesto('p2', 'Encargado de comité', true),
      puesto('p3', 'Colaborador', true),
    ], false)
    expect(plan).toEqual({ accion: 'quitar', puestos: ['p1', 'p2'] })
  })

  it('no se puede desmarcar si encargado es su único puesto: la sacaría del comité', () => {
    expect(planDeEncargado([
      puesto('p1', 'Encargado Comité', true),
      puesto('p2', 'Colaborador', false),
    ], false)).toEqual({ accion: 'bloqueado', motivo: 'unico_puesto' })
  })

  it('un puesto inactivo suyo no cuenta como "otro puesto"', () => {
    // `ocupa` ya significa activo; un registro dado de baja llega con ocupa:false.
    expect(planDeEncargado([
      puesto('p1', 'Encargado Comité', true),
      puesto('p2', 'Colaborador', false),
    ], false).accion).toBe('bloqueado')
  })

  it('desmarcar a quien no es encargado no hace nada', () => {
    expect(planDeEncargado([puesto('p1', 'Colaborador', true)], false)).toEqual({ accion: 'nada' })
  })

  it('"Encargado Logística" no cuenta: no es la cabeza de la sede', () => {
    // Sofía tenía Encargado Logística en Sede Madrid y aun así era leader_id.
    expect(planDeEncargado([puesto('p1', 'Encargado Logística', true)], true))
      .toEqual({ accion: 'crear_y_sumar' })
  })
})
