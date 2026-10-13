import { describe, it, expect } from 'vitest'
import { badgeDeDirigente } from './badge-de-dirigente'

describe('DIR-8 · el indicador «Dirigente» del perfil', () => {
  it('quien no es dirigente no lo ve', () => {
    expect(badgeDeDirigente({ tieneFicha: false, activo: false }))
      .toEqual({ mostrar: false })
  })

  it('un dirigente activo lo ve encendido', () => {
    const b = badgeDeDirigente({ tieneFicha: true, activo: true })
    expect(b).toMatchObject({ mostrar: true, activo: true, tooltip: 'Dirigente activo' })
  })

  it('un dirigente INACTIVO lo ve apagado, no desaparecido', () => {
    // El bug: era el único de los cinco indicadores que se escondía del
    // todo. El perfil quedaba contradiciéndose — pestaña «Dirigente»,
    // enlace a su ficha, y arriba nada— y se leía como un dato perdido.
    const b = badgeDeDirigente({ tieneFicha: true, activo: false })
    expect(b).toMatchObject({ mostrar: true, activo: false, tooltip: 'Dirigente inactivo' })
  })

  it('activo sin ficha registrada igual se muestra', () => {
    // Pasa con quien entró al comité y todavía no tiene fila en
    // study_leaders. Esconderlo sería repetir el mismo error al revés.
    expect(badgeDeDirigente({ tieneFicha: false, activo: true }))
      .toMatchObject({ mostrar: true, activo: true })
  })

  it('el tooltip NO dice por qué está inactivo', () => {
    // Este resumen lo ven muchos más roles que la ficha administrativa. La
    // sub-razón y la banderita se quedan allá.
    const b = badgeDeDirigente({ tieneFicha: true, activo: false })
    if (!b.mostrar) throw new Error('debería mostrarse')
    expect(b.tooltip).toBe('Dirigente inactivo')
    expect(b.tooltip).not.toMatch(/CDEB|pausa|revisión|testimonio/i)
  })
})
