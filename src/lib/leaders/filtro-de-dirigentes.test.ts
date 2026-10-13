import { describe, it, expect } from 'vitest'
import {
  cumpleFiltro, gruposDeFiltros, conteoPorFiltro, type DirigenteFiltrable,
} from './filtro-de-dirigentes'

const d = (o: Partial<DirigenteFiltrable> = {}): DirigenteFiltrable => ({
  estado_base: 'activo', disponibilidad: 'disponible', razon_no_disponible: null,
  razon_inactivo: null, revision: [], dirigiendo: false, ...o,
})

describe('estado base', () => {
  it('separa activos de inactivos', () => {
    expect(cumpleFiltro(d(), 'base:activo')).toBe(true)
    expect(cumpleFiltro(d({ estado_base: 'inactivo' }), 'base:activo')).toBe(false)
    expect(cumpleFiltro(d({ estado_base: 'inactivo' }), 'base:inactivo')).toBe(true)
  })

  it('«todos» y el filtro vacío no filtran', () => {
    expect(cumpleFiltro(d({ estado_base: 'inactivo' }), 'todos')).toBe(true)
    expect(cumpleFiltro(d(), '')).toBe(true)
  })
})

describe('disponibilidad: usa la EFECTIVA, no la guardada', () => {
  /**
   * Es el punto de todo esto. Si el filtro preguntara por la columna,
   * «Disponibles» devolvería a las 106 personas que tienen un grupo abierto
   * y figuran disponibles — en la pantalla donde se eligen dirigentes para
   * asignarles grupos, que es donde más caro sale.
   */
  it('quien tiene grupo NO sale en «disponibles»', () => {
    const conGrupo = d({ dirigiendo: true })
    expect(cumpleFiltro(conGrupo, 'disp:disponible')).toBe(false)
    expect(cumpleFiltro(conGrupo, 'disp:no_disponible')).toBe(true)
  })

  it('y sale bajo la razón «dirigiendo», que no está guardada en su ficha', () => {
    expect(cumpleFiltro(d({ dirigiendo: true }), 'razon:dirigiendo')).toBe(true)
  })

  it('pero lo que coordinación escribió a mano le gana', () => {
    const pasantia = d({
      dirigiendo: true, disponibilidad: 'no_disponible', razon_no_disponible: 'pasantia',
    })
    expect(cumpleFiltro(pasantia, 'razon:pasantia')).toBe(true)
    expect(cumpleFiltro(pasantia, 'razon:dirigiendo')).toBe(false)
  })

  it('un inactivo no aparece en ninguna disponibilidad', () => {
    const inactivo = d({ estado_base: 'inactivo', disponibilidad: null })
    expect(cumpleFiltro(inactivo, 'disp:disponible')).toBe(false)
    expect(cumpleFiltro(inactivo, 'disp:no_disponible')).toBe(false)
  })
})

describe('razón de inactividad', () => {
  it('filtra por la razón', () => {
    const x = d({ estado_base: 'inactivo', disponibilidad: null, razon_inactivo: 'no_asiste' })
    expect(cumpleFiltro(x, 'inactivo:no_asiste')).toBe(true)
    expect(cumpleFiltro(x, 'inactivo:asiste_no_ejerce')).toBe(false)
  })

  it('un ACTIVO con una razón vieja guardada no se cuela', () => {
    // Pasa cuando alguien reactiva a una persona y la razón queda pegada.
    const x = d({ estado_base: 'activo', razon_inactivo: 'no_asiste' })
    expect(cumpleFiltro(x, 'inactivo:no_asiste')).toBe(false)
  })
})

describe('banderitas', () => {
  it('«con banderita» pide al menos una', () => {
    expect(cumpleFiltro(d({ revision: ['testimonio'] }), 'revision')).toBe(true)
    expect(cumpleFiltro(d({ revision: [] }), 'revision')).toBe(false)
    expect(cumpleFiltro(d({ revision: null }), 'revision')).toBe(false)
  })

  it('y se puede pedir una razón concreta', () => {
    const x = d({ revision: ['testimonio', 'compromiso'] })
    expect(cumpleFiltro(x, 'revision:compromiso')).toBe(true)
    expect(cumpleFiltro(x, 'revision:preparacion')).toBe(false)
  })

  it('la banderita convive con cualquier estado', () => {
    // Un dirigente en revisión puede estar perfectamente disponible.
    const x = d({ revision: ['testimonio'] })
    expect(cumpleFiltro(x, 'disp:disponible')).toBe(true)
    expect(cumpleFiltro(x, 'revision')).toBe(true)
  })
})

describe('los grupos de opciones', () => {
  it('las banderitas solo aparecen para quien puede verlas', () => {
    const con = gruposDeFiltros({ verBanderitas: true }).map(g => g.titulo)
    const sin = gruposDeFiltros({ verBanderitas: false }).map(g => g.titulo)
    expect(con).toContain('Revisión')
    expect(sin).not.toContain('Revisión')
  })

  it('toda opción ofrecida filtra de verdad', () => {
    // Un botón que no hace nada es peor que no tenerlo: se aprieta, no pasa
    // nada y se pierde la confianza en el resto.
    for (const g of gruposDeFiltros({ verBanderitas: true })) {
      for (const o of g.opciones) {
        expect(o.etiqueta.length, o.clave).toBeGreaterThan(0)
        expect(() => cumpleFiltro(d(), o.clave)).not.toThrow()
      }
    }
  })

  it('una clave desconocida muestra todo en vez de vaciar la lista', () => {
    // Una lista vacía se lee como «no hay dirigentes», que sería mentira.
    expect(cumpleFiltro(d(), 'inventado:xyz')).toBe(true)
  })
})

describe('conteos', () => {
  it('cuenta cada opción sobre el total', () => {
    const gente = [
      d(), d({ dirigiendo: true }),
      d({ estado_base: 'inactivo', disponibilidad: null, razon_inactivo: 'no_asiste' }),
    ]
    expect(conteoPorFiltro(gente, ['base:activo', 'base:inactivo', 'disp:disponible', 'razon:dirigiendo']))
      .toEqual({ 'base:activo': 2, 'base:inactivo': 1, 'disp:disponible': 1, 'razon:dirigiendo': 1 })
  })
})
