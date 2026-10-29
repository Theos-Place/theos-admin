/**
 * EST-30 · Tiquete automático de Nivel 1 dos semanas antes del fin de
 * matrícula, al cupo máximo, y actualizado al abrir.
 */
import { describe, it, expect } from 'vitest'
import {
  fechaDeDisparo, tocaPedirAutomatico, cantidadAnticipada, contarMatricula,
  notaInicial, notaDeApertura, anexarNota, yaSeActualizoAlAbrir, cantidadAlConvivir,
  DIAS_ANTES_DEL_FIN_DE_MATRICULA, NIVELES_CON_TIQUETE_AUTOMATICO,
} from './folletos-anticipados-auto'

const n1 = (extra: Partial<Parameters<typeof tocaPedirAutomatico>[0]> = {}) => ({
  planCode: 'N1', status: 'en_matricula', enrollment_end_date: '2026-11-20',
  modalidad: 'bloques' as const, ...extra,
})

describe('cuándo toca', () => {
  it('son dos semanas antes del fin de matrícula', () => {
    expect(DIAS_ANTES_DEL_FIN_DE_MATRICULA).toBe(14)
    expect(fechaDeDisparo('2026-11-20')).toBe('2026-11-06')
    // Cruza de mes y de año sin construir un Date con zona.
    expect(fechaDeDisparo('2027-01-10')).toBe('2026-12-27')
  })

  it('a 14 días del cierre genera; a 15 todavía no', () => {
    expect(tocaPedirAutomatico(n1(), '2026-11-06')).toBe(true)
    expect(tocaPedirAutomatico(n1(), '2026-11-05')).toBe(false)
  })

  it('después de la fecha también: un grupo creado a 5 días del cierre se pide en la próxima corrida', () => {
    expect(tocaPedirAutomatico(n1(), '2026-11-15')).toBe(true)
  })

  it('solo Nivel 1', () => {
    expect([...NIVELES_CON_TIQUETE_AUTOMATICO]).toEqual(['N1'])
    expect(tocaPedirAutomatico(n1({ planCode: 'N3' }), '2026-11-10')).toBe(false)
    expect(tocaPedirAutomatico(n1({ planCode: 'DIS1' }), '2026-11-10')).toBe(false)
  })

  it('solo en matrícula, y solo con fin de matrícula definido', () => {
    expect(tocaPedirAutomatico(n1({ status: 'en_curso' }), '2026-11-10')).toBe(false)
    expect(tocaPedirAutomatico(n1({ enrollment_end_date: null }), '2026-11-10')).toBe(false)
  })

  it('un N1 legacy también pide (su propio folleto)', () => {
    expect(tocaPedirAutomatico(n1({ modalidad: 'legacy' }), '2026-11-10')).toBe(true)
  })
})

describe('cuánto se pide', () => {
  it('el cupo máximo aunque haya poca gente', () => {
    expect(cantidadAnticipada({ max_students: 15, matriculados: 2 })).toBe(15)
    expect(cantidadAnticipada({ max_students: 15, matriculados: 0 })).toBe(15)
  })

  it('si ya hay más matriculados que cupo, manda la gente', () => {
    expect(cantidadAnticipada({ max_students: 10, matriculados: 12 })).toBe(12)
  })

  it('sin cupo definido se cae a los matriculados; con nada, 0', () => {
    expect(cantidadAnticipada({ max_students: null, matriculados: 4 })).toBe(4)
    expect(cantidadAnticipada({ max_students: null, matriculados: 0 })).toBe(0)
  })
})

describe('confirmados y con pago pendiente', () => {
  it('pendiente = tiene un pago en pending; lo demás es confirmado', () => {
    const c = contarMatricula([
      { status: 'enrolled', payments: [{ status: 'pending' }] },
      { status: 'enrolled', payments: [{ status: 'paid' }] },
      { status: 'enrolled', payments: [] },
      { status: 'enrolled', payments: [{ status: 'cancelado' }] },
      { status: 'pendiente_de_pago', payments: [{ status: 'pending' }] },
    ])
    expect(c).toEqual({ confirmados: 3, pendientes: 2 })
  })

  it('las que no ocupan campo no cuentan', () => {
    const c = contarMatricula([
      { status: 'cancelada' }, { status: 'waitlist' }, { status: 'transferred', payments: [{ status: 'pending' }] },
    ])
    expect(c).toEqual({ confirmados: 0, pendientes: 0 })
  })
})

describe('la nota del tiquete', () => {
  const conteo = { confirmados: 3, pendientes: 2 }

  it('al nacer dice de dónde sale la cantidad y cuánta gente había, en fecha tica', () => {
    const n = notaInicial({ hoy: '2026-11-06', finDeMatricula: '2026-11-20', cantidad: 15, maxStudents: 15, conteo })
    expect(n).toContain('dos semanas antes del fin de matrícula (20/11/2026)')
    expect(n).toContain('cupo máximo del grupo (15)')
    expect(n).toContain('Al 06/11/2026: 3 matriculados confirmados · 2 con pago pendiente')
  })

  it('si la cantidad no es el cupo, lo explica', () => {
    expect(notaInicial({ hoy: '2026-11-06', finDeMatricula: '2026-11-20', cantidad: 12, maxStudents: 10, conteo }))
      .toContain('superan el cupo de 10')
    expect(notaInicial({ hoy: '2026-11-06', finDeMatricula: '2026-11-20', cantidad: 5, maxStudents: null, conteo }))
      .toContain('no tiene cupo máximo definido')
  })

  it('al abrir deja el historial inicial → final y se anexa sin pisar', () => {
    const anexo = notaDeApertura({ hoy: '2026-11-21', cantidadInicial: 15, cantidadFinal: 11, conteo: { confirmados: 9, pendientes: 2 } })
    expect(anexo).toContain('Apertura del grupo (21/11/2026)')
    expect(anexo).toContain('Cantidad: 15 → 11.')
    const nota = anexarNota('Tiquete automático…', anexo)
    expect(nota.startsWith('Tiquete automático…\n\n')).toBe(true)
    expect(yaSeActualizoAlAbrir(nota)).toBe(true)
    expect(yaSeActualizoAlAbrir('Tiquete automático…')).toBe(false)
  })

  it('si la cantidad no cambió lo dice así', () => {
    expect(notaDeApertura({ hoy: '2026-11-21', cantidadInicial: 15, cantidadFinal: 15, conteo }))
      .toContain('se mantiene en 15')
  })
})

describe('convivencia con un tiquete que ya existía (EST-18/EST-21/EST-25)', () => {
  it('en «creada» y pidiendo menos que el cupo: se sube al cupo', () => {
    expect(cantidadAlConvivir({ status: 'creada', quantity: 4, cupo: 15 })).toBe(15)
  })

  it('ya en impresión o más: no se toca', () => {
    expect(cantidadAlConvivir({ status: 'en_impresion', quantity: 4, cupo: 15 })).toBeNull()
    expect(cantidadAlConvivir({ status: 'empacado', quantity: 4, cupo: 15 })).toBeNull()
    expect(cantidadAlConvivir({ status: 'enviado_entregado', quantity: 4, cupo: 15 })).toBeNull()
  })

  it('si ya pide el cupo o más: nada que hacer', () => {
    expect(cantidadAlConvivir({ status: 'creada', quantity: 15, cupo: 15 })).toBeNull()
    expect(cantidadAlConvivir({ status: 'creada', quantity: 20, cupo: 15 })).toBeNull()
  })
})
