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

  it('MIENTRAS carga lo nuevo se siguen viendo los items viejos', () => {
    // Parpadear a vacío en cada cambio de filtro es peor que enseñar por un
    // instante lo de antes.
    const e = estadoDeLista('miembros?q=BEA#0', guardado())
    expect(e.cargando).toBe(true)
    expect(e.items).toEqual(['a', 'b'])
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
