import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ESTADOS_DE_DIRIGENTE, ESTADOS_RESERVADOS, estadosVisibles, estadosPermitidos,
  pasaEstadoDeDirigente, codigosDeSeleccion, resumenDeSeleccion,
  AVAILABILITY_DE_ETIQUETA, type EstadoDeDirigente,
} from './filtros-de-dirigente'
import { conditionLabel } from '@/lib/condition-labels'
import { normalizeRestriction, restrictionSummary } from '@/lib/audiencia/restriccion'
import { buildUnits, evaluateUnits } from '@/lib/filter-units'
import type { FilterCondition, FilterState } from '@/types/filters'

/** Las cuatro fichas que existen hoy en producción (medido el 2026-09-25):
 *  298 inactivas, 205 disponibles y activas, 1 en revisión activa, 1 en pausa
 *  inactiva. Las combinaciones raras están a propósito: son las que prueban
 *  que los dos ejes son independientes. */
const ACTIVO = { is_active: true, availability_status: 'available' }
const INACTIVO = { is_active: false, availability_status: 'inactive' }
const EN_PAUSA = { is_active: false, availability_status: 'resting' }
const EN_REVISION = { is_active: true, availability_status: 'en_revision' }

describe('los estados del dirigente no son excluyentes', () => {
  it('activo e inactivo parten la población en dos', () => {
    expect(pasaEstadoDeDirigente(ACTIVO, ['activo'])).toBe(true)
    expect(pasaEstadoDeDirigente(ACTIVO, ['inactivo'])).toBe(false)
    expect(pasaEstadoDeDirigente(INACTIVO, ['inactivo'])).toBe(true)
  })

  it('«activos + en pausa» trae a los dos grupos — la razón de que sea multiselección', () => {
    const filtro: EstadoDeDirigente[] = ['activo', 'pausa']
    expect(pasaEstadoDeDirigente(ACTIVO, filtro)).toBe(true)
    expect(pasaEstadoDeDirigente(EN_PAUSA, filtro)).toBe(true)
    expect(pasaEstadoDeDirigente(INACTIVO, filtro)).toBe(false)
  })

  it('en revisión es ORTOGONAL a activo: el único que hay en producción está activo', () => {
    expect(pasaEstadoDeDirigente(EN_REVISION, ['activo'])).toBe(true)
    expect(pasaEstadoDeDirigente(EN_REVISION, ['en_revision'])).toBe(true)
    // Y por eso pedir «activo» sin más NO lo esconde: son dos preguntas.
    expect(pasaEstadoDeDirigente(EN_REVISION, ['inactivo'])).toBe(false)
  })

  it('sin estados no pasa nadie: pidió filtrar y no dijo por qué', () => {
    expect(pasaEstadoDeDirigente(ACTIVO, [])).toBe(false)
  })
})

describe('«en pausa» y «en revisión» no los ve cualquiera', () => {
  it('quien administra dirigentes ve los cuatro', () => {
    expect(estadosVisibles(['coordinador_dirigentes'])).toEqual([...ESTADOS_DE_DIRIGENTE])
    expect(estadosVisibles(['admin'])).toHaveLength(4)
  })

  it('dirección NO, aunque tenga el módulo de estudios completo', () => {
    // Es la misma decisión de DIR-6: quién ve información delicada sobre una
    // persona se resuelve nombrando roles, no heredando privilegio.
    expect(estadosVisibles(['direccion'])).toEqual(['activo', 'inactivo'])
    expect(estadosVisibles([])).toEqual(['activo', 'inactivo'])
    expect(estadosVisibles(null)).toEqual(['activo', 'inactivo'])
  })

  it('una condición armada a mano se sanea: responde por lo que sí puede ver', () => {
    // No se niega a responder ni responde por los dos: devuelve los activos.
    expect(estadosPermitidos(['activo', 'en_revision'], false)).toEqual(['activo'])
    expect(estadosPermitidos(['activo', 'en_revision'], true)).toEqual(['activo', 'en_revision'])
  })

  it('tira la basura y los repetidos', () => {
    expect(estadosPermitidos(['activo', 'activo', 'inventado', ''], true)).toEqual(['activo'])
    expect(estadosPermitidos(null, true)).toEqual([])
  })

  it('las etiquetas administrativas apuntan a los valores reales de la columna', () => {
    expect(AVAILABILITY_DE_ETIQUETA.pausa).toBe('resting')
    expect(AVAILABILITY_DE_ETIQUETA.en_revision).toBe('en_revision')
    expect(ESTADOS_RESERVADOS).toEqual(['pausa', 'en_revision'])
  })
})

