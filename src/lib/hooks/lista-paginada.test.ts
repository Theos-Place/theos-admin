import { describe, it, expect } from 'vitest'
import { estadoDeLista, sumarPagina, type ListaGuardada } from './lista-paginada'

const guardado = (over: Partial<ListaGuardada<string>> = {}): ListaGuardada<string> => ({
  sello: 'miembros?q=ana#0', items: ['a', 'b'], total: 5, pagina: 1, error: null, ...over,
})

describe('estadoDeLista', () => {
  it('sin nada guardado, está cargando y la lista está vacía', () => {
    const e = estadoDeLista('x#0', null)
    expect(e).toMatchObject({ items: [], total: 0, cargando: true, hayMas: false })
  })

  it('con el sello que se pidió, ya no carga', () => {
    expect(estadoDeLista('miembros?q=ana#0', guardado()).cargando).toBe(false)
  })

  it('MIENTRAS carga lo nuevo NO se muestran los items viejos', () => {
    /**
     * Esta prueba decía lo CONTRARIO hasta el 2026-10-08, con este argumento:
     * «parpadear a vacío en cada cambio de filtro es peor que enseñar por un
     * instante lo de antes».
     *
     * Vale para un buscador que escribe letra a letra. No vale para un filtro
     * de estado, donde las filas viejas CONTRADICEN el botón apretado.
     * Floriana: «si escojo fallidos, aun así me lista entregados». El
     * endpoint filtraba bien —devolvía 2 fallidos—; lo que quedaba en
     * pantalla eran las 200 entregadas de antes, bajo un botón que decía
     * «Fallidos». Eso no es un parpadeo, es la pantalla mintiendo.
     */
    const e = estadoDeLista('miembros?q=BEA#0', guardado())
    expect(e.cargando).toBe(true)
    expect(e.items).toEqual([])
    expect(e.total).toBe(0)
  })

  it('y el total y el extra tampoco: serían los del filtro anterior', () => {
    // «Destinatarios (524)» sobre la lista de fallidos es el mismo engaño.
    const conSuma: ListaGuardada<string, number> = {
      sello: 'miembros?q=ana#0', items: ['a', 'b'], total: 5, pagina: 1, error: null, extra: 99,
    }
    expect(estadoDeLista('miembros?q=ana#0', conSuma).extra).toBe(99)
    const e = estadoDeLista('miembros?q=BEA#0', conSuma)
    expect(e.total).toBe(0)
    expect(e.extra).toBeNull()
  })

  it('quien SÍ quiere lo viejo mientras carga lo pide', () => {
    // El buscador letra a letra: ahí el comportamiento viejo es el bueno.
    const e = estadoDeLista('miembros?q=BEA#0', guardado(), true)
    expect(e.cargando).toBe(true)
    expect(e.items).toEqual(['a', 'b'])
  })

  it('PAGINAR no se ve afectado: la página 2 va con el MISMO sello', () => {
    /**
     * Es la mitad que no se puede romper. Si al traer la página siguiente la
     * lista se vaciara, «cargar más» parpadearía toda la tabla — que es
     * justamente lo que el comportamiento viejo quería evitar.
     */
    const e = estadoDeLista('miembros?q=ana#0', guardado({ pagina: 2, items: ['a', 'b', 'c'] }))
    expect(e.cargando).toBe(false)
    expect(e.items).toEqual(['a', 'b', 'c'])
  })

  it('hay más mientras lo acumulado no llegue al total', () => {
    expect(estadoDeLista('miembros?q=ana#0', guardado()).hayMas).toBe(true)
    expect(estadoDeLista('miembros?q=ana#0', guardado({ items: ['a','b','c','d','e'] })).hayMas).toBe(false)
  })

  it('con el sello VIEJO no se ofrece cargar más', () => {
    // Paginar sobre un resultado que ya no corresponde a los filtros actuales
    // traería la página 2 de la búsqueda anterior.
    expect(estadoDeLista('otro#0', guardado()).hayMas).toBe(false)
  })
})

describe('sumarPagina', () => {
  it('suma al final y actualiza la página', () => {
    const r = sumarPagina(guardado(), { sello: 'miembros?q=ana#0', items: ['c'], total: 5, pagina: 2 })
    expect(r).toMatchObject({ items: ['a', 'b', 'c'], pagina: 2, total: 5 })
  })

  it('DESCARTA la respuesta si cambió el sello mientras venía en camino', () => {
    // Sin esto, cambiar de filtro con una petición a medio camino pegaba las
    // filas del filtro anterior debajo de las nuevas.
    expect(sumarPagina(guardado(), { sello: 'otro#0', items: ['z'], total: 9, pagina: 2 })).toBeNull()
  })

  it('descarta una página que no es la siguiente', () => {
    // Dos clics rápidos en "cargar más" pedían la 2 dos veces y duplicaban filas.
    expect(sumarPagina(guardado(), { sello: 'miembros?q=ana#0', items: ['c'], total: 5, pagina: 3 })).toBeNull()
    expect(sumarPagina(guardado(), { sello: 'miembros?q=ana#0', items: ['c'], total: 5, pagina: 1 })).toBeNull()
  })

  it('sin nada guardado no hay a qué sumarle', () => {
    expect(sumarPagina(null, { sello: 'x#0', items: ['a'], total: 1, pagina: 2 })).toBeNull()
  })

  it('el total manda el de la respuesta más reciente', () => {
    // Entre una página y la otra puede haberse creado o borrado una fila.
    const r = sumarPagina(guardado(), { sello: 'miembros?q=ana#0', items: ['c'], total: 7, pagina: 2 })
    expect(r?.total).toBe(7)
  })
})
