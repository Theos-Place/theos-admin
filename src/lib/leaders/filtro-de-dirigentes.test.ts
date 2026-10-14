import { describe, it, expect } from 'vitest'
import {
  cumpleFiltro, gruposDeFiltros, conteoPorFiltro, type DirigenteFiltrable,
  cumpleFiltros, alternarFiltro, conteosConSeleccion,
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

describe('DIR-15 · varios filtros a la vez', () => {
  const act = { estado_base: 'activo', disponibilidad: 'disponible', razon_no_disponible: null, razon_inactivo: null, revision: [], dirigiendo: false }
  const actPasantia = { ...act, disponibilidad: 'no_disponible', razon_no_disponible: 'pasantia' }
  const actDando = { ...act, dirigiendo: true }
  const inact = { estado_base: 'inactivo', disponibilidad: null, razon_no_disponible: null, razon_inactivo: 'no_asiste', revision: [], dirigiendo: false }
  const gente = [act, actPasantia, actDando, inact]

  it('sin filtros, pasan todos', () => {
    expect(gente.filter(d => cumpleFiltros(d, []))).toHaveLength(4)
    expect(gente.filter(d => cumpleFiltros(d, ['todos']))).toHaveLength(4)
  })

  it('ENTRE GRUPOS se cruzan: «activo Y en pasantía»', () => {
    // Es lo que no se podía pedir antes, cuando el filtro era uno solo.
    const r = gente.filter(d => cumpleFiltros(d, ['base:activo', 'razon:pasantia']))
    expect(r).toEqual([actPasantia])
  })

  it('DENTRO DE UN GRUPO suman: «activo O inactivo» son los dos', () => {
    // Con «Y» daría cero y parecería un error del sistema.
    expect(gente.filter(d => cumpleFiltros(d, ['base:activo', 'base:inactivo']))).toHaveLength(4)
  })

  it('«no disponible» y «pasantía» juntos no dan cero: suman', () => {
    // Están en el mismo grupo de la pantalla. Y entran DOS, no uno: quien
    // está dando un grupo cuenta como no disponible por derivación aunque su
    // ficha no lo diga — es la disponibilidad EFECTIVA de DIR-9, y que
    // aparezca acá es correcto.
    const r = gente.filter(d => cumpleFiltros(d, ['disp:no_disponible', 'razon:pasantia']))
    expect(r).toEqual([actPasantia, actDando])
  })

  it('una combinación imposible da cero, y eso es correcto', () => {
    expect(gente.filter(d => cumpleFiltros(d, ['base:activo', 'inactivo:no_asiste']))).toEqual([])
  })
})

describe('DIR-15 · tocar un filtro lo prende y lo apaga', () => {
  it('apagado → prendido → apagado', () => {
    let sel: string[] = []
    sel = alternarFiltro(sel, 'base:activo')
    expect(sel).toEqual(['base:activo'])
    sel = alternarFiltro(sel, 'base:activo')
    expect(sel).toEqual([])
  })

  it('se acumulan', () => {
    let sel = alternarFiltro([], 'base:activo')
    sel = alternarFiltro(sel, 'razon:pasantia')
    expect(sel).toEqual(['base:activo', 'razon:pasantia'])
  })

  it('«Todos» borra la selección, no se suma a ella', () => {
    expect(alternarFiltro(['base:activo', 'razon:pasantia'], 'todos')).toEqual([])
  })
})

describe('DIR-15 · las opciones que no llevan a nada se apagan solas', () => {
  const act = { estado_base: 'activo', disponibilidad: 'disponible', razon_no_disponible: null, razon_inactivo: null, revision: [], dirigiendo: false }
  const inact = { estado_base: 'inactivo', disponibilidad: null, razon_no_disponible: null, razon_inactivo: 'no_asiste', revision: [], dirigiendo: false }
  const gente = [act, act, inact]
  const todas = ['todos', 'base:activo', 'base:inactivo', 'inactivo:no_asiste', 'dirigiendo']

  it('con «Activo» puesto, las razones de inactividad dan CERO', () => {
    // Es la dependencia que pidió Floriana, y sale de los datos: no hay una
    // tabla de qué excluye a qué que haya que mantener a mano.
    const c = conteosConSeleccion(gente, ['base:activo'], todas)
    expect(c['inactivo:no_asiste']).toBe(0)
    expect(c['base:activo']).toBe(2)
  })

  it('y al revés: con «Inactivo», «dando ahora» no suma a nadie', () => {
    const c = conteosConSeleccion(gente, ['base:inactivo'], todas)
    expect(c['dirigiendo']).toBe(0)
  })

  it('la opción YA elegida muestra lo que se está viendo', () => {
    const c = conteosConSeleccion(gente, ['base:activo'], todas)
    expect(c['base:activo']).toBe(2)
  })

  it('las del MISMO grupo muestran cuánto sumarían, no cuánto quitarían', () => {
    // Con «Activo» puesto, «Inactivo» ofrece sus 1, porque tocarlo suma.
    const c = conteosConSeleccion(gente, ['base:activo'], todas)
    expect(c['base:inactivo']).toBe(1)
  })

  it('«Todos» siempre es todos', () => {
    expect(conteosConSeleccion(gente, ['base:activo'], todas)['todos']).toBe(3)
  })
})

describe('DIR-15 · «Dando ahora» es un filtro más', () => {
  const dando = { estado_base: 'activo', disponibilidad: null, razon_no_disponible: null, razon_inactivo: null, revision: [], dirigiendo: true }
  const sin = { ...dando, dirigiendo: false }

  it('filtra a los que tienen grupo abierto', () => {
    expect([dando, sin].filter(d => cumpleFiltros(d, ['dirigiendo']))).toEqual([dando])
  })

  it('y a los que no', () => {
    expect([dando, sin].filter(d => cumpleFiltros(d, ['dirigiendo:no']))).toEqual([sin])
  })

  it('se cruza con el estado', () => {
    expect([dando, sin].filter(d => cumpleFiltros(d, ['base:activo', 'dirigiendo']))).toEqual([dando])
  })

  it('vive en su propio grupo, al lado de Estado', () => {
    const g = gruposDeFiltros({ verBanderitas: false })
    expect(g.map(x => x.titulo).slice(0, 2)).toEqual(['Estado', 'Grupos'])
  })
})