describe('la selección de estudios se expande a los códigos reales', () => {
  it('«Niveles» son los cuatro, no un código llamado así', () => {
    expect(codigosDeSeleccion(['GRP:niveles'])).toEqual(['N1', 'N2', 'N3', 'N4'])
    expect(codigosDeSeleccion(['GRP:discipulos'])).toEqual(['DIS1', 'DIS2', 'DIS3'])
  })

  it('mezcla grupos con códigos sueltos y no repite', () => {
    expect(codigosDeSeleccion(['GRP:discipulos', 'DIS1', 'PREMAT']))
      .toEqual(['DIS1', 'DIS2', 'DIS3', 'PREMAT'])
  })

  it('vacío es vacío: la condición no filtra por estudio', () => {
    expect(codigosDeSeleccion([])).toEqual([])
    expect(codigosDeSeleccion(null)).toEqual([])
  })
})

describe('el chip dice qué se eligió sin desbordarse', () => {
  const cond = (type: 'leader_trained' | 'leader_teaching' | 'leader_available', studies: string[]) =>
    ({ id: 1, group: 'leader', type, studies }) as FilterCondition

  it('nombra los grupos por su nombre, no por GRP:', () => {
    expect(conditionLabel(cond('leader_trained', ['GRP:niveles'])))
      .toBe('Capacitado para dar: Niveles')
    expect(conditionLabel(cond('leader_teaching', ['GRP:niveles', 'GRP:discipulos'])))
      .toBe('Dando ahora: Niveles o Discípulos')
  })

  it('con muchos, corta en dos y cuenta el resto', () => {
    expect(resumenDeSeleccion(['a', 'b', 'c', 'd'], v => v.toUpperCase())).toBe('A, B +2')
  })

  it('los tres tipos dicen cosas DISTINTAS: son tres preguntas distintas', () => {
    const etiquetas = (['leader_trained', 'leader_available', 'leader_teaching'] as const)
      .map(t => conditionLabel(cond(t, ['GRP:niveles'])))
    expect(new Set(etiquetas).size).toBe(3)
    expect(etiquetas[0]).toMatch(/Capacitado/)
    expect(etiquetas[1]).toMatch(/Disponible/)
    expect(etiquetas[2]).toMatch(/Dando ahora/)
  })

  it('el estado se lee con las etiquetas humanas', () => {
    const c = { id: 1, group: 'leader', type: 'leader_state', states: ['activo', 'pausa'] } as FilterCondition
    expect(conditionLabel(c)).toBe('Dirigente: Activo o En pausa')
  })

  it('negada, lleva el «Excepto» de PAR-5b sin que cada case lo repita', () => {
    const c = { id: 1, group: 'leader', type: 'leader_teaching', studies: ['GRP:niveles'], negate: true } as FilterCondition
    expect(conditionLabel(c)).toBe('Excepto — Dando ahora: Niveles')
  })
})

/**
 * El cable. Lo que ningún módulo puro atrapa: que la condición llegue al
 * servidor, que lea la columna correcta, y que «Es dirigente» no haya quedado
 * duplicado en dos pestañas — dos controles que escriben la misma condición se
 * pisan y nadie sabe cuál manda.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('PAR-7 · el cable', () => {
  const PANEL = 'src/components/members/AdvancedFilters.tsx'
  const SERVIDOR = 'src/lib/supabase/queries/members.ts'

  it('cada filtro lee SU columna: capacitado ≠ disponible', () => {
    const src = sinComentarios(SERVIDOR)
    // Son dos poblaciones distintas (445 fichas tienen las dos listas y no
    // coinciden): apuntar las dos a la misma columna daría respuestas que se
    // ven razonables y están mal.
    expect(src).toMatch(/leader_trained' \? 'formation_study_codes' : 'qualified_study_codes'/)
  })

  it('«dando ahora» reutiliza idsByLeadership y no una consulta nueva', () => {
    // Si fuera una consulta aparte, podría discrepar con el toggle de la
    // pantalla de dirigentes sobre si `en_matricula` cuenta. Hoy cuenta.
    const src = sinComentarios(SERVIDOR)
    const caso = src.slice(src.indexOf("case 'leader_teaching'"), src.indexOf("case 'server'"))
    expect(caso).toContain('idsByLeadership')
  })

  it('«Es dirigente» está SOLO en la pestaña de dirigentes', () => {
    const src = sinComentarios(PANEL)
    const enProfile = src.slice(src.indexOf('profile: (['), src.indexOf(']', src.indexOf('profile: ([')))
    expect(enProfile).not.toContain("'leader'")
    const enLeader = src.slice(src.indexOf('leader:  (['), src.indexOf(']', src.indexOf('leader:  ([')))
    expect(enLeader).toContain("'leader'")
  })

  it('los tres selectores de estudio son casillas, no una manta de chips', () => {
    // El catálogo tiene 29 opciones y en esta pestaña hay TRES preguntas: en
    // chips eran cinco filas cada una y no se distinguía dónde terminaba una y
    // empezaba la otra. Cerrado ocupa una línea; abierto, casillas que se
    // recorren con Tab.
    const src = sinComentarios(PANEL)
    const selector = src.slice(src.indexOf('function SelectorDeEstudios'))
    expect(selector).toContain('type="checkbox"')
    expect(selector).toContain('aria-expanded')
    // Y el selector es UNO SOLO para las tres: repetirlo tres veces era la
    // forma de que dos quedaran distintos sin que nadie lo notara.
    expect((src.match(/<SelectorDeEstudios/g) ?? []).length).toBe(3)
  })

  it('las rutas del padrón saneen los estados reservados con la SESIÓN', () => {
    for (const ruta of [
      'src/app/api/members/route.ts',
      'src/app/api/members/ids/route.ts',
      'src/app/api/members/export/route.ts',
    ]) {
      expect(sinComentarios(ruta), ruta)
        .toMatch(/verEstadosReservados:\s*canSeeLeaderAdminStatus\(/)
    }
  })
})

/**
 * Lo que motivó meter estos filtros en el padrón y no en la pantalla de
 * dirigentes: acá ya existen las listas guardadas. Una lista persiste el
 * `FilterState` como JSON en `member_lists.filters`, así que una condición que
 * no sobreviva un ida y vuelta por JSON se guardaría a medias y la lista se
 * ensancharía sola al recalcularla — es exactamente lo que pasó con los chips
 * rápidos (ver el comentario de `FilterState`).
 */
