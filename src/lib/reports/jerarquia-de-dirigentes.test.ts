import { describe, it, expect } from 'vitest'
import { jerarquiaDeDirigentes, type DirigenteParaReporte } from './jerarquia-de-dirigentes'

const d = (o: Partial<DirigenteParaReporte> & { member_id: string }): DirigenteParaReporte => ({
  nombre: o.member_id, estado_base: 'activo', disponibilidad: 'disponible',
  razon_no_disponible: null, razon_inactivo: null, revision: [], dirigiendo: false, ...o,
})

/** Un cuerpo de dirigentes chico pero con todas las ramas. */
const GENTE: DirigenteParaReporte[] = [
  d({ member_id: 'a1' }), d({ member_id: 'a2' }), d({ member_id: 'a3' }),
  d({ member_id: 'nd1', disponibilidad: 'no_disponible', razon_no_disponible: 'dirigiendo' }),
  d({ member_id: 'nd2', disponibilidad: 'no_disponible', razon_no_disponible: 'dirigiendo' }),
  d({ member_id: 'nd3', disponibilidad: 'no_disponible', razon_no_disponible: 'pasantia' }),
  d({ member_id: 'nd4', disponibilidad: 'no_disponible', razon_no_disponible: 'pausa' }),
  d({ member_id: 'i1', estado_base: 'inactivo', disponibilidad: null, razon_inactivo: 'no_asiste' }),
  d({ member_id: 'i2', estado_base: 'inactivo', disponibilidad: null, razon_inactivo: 'asiste_no_ejerce' }),
  d({ member_id: 'i3', estado_base: 'inactivo', disponibilidad: null, razon_inactivo: null }),
]

describe('DIR-9 · la jerarquía del reporte', () => {
  const j = jerarquiaDeDirigentes(GENTE, { verBanderitas: true })

  it('activos e inactivos suman el total', () => {
    expect(j.total).toBe(10)
    expect(j.activos.total + j.inactivos.total).toBe(j.total)
  })

  it('disponibles y no disponibles suman los activos', () => {
    expect(j.disponibles.total + j.noDisponibles.total).toBe(j.activos.total)
  })

  it('las cinco razones suman los no disponibles', () => {
    const suma = j.porRazonNoDisponible.reduce((n, c) => n + c.total, 0)
    expect(suma).toBe(j.noDisponibles.total)
  })

  it('el desglose de inactivos cierra CON los que no tienen razón', () => {
    // 294 fichas quedaron sin razón en la conversión de DIR-8. Si no se
    // mostraran, el desglose no sumaría y parecería que faltan personas.
    const suma = j.porRazonInactivo.reduce((n, c) => n + c.total, 0) + j.inactivosSinRazon.total
    expect(suma).toBe(j.inactivos.total)
    expect(j.inactivosSinRazon.total).toBe(1)
  })

  it('los porcentajes son sobre el TOTAL, para poder compararlos entre ramas', () => {
    expect(j.disponibles.total).toBe(3)
    expect(j.disponibles.pct).toBe(30)
    expect(j.inactivos.pct).toBe(30)
  })

  it('cada número trae a QUIÉNES, para el drill-down', () => {
    expect(j.porRazonNoDisponible.find(c => c.clave === 'no_disponible:dirigiendo')!.miembros)
      .toEqual(['nd1', 'nd2'])
  })
})

describe('DIR-9 · la banderita', () => {
  const CON_BANDERA = [
    ...GENTE,
    d({ member_id: 'b1', revision: ['testimonio'] }),
    d({ member_id: 'b2', revision: ['testimonio', 'compromiso'] }),
    d({ member_id: 'b3', estado_base: 'inactivo', disponibilidad: null,
      razon_inactivo: 'no_asiste', revision: ['preparacion'] }),
  ]

  it('convive con cualquier estado, también con inactivo', () => {
    const j = jerarquiaDeDirigentes(CON_BANDERA, { verBanderitas: true })
    expect(j.enRevision!.total).toBe(3)
    expect(j.enRevision!.miembros).toContain('b3')
  })

  it('el desglose suma MÁS que el total: una persona puede tener varias', () => {
    const j = jerarquiaDeDirigentes(CON_BANDERA, { verBanderitas: true })
    const suma = j.porRazonDeRevision.reduce((n, c) => n + c.total, 0)
    expect(suma).toBeGreaterThan(j.enRevision!.total)
  })

  it('a quien NO puede verla le llega null, no un cero', () => {
    // Un cero afirmaría que no hay ninguna. «No te toca verlo» es otra cosa,
    // y quien lea el reporte no podría distinguirlos.
    const j = jerarquiaDeDirigentes(CON_BANDERA, { verBanderitas: false })
    expect(j.enRevision).toBeNull()
    expect(j.porRazonDeRevision).toEqual([])
  })

  it('pero el resto de los números NO cambian por el permiso', () => {
    const conPermiso = jerarquiaDeDirigentes(CON_BANDERA, { verBanderitas: true })
    const sinPermiso = jerarquiaDeDirigentes(CON_BANDERA, { verBanderitas: false })
    expect(sinPermiso.activos).toEqual(conPermiso.activos)
    expect(sinPermiso.disponibles).toEqual(conPermiso.disponibles)
  })
})

