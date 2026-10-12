import { describe, it, expect } from 'vitest'
import { razonParaNoBorrarGrupo } from './borrar-grupo'

const vacio = { pagosVivos: 0, transferidas: 0, completadas: 0 }

describe('MAT-3 · cuándo no se borra un grupo', () => {
  it('un grupo recién creado por error SÍ se borra', () => {
    // Es el caso legítimo y tiene que seguir funcionando: si el guard
    // bloquea todo, alguien termina borrando por SQL y vuelve el problema.
    expect(razonParaNoBorrarGrupo(vacio)).toBeNull()
  })

  it('con un cobro vivo, NO — es el caso que dejó ₡10.000 sueltos', () => {
    const r = razonParaNoBorrarGrupo({ ...vacio, pagosVivos: 2 })
    expect(r).toMatch(/2 cobros sin cancelar/)
    expect(r).toMatch(/sueltos/)
  })

  it('el dinero manda sobre el resto: se nombra primero', () => {
    // Con las tres cosas a la vez, el motivo que se muestra es el del cobro:
    // es el único que además de perder rastro pierde plata.
    expect(razonParaNoBorrarGrupo({ pagosVivos: 1, transferidas: 3, completadas: 5 }))
      .toMatch(/cobro sin cancelar/)
  })

  it('con gente trasladada desde acá, NO', () => {
    expect(razonParaNoBorrarGrupo({ ...vacio, transferidas: 2 }))
      .toMatch(/se trasladó a otro grupo/)
  })

  it('con gente que terminó el estudio, NO: es su expediente', () => {
    expect(razonParaNoBorrarGrupo({ ...vacio, completadas: 9 }))
      .toMatch(/expediente/)
  })

  it('el singular y el plural se leen bien', () => {
    expect(razonParaNoBorrarGrupo({ ...vacio, pagosVivos: 1 })).toMatch(/1 cobro sin/)
    expect(razonParaNoBorrarGrupo({ ...vacio, transferidas: 1 })).toMatch(/1 matrícula que se/)
    expect(razonParaNoBorrarGrupo({ ...vacio, completadas: 1 })).toMatch(/1 persona que terminó/)
  })

  it('el motivo dice qué hacer, no solo que no se puede', () => {
    expect(razonParaNoBorrarGrupo({ ...vacio, pagosVivos: 1 })).toMatch(/Anulá o trasladá/)
  })
})
