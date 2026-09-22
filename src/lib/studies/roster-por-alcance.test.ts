import { describe, it, expect } from 'vitest'
import { permisosDelRoster, recortarRoster, cumpleCorto, type FilaDeRoster } from './roster-por-alcance'

const fila = (over: Partial<FilaDeRoster> = {}): FilaDeRoster => ({
  id: 'e1', member_id: 'm1', status: 'enrolled', grade: 90, notes: 'aprobado',
  member: { first_name: 'Ana', last_name: 'Solís', phone: '8888-8888', birth_date: '1990-09-14' },
  ...over,
})

describe('permisosDelRoster', () => {
  it('el ESTUDIANTE ve la lista, pero solo nombres', () => {
    const p = permisosDelRoster('member')
    expect(p.verLista).toBe(true)
    expect(p.verTelefono).toBe(false)
    expect(p.verCumple).toBe(false)
    expect(p.verAsistencia).toBe(false)
  })

  it('el DIRIGENTE ve teléfono y cumpleaños pero NUNCA el perfil', () => {
    const p = permisosDelRoster('leader')
    expect(p.verTelefono).toBe(true)
    expect(p.verCumple).toBe(true)
    expect(p.verPerfil).toBe(false)
  })

  it('gestión sigue viendo todo, incluido el perfil', () => {
    expect(permisosDelRoster('admin')).toEqual({
      verLista: true, verTelefono: true, verCumple: true, verEdad: true,
      verDatosDeGestion: true, verPerfil: true, verAsistencia: true,
    })
  })

  it('sin alcance no se ve nada', () => {
    expect(permisosDelRoster('none').verLista).toBe(false)
  })
})

describe('recortarRoster', () => {
  it('AL ESTUDIANTE NO LE VIAJA el teléfono ni el cumpleaños', () => {
    // Esto se recorta en el SERVIDOR: esconder la columna en la UI deja el dato
    // en el JSON, a un clic de las herramientas del navegador.
    const [r] = recortarRoster([fila()], 'member')
    expect(r.member).toEqual({ first_name: 'Ana', last_name: 'Solís' })
    expect('phone' in r.member!).toBe(false)
    expect('birth_date' in r.member!).toBe(false)
  })

  it('al estudiante tampoco le viajan la nota ni las notas del cierre', () => {
    // Es la evaluación de otra persona.
    const [r] = recortarRoster([fila()], 'member')
    expect('grade' in r).toBe(false)
    expect('notes' in r).toBe(false)
  })

  it('pero SÍ ve a sus compañeros', () => {
    // Antes el endpoint le devolvía solo su propia inscripción.
    expect(recortarRoster([fila(), fila({ id: 'e2', member_id: 'm2' })], 'member')).toHaveLength(2)
  })

  it('al dirigente le llegan teléfono y cumpleaños', () => {
    const [r] = recortarRoster([fila()], 'leader')
    expect(r.member?.phone).toBe('8888-8888')
    expect(r.member?.birth_date).toBe('1990-09-14')
  })

  it('sin alcance, lista vacía', () => {
    expect(recortarRoster([fila()], 'none')).toEqual([])
  })

  it('una inscripción sin ficha no rompe', () => {
    expect(recortarRoster([fila({ member: null })], 'leader')[0].member).toBeNull()
  })

  it('un teléfono ausente llega como null, no se inventa', () => {
    const [r] = recortarRoster([fila({ member: { first_name: 'A', last_name: 'B' } })], 'leader')
    expect(r.member?.phone).toBeNull()
  })
})

describe('cumpleCorto', () => {
  it('muestra día y mes, nunca el año', () => {
    // El año revelaría la edad en una lista que ve el dirigente de un grupo.
    expect(cumpleCorto('1990-09-14')).toBe('14 set')
    expect(cumpleCorto('2001-01-05')).toBe('5 ene')
  })

  it('setiembre se abrevia como en Costa Rica', () => {
    expect(cumpleCorto('1990-09-14')).toContain('set')
  })

  it('sin fecha no muestra nada', () => {
    for (const v of [null, undefined, '', '  ']) expect(cumpleCorto(v)).toBeNull()
  })

  it('una fecha rara no rompe la tabla', () => {
    for (const v of ['ayer', '1990-13-01', '1990-09-40', '14/09/1990']) expect(cumpleCorto(v), v).toBeNull()
  })

  it('aguanta un timestamp completo', () => {
    expect(cumpleCorto('1990-09-14T00:00:00.000Z')).toBe('14 set')
  })
})

describe('la edad en el roster (2026-09-22)', () => {
  it('la ven el dirigente y quien administra', () => {
    // El dirigente la pidió: los grupos tienen age_min/age_max y él revisa si
    // su gente calza. Su alcance sobre miembros es 'own', así que sin esta
    // columna el dato no existe para él en ninguna parte.
    expect(permisosDelRoster('leader').verEdad).toBe(true)
    expect(permisosDelRoster('admin').verEdad).toBe(true)
  })

  it('NO la ve el estudiante ni quien no tiene relación con el grupo', () => {
    expect(permisosDelRoster('member').verEdad).toBe(false)
    expect(permisosDelRoster('none').verEdad).toBe(false)
  })

  it('va junto al cumpleaños, no en vez de él', () => {
    // El cumpleaños sigue viajando sin año (es para felicitar); la edad es otra
    // cosa y responde a la regla del grupo. Quien ve una ve la otra.
    for (const s of ['leader', 'admin'] as const) {
      expect(permisosDelRoster(s).verCumple).toBe(permisosDelRoster(s).verEdad)
    }
  })
})

describe('el estudiante no ve columnas de gestión (2026-09-22)', () => {
  // Reportado abriendo el grupo como estudiante: le salía la columna
  // "Acciones" VACÍA —todos los botones de adentro son de gestión— y el botón
  // de "ver 2 retirados", que es información de sus compañeros.
  it('verDatosDeGestion es lo que decide, y el estudiante no lo tiene', () => {
    expect(permisosDelRoster('member').verDatosDeGestion).toBe(false)
    expect(permisosDelRoster('none').verDatosDeGestion).toBe(false)
    expect(permisosDelRoster('leader').verDatosDeGestion).toBe(true)
    expect(permisosDelRoster('admin').verDatosDeGestion).toBe(true)
  })

  it('y el servidor ya le recortaba la nota, así que la columna sobraba', () => {
    const fila = {
      id: 'e1', member_id: 'm1', status: 'enrolled', grade: 90, notes: 'aprobado',
      member: { first_name: 'Ana', last_name: 'Ruiz', phone: '8888', birth_date: '1990-01-01' },
    }
    const [paraElEstudiante] = recortarRoster([fila], 'member')
    expect(paraElEstudiante.grade).toBeUndefined()
    expect(paraElEstudiante.notes).toBeUndefined()
    // Lo que sí ve: con quién lleva el grupo.
    expect(paraElEstudiante.member?.first_name).toBe('Ana')
    expect(paraElEstudiante.member?.phone).toBeUndefined()
  })
})