describe('una lista guardada con condiciones de dirigente se reabre igual', () => {
  const estado: FilterState = {
    v: 2,
    conditions: [
      { id: 1, group: 'leader', type: 'leader_state', states: ['activo', 'pausa'] },
      { id: 2, group: 'leader', type: 'leader_available', studies: ['GRP:niveles', 'PREMAT'] },
      { id: 3, group: 'leader', type: 'leader_teaching', studies: ['GRP:discipulos'], negate: true },
    ],
    groups: [{ id: 10, members: [1, 2], op: 'AND' }],
    topLevelOps: { g10: 'AND', c3: 'AND' },
  }

  it('sobrevive el ida y vuelta por JSON sin perder un campo', () => {
    const vuelta = JSON.parse(JSON.stringify(estado)) as FilterState
    expect(vuelta).toEqual(estado)
  })

  it('y sigue significando lo mismo: mismas unidades, mismo resultado', () => {
    const vuelta = JSON.parse(JSON.stringify(estado)) as FilterState
    expect(buildUnits(vuelta.conditions, vuelta.groups))
      .toEqual(buildUnits(estado.conditions, estado.groups))

    // Un universo de tres personas: solo «ana» cumple las condiciones 1, 2 y 3.
    const cumple: Record<string, number[]> = { ana: [1, 2, 3], beto: [1], caro: [] }
    const evaluar = (f: FilterState) => evaluateUnits(
      ['ana', 'beto', 'caro'],
      f.conditions, f.groups, f.topLevelOps ?? {},
      (id, condId) => (cumple[id] ?? []).includes(condId),
    )
    expect(evaluar(vuelta)).toEqual(evaluar(estado))
    expect(evaluar(estado)).toEqual(['ana'])
  })

  it('la expansión no se congela en la lista: guarda «Niveles», no N1..N4', () => {
    // Si se guardaran los códigos, el día que exista un N5 la lista seguiría
    // preguntando por cuatro y nadie se enteraría.
    const cond = estado.conditions[1] as Extract<FilterCondition, { type: 'leader_available' }>
    expect(cond.studies).toContain('GRP:niveles')
    expect(cond.studies).not.toContain('N1')
    expect(codigosDeSeleccion(cond.studies)).toEqual(['N1', 'N2', 'N3', 'N4', 'PREMAT'])
  })
})

describe('las condiciones de dirigente sirven de audiencia (GRU-2 / FRM-5)', () => {
  it('un formulario dirigido a «disponibles para dar Niveles» se guarda entero', () => {
    const cruda = {
      conditions: [{ id: 1, group: 'leader', type: 'leader_available', studies: ['GRP:niveles'] }],
      groups: [],
      ops: {},
    }
    const r = normalizeRestriction(cruda)
    expect(r).not.toBeNull()
    expect(r!.conditions).toHaveLength(1)
    // El campo propio de la condición no se pierde en el normalizado: sin
    // `studies` la restricción diría «cualquier estudio» y alcanzaría a los 505.
    expect((r!.conditions[0] as Extract<FilterCondition, { type: 'leader_available' }>).studies)
      .toEqual(['GRP:niveles'])
    expect(restrictionSummary(r)).toBe('Disponible para dar: Niveles')
  })

  it('una condición de un tipo que NO está permitido se descarta igual que antes', () => {
    expect(normalizeRestriction({
      conditions: [{ id: 1, group: 'form', type: 'form', formId: 'x' }], groups: [], ops: {},
    })).toBeNull()
  })
})
