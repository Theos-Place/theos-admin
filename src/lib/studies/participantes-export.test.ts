import { describe, it, expect } from 'vitest'
import { armarFilas, type GrupoParaExport, type PersonaMin } from './participantes-export'

const p = (id: string, nombre: string): PersonaMin => ({
  id, first_name: nombre, last_name: 'Apellido', email: `${id}@x.com`, phone: '8888', cedula: '1-1-1',
})
const personas = new Map([['d', p('d', 'Dirigenta')], ['c', p('c', 'Codi')], ['e1', p('e1', 'Zulema')], ['e2', p('e2', 'Ana')]])

const grupo = (over: Partial<GrupoParaExport> = {}): GrupoParaExport => ({
  id: 'g1', name: 'Nivel 2. Junio', status: 'en_curso', starts_at: '2026-06-01', ends_at: '2026-08-10',
  leader_id: 'd', co_leader_id: 'c',
  plan: { code: 'N2', name: 'Nivel 2', cost: 5000, currency: 'CRC' },
  enrollments: [{ member_id: 'e1', status: 'enrolled' }, { member_id: 'e2', status: 'completed' }],
  ...over,
})

describe('una fila por persona, con el grupo repetido', () => {
  it('incluye dirigente, co-dirigente y estudiantes', () => {
    const f = armarFilas([grupo()], personas)
    expect(f).toHaveLength(4)
    expect(f.map(x => x.rol)).toEqual(['Dirigente', 'Co-dirigente', 'Estudiante', 'Estudiante'])
  })

  it('los estudiantes van por nombre, después de los dirigentes', () => {
    const f = armarFilas([grupo()], personas)
    expect(f.map(x => x.persona)).toEqual(['Dirigenta Apellido', 'Codi Apellido', 'Ana Apellido', 'Zulema Apellido'])
  })

  it('el costo sale del PLAN y se repite en cada fila', () => {
    for (const x of armarFilas([grupo()], personas)) {
      expect(x.costo).toBe(5000)
      expect(x.moneda).toBe('CRC')
    }
  })

  it('sin plan, el costo es 0 y no revienta', () => {
    const f = armarFilas([grupo({ plan: null })], personas)
    expect(f[0].costo).toBe(0)
    expect(f[0].codigo).toBe('')
  })
})

describe('el dirigente que además está matriculado', () => {
  it('sale UNA vez, con su rol de dirigente', () => {
    // Pasa en capacitaciones: el dirigente aparece también en enrollments.
    // Duplicarlo inflaría el conteo de participantes del grupo.
    const f = armarFilas([grupo({ enrollments: [{ member_id: 'd', status: 'enrolled' }] })], personas)
    expect(f.filter(x => x.persona === 'Dirigenta Apellido')).toHaveLength(1)
    expect(f.find(x => x.persona === 'Dirigenta Apellido')!.rol).toBe('Dirigente')
  })
})

describe('estados', () => {
  it('traduce el estado de la inscripción', () => {
    const f = armarFilas([grupo({ enrollments: [{ member_id: 'e1', status: 'en_revision' }] })], personas)
    expect(f.find(x => x.persona === 'Zulema Apellido')!.estado_inscripcion).toBe('Por confirmar')
  })
  it('un estado desconocido se muestra crudo, no vacío', () => {
    const f = armarFilas([grupo({ enrollments: [{ member_id: 'e1', status: 'raro' }] })], personas)
    expect(f.find(x => x.persona === 'Zulema Apellido')!.estado_inscripcion).toBe('raro')
  })
  it('los dirigentes no tienen estado de inscripción', () => {
    expect(armarFilas([grupo()], personas)[0].estado_inscripcion).toBe('—')
  })
})

describe('varios grupos', () => {
  it('se ordenan por nombre de grupo', () => {
    const f = armarFilas([grupo({ id: 'b', name: 'Zeta' }), grupo({ id: 'a', name: 'Alfa' })], personas)
    expect(f[0].grupo).toBe('Alfa')
    expect(f[f.length - 1].grupo).toBe('Zeta')
  })
})
