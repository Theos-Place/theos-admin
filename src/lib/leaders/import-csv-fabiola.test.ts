import { describe, it, expect } from 'vitest'
import { decidir, siONo, type FilaDelCsv, type LoQueSabeElSistema } from './import-csv-fabiola'

const fila = (o: Partial<FilaDelCsv> = {}): FilaDelCsv => ({
  individualId: '123', nombre: 'Fulano', status: 'Activo',
  disponibilidad: 'Disponible', enGrupoWhatsapp: false, ...o,
})
const sistema = (o: Partial<LoQueSabeElSistema> = {}): LoQueSabeElSistema => ({
  dirigiendo: false, estadoBase: null, ...o,
})

describe('el sistema gana sobre el CSV', () => {
  /**
   * El CSV es una foto de un momento; el sistema sabe quién tiene un grupo
   * abierto AHORA. Desactivar a alguien que está dando un estudio sería el
   * error caro: desaparece de las listas y nadie entiende por qué.
   */
  it('no desactiva a quien tiene un grupo abierto', () => {
    const d = decidir(fila({ status: 'Inactivo', disponibilidad: 'Descanso' }),
      sistema({ dirigiendo: true }))
    expect(d.tipo).toBe('ignorar')
    expect(d.tipo === 'ignorar' && d.motivo).toContain('grupo abierto')
  })

  it('ni a quien el sistema ya tiene activo', () => {
    const d = decidir(fila({ status: 'Inactivo', disponibilidad: 'Descanso' }),
      sistema({ estadoBase: 'activo' }))
    expect(d.tipo).toBe('ignorar')
  })

  it('pero sí desactiva a quien no tiene nada que lo contradiga', () => {
    const d = decidir(fila({ status: 'Inactivo', disponibilidad: 'Descanso' }),
      sistema({ estadoBase: 'inactivo' }))
    expect(d.tipo).toBe('aplicar')
    expect(d.tipo === 'aplicar' && d.cambios.estado_base).toBe('inactivo')
  })

  it('y lo deja SIN razón, porque el CSV no la trae', () => {
    // Inventarle «no asiste» sería escribir en su expediente algo que
    // nadie afirmó.
    // Con 'Descanso', no 'Disponible': ese par es la contradicción que se
    // ignora, y usarlo acá probaría otra cosa.
    const d = decidir(fila({ status: 'Inactivo', disponibilidad: 'Descanso' }), sistema({ estadoBase: 'inactivo' }))
    expect(d.tipo === 'aplicar' && d.cambios.razon_inactivo).toBeNull()
  })
})

describe('«En curso» no se cree sin grupo', () => {
  /**
   * Precisión de Floriana (2026-10-13): «en curso» solo vale si hay un
   * estudio en matrícula, en curso o por empezar.
   */
  it('sin grupo, queda DISPONIBLE: el CSV está viejo', () => {
    const d = decidir(fila({ disponibilidad: 'En Curso' }), sistema({ dirigiendo: false }))
    expect(d.tipo === 'aplicar' && d.cambios.disponibilidad).toBe('disponible')
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBeNull()
  })

  it('con grupo TAMPOCO se escribe: la derivación lo hace sola', () => {
    // Escribirlo sería el mismo dato en dos lugares.
    const d = decidir(fila({ disponibilidad: 'En Curso' }), sistema({ dirigiendo: true }))
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBeNull()
  })

  it('«CoDirigente En Curso» se trata igual', () => {
    const d = decidir(fila({ disponibilidad: 'CoDirigente En Curso' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.disponibilidad).toBe('disponible')
  })
})

describe('las contradicciones se ignoran', () => {
  it('«Inactivo + Disponible» no se importa', () => {
    // Decisión de Floriana: no es un estado, es un error de captura, y
    // adivinar cuál de los dos vale sería inventar.
    const d = decidir(fila({ status: 'Inactivo', disponibilidad: 'Disponible' }), sistema())
    expect(d.tipo).toBe('ignorar')
    expect(d.tipo === 'ignorar' && d.motivo).toContain('Contradicción')
  })

  it('una fila sin estado va a revisión, no se adivina', () => {
    expect(decidir(fila({ status: '' }), sistema()).tipo).toBe('revisar')
  })

  it('y un estado desconocido también', () => {
    const d = decidir(fila({ status: 'Vacacionando' }), sistema())
    expect(d.tipo).toBe('revisar')
    expect(d.tipo === 'revisar' && d.motivo).toContain('Vacacionando')
  })
})

describe('el resto de los estados', () => {
  it('«Descanso» es pausa SIN fecha, marcada para completar', () => {
    // La pausa exige fecha y el CSV no la trae: se marca en vez de
    // inventarle una.
    const d = decidir(fila({ disponibilidad: 'Descanso' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBe('pausa')
    expect(d.tipo === 'aplicar' && d.cambios.pausa_por_completar).toBe(true)
  })

  it('«En Capacitación» es estudiante en capacitación', () => {
    const d = decidir(fila({ disponibilidad: 'En Capacitación' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBe('estudiante_capacitacion')
  })

  it('«Pasantía» es activo en pasantía', () => {
    const d = decidir(fila({ status: 'Pasantia', disponibilidad: 'Disponible' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBe('pasantia')
    expect(d.tipo === 'aplicar' && d.cambios.estado_base).toBe('activo')
  })

  it('«En revisión» es BANDERITA, no estado: el de abajo sale de su disponibilidad', () => {
    const d = decidir(fila({ status: 'En revision', disponibilidad: 'Descanso' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.revision).toEqual(['no_confirmo_datos'])
    expect(d.tipo === 'aplicar' && d.cambios.estado_base).toBe('activo')
    expect(d.tipo === 'aplicar' && d.cambios.razon_no_disponible).toBe('pausa')
  })

  it('y en revisión sin disponibilidad queda disponible', () => {
    const d = decidir(fila({ status: 'En revision', disponibilidad: '' }), sistema())
    expect(d.tipo === 'aplicar' && d.cambios.disponibilidad).toBe('disponible')
    expect(d.tipo === 'aplicar' && d.cambios.revision).toEqual(['no_confirmo_datos'])
  })

  it('las tildes y mayúsculas del CSV no cambian nada', () => {
    expect(decidir(fila({ status: 'ACTIVO', disponibilidad: 'DESCANSO' }), sistema()).tipo).toBe('aplicar')
    expect(decidir(fila({ status: 'En Revisión' }), sistema()).tipo).toBe('aplicar')
  })
})

describe('los booleanos del CSV', () => {
  it('solo VERDADERO es sí', () => {
    expect(siONo('VERDADERO')).toBe(true)
    expect(siONo('Verdadero')).toBe(true)
    expect(siONo('FALSO')).toBe(false)
    expect(siONo('')).toBe(false)
    expect(siONo(null)).toBe(false)
    expect(siONo('sí')).toBe(false)
  })
})