describe('DIR-9 · casos de borde', () => {
  it('sin dirigentes no divide entre cero', () => {
    const j = jerarquiaDeDirigentes([], { verBanderitas: true })
    expect(j.total).toBe(0)
    expect(j.activos.pct).toBe(0)
  })

  it('un estado desconocido no se cuenta ni como activo ni como inactivo', () => {
    // Prefiero que el total no cuadre y se note, a que una fila rota se
    // sume en silencio a la rama equivocada.
    const j = jerarquiaDeDirigentes([d({ member_id: 'raro', estado_base: 'otra_cosa' })],
      { verBanderitas: true })
    expect(j.activos.total).toBe(0)
    expect(j.inactivos.total).toBe(0)
  })
})


/**
 * EL BUG QUE DIR-9 DESTAPÓ, convertido en test.
 *
 * Medido en producción el 2026-10-13: 109 personas con grupo en curso o en
 * matrícula, 106 de ellas con `disponibilidad = 'disponible'` en su ficha.
 *
 * El reporte viejo (DIR-7) no arrastraba esto porque nunca leyó ese campo.
 * El nuevo sí lo lee, así que sin derivar diría 211 disponibles cuando 106
 * están ocupadas — y ese es el número que se mira para repartir grupos.
 */
describe('tener un grupo saca de «disponible», aunque la ficha diga otra cosa', () => {
  it('quien dirige NO se cuenta como disponible', () => {
    const j = jerarquiaDeDirigentes(
      [d({ member_id: 'x', dirigiendo: true }), d({ member_id: 'y' })],
      { verBanderitas: false },
    )
    expect(j.disponibles.total).toBe(1)
    expect(j.disponibles.miembros).toEqual(['y'])
    expect(j.noDisponibles.miembros).toEqual(['x'])
  })

  it('y aparece bajo la razón «dirigiendo», que no está guardada en ninguna fila', () => {
    const j = jerarquiaDeDirigentes([d({ member_id: 'x', dirigiendo: true })], { verBanderitas: false })
    const dirigiendo = j.porRazonNoDisponible.find(c => c.clave === 'no_disponible:dirigiendo')
    expect(dirigiendo?.total).toBe(1)
    expect(j.derivadosADirigiendo.miembros).toEqual(['x'])
  })

  it('pero lo que coordinación escribió a mano le gana al grupo', () => {
    // Si alguien decidió «pasantía», esa es una decisión, no un descuido.
    const j = jerarquiaDeDirigentes(
      [d({ member_id: 'x', dirigiendo: true, disponibilidad: 'no_disponible', razon_no_disponible: 'pasantia' })],
      { verBanderitas: false },
    )
    expect(j.porRazonNoDisponible.find(c => c.clave === 'no_disponible:pasantia')?.total).toBe(1)
    expect(j.porRazonNoDisponible.find(c => c.clave === 'no_disponible:dirigiendo')?.total).toBe(0)
    expect(j.derivadosADirigiendo.total).toBe(0)
  })

  it('un inactivo con grupo no se cuela entre los activos: se reporta como inconsistencia', () => {
    const j = jerarquiaDeDirigentes(
      [d({ member_id: 'z', estado_base: 'inactivo', disponibilidad: null, dirigiendo: true })],
      { verBanderitas: false },
    )
    expect(j.disponibles.total).toBe(0)
    expect(j.noDisponibles.total).toBe(0)
    expect(j.inactivosConGrupo.miembros).toEqual(['z'])
  })

  it('las ramas siguen sumando el total después de derivar', () => {
    const gente = [
      d({ member_id: 'a', dirigiendo: true }), d({ member_id: 'b' }),
      d({ member_id: 'c', estado_base: 'inactivo', disponibilidad: null }),
    ]
    const j = jerarquiaDeDirigentes(gente, { verBanderitas: false })
    expect(j.disponibles.total + j.noDisponibles.total).toBe(j.activos.total)
    expect(j.activos.total + j.inactivos.total).toBe(j.total)
  })
})
