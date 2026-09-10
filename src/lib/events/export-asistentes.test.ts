import { describe, it, expect } from 'vitest'
import { filasDeAsistentes, resumenDeCocina, type PersonaDelEvento } from './export-asistentes'

const ANA: PersonaDelEvento = {
  member_id: 'a', first_name: 'Ana', last_name: 'Alfaro',
  cedula: '111', phone: '8888-8888', email: 'ana@x.cr',
  allergies: 'Maní', dietary_restrictions: ['celiaquia'],
}
const BETO: PersonaDelEvento = { member_id: 'b', first_name: 'Beto', last_name: 'Brenes' }

describe('filasDeAsistentes', () => {
  it('una persona inscrita que además llegó es UNA fila, no dos', () => {
    const filas = filasDeAsistentes({
      personas: [ANA],
      inscripciones: [{ member_id: 'a', payment_status: 'paid' }],
      checkins: [{ member_id: 'a', checked_in_at: '2026-09-10T01:00:00Z', checked_in_as: 'asistente' }],
      usaInscripcion: true,
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].estado).toBe('Inscrito y asistió')
    expect(filas[0].pago).toBe('Pagado')
  })

  it('distingue quién solo se inscribió de quién solo llegó', () => {
    const filas = filasDeAsistentes({
      personas: [ANA, BETO],
      inscripciones: [{ member_id: 'a' }],
      checkins: [{ member_id: 'b', checked_in_at: '2026-09-10T01:00:00Z' }],
      usaInscripcion: true,
    })
    expect(filas.map(f => [f.nombre, f.estado])).toEqual([
      ['Ana Alfaro', 'Inscrito'],
      ['Beto Brenes', 'Asistió'],
    ])
  })

  it('el servidor aparece con su etiqueta: servir cuenta como asistir', () => {
    const [fila] = filasDeAsistentes({
      personas: [ANA],
      inscripciones: [],
      checkins: [{ member_id: 'a', checked_in_as: 'servidor', checked_in_at: '2026-09-10T01:00:00Z' }],
      usaInscripcion: false,
    })
    expect(fila.participante_o_servidor).toBe('Servidor')
    expect(fila.estado).toBe('Asistió')
  })

  it('sin check-in no inventa "Participante"', () => {
    const [fila] = filasDeAsistentes({
      personas: [ANA], inscripciones: [{ member_id: 'a' }], checkins: [], usaInscripcion: true,
    })
    expect(fila.participante_o_servidor).toBe('—')
    expect(fila.hora_de_llegada).toBeNull()
  })

  it('sin inscripción previa la columna de pago dice N/A, no "Pendiente"', () => {
    const [fila] = filasDeAsistentes({
      personas: [ANA], inscripciones: [], checkins: [{ member_id: 'a' }], usaInscripcion: false,
    })
    expect(fila.pago).toBe('N/A')
  })

  it('con dos check-ins de la misma persona vale la hora en que de verdad llegó', () => {
    const [fila] = filasDeAsistentes({
      personas: [ANA],
      inscripciones: [],
      checkins: [
        { member_id: 'a', checked_in_at: '2026-09-10T02:30:00Z' },
        { member_id: 'a', checked_in_at: '2026-09-10T01:05:00Z' },
      ],
      usaInscripcion: false,
    })
    expect(fila.hora_de_llegada?.toISOString()).toBe('2026-09-10T01:05:00.000Z')
  })

  it('trae lo que cocina necesita, y pone — donde no hay dato', () => {
    const filas = filasDeAsistentes({
      personas: [ANA, BETO],
      inscripciones: [],
      checkins: [{ member_id: 'a' }, { member_id: 'b' }],
      usaInscripcion: false,
    })
    const [ana, beto] = filas
    expect([ana.alergias, ana.restriccion_alimenticia]).toEqual(['Maní', 'Celiaquía'])
    expect([beto.alergias, beto.restriccion_alimenticia]).toEqual(['—', '—'])
  })

  it('nombra el sub-evento al que entró', () => {
    const [fila] = filasDeAsistentes({
      personas: [ANA], inscripciones: [], usaInscripcion: false,
      checkins: [{ member_id: 'a', sub_event_id: 's1' }],
      subEventos: new Map([['s1', 'Cuidado de niños']]),
    })
    expect(fila.sub_evento).toBe('Cuidado de niños')
  })

  it('alfabético, no por orden de llegada', () => {
    const filas = filasDeAsistentes({
      personas: [ANA, BETO], inscripciones: [], usaInscripcion: false,
      checkins: [{ member_id: 'b' }, { member_id: 'a' }],
    })
    expect(filas.map(f => f.nombre)).toEqual(['Ana Alfaro', 'Beto Brenes'])
  })

  it('alguien sin ficha no se pierde de la lista', () => {
    const [fila] = filasDeAsistentes({
      personas: [], inscripciones: [{ member_id: 'z' }], checkins: [], usaInscripcion: true,
    })
    expect(fila.nombre).toBe('Sin nombre')
  })
})

describe('resumenDeCocina', () => {
  it('cuenta a quién hay que atender distinto', () => {
    const filas = filasDeAsistentes({
      personas: [ANA, BETO], inscripciones: [], usaInscripcion: false,
      checkins: [{ member_id: 'a' }, { member_id: 'b' }],
    })
    expect(resumenDeCocina(filas)).toEqual({ conAlergia: 1, conRestriccion: 1 })
  })
})

describe('invitados sin ficha', () => {
  it('un invitado también come: sale en la lista con su nombre', () => {
    const filas = filasDeAsistentes({
      personas: [], inscripciones: [], usaInscripcion: false,
      checkins: [{ id: 'c1', member_id: null, guest_name: 'Carla Invitada', checked_in_as: 'asistente' }],
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Carla Invitada')
    expect(filas[0].estado).toBe('Asistió (invitado, sin ficha)')
  })

  it('dos invitados distintos son dos filas, no una', () => {
    const filas = filasDeAsistentes({
      personas: [], inscripciones: [], usaInscripcion: false,
      checkins: [
        { id: 'c1', member_id: null, guest_name: 'Carla Invitada' },
        { id: 'c2', member_id: null, guest_name: 'Diego Invitado' },
      ],
    })
    expect(filas.map(f => f.nombre)).toEqual(['Carla Invitada', 'Diego Invitado'])
  })
})
