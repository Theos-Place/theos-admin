import { describe, it, expect } from 'vitest'
import {
  opcionesDeUbicacion, esSedeDelCatalogo, valorAGuardar, textoDeUbicacion,
  OTRA_UBICACION, SIN_UBICACION,
} from './ubicacion-de-puesto'

const SEDES = [{ id: '1', name: 'Sede Escazú' }, { id: '2', name: 'Sede Cartago' }]

describe('las tres formas de tener ubicación', () => {
  it('una sede del catálogo', () => {
    expect(valorAGuardar('Sede Escazú', '')).toBe('Sede Escazú')
    expect(esSedeDelCatalogo('Sede Escazú', SEDES)).toBe(true)
  })

  it('un lugar escrito a mano', () => {
    expect(valorAGuardar(OTRA_UBICACION, '  Pedregal, Belén  ')).toBe('Pedregal, Belén')
    expect(esSedeDelCatalogo('Pedregal, Belén', SEDES)).toBe(false)
  })

  it('o NADA, que es un caso válido y no un dato faltante', () => {
    expect(valorAGuardar(SIN_UBICACION, '')).toBeNull()
    expect(textoDeUbicacion(null)).toBe('Sin ubicación')
  })

  it('«otro lugar» sin escribir nada es lo mismo que sin ubicación', () => {
    expect(valorAGuardar(OTRA_UBICACION, '   ')).toBeNull()
  })

  it('se guarda null y NO cadena vacía', () => {
    // Con '' habría dos estados que se ven igual —«sin ubicación» y
    // «ubicación en blanco»— y toda consulta tendría que preguntar por los dos.
    expect(valorAGuardar('', '')).toBeNull()
    expect(valorAGuardar('   ', '')).toBeNull()
  })
})

describe('el selector', () => {
  it('ofrece vacío, las sedes y «otro lugar»', () => {
    const o = opcionesDeUbicacion(SEDES).map(x => x.value)
    expect(o[0]).toBe(SIN_UBICACION)
    expect(o).toContain('Sede Escazú')
    expect(o[o.length - 1]).toBe(OTRA_UBICACION)
  })

  it('CONSERVA lo guardado aunque ya no sea una sede activa', () => {
    // Sin esto, abrir el puesto para cambiarle otra cosa le borraría la
    // ubicación sin que nadie lo pidiera. Pasa con las sedes que se
    // desactivan y con los textos libres de antes.
    const o = opcionesDeUbicacion(SEDES, 'Pedregal, Belén')
    expect(o.map(x => x.value)).toContain('Pedregal, Belén')
    expect(o.find(x => x.value === 'Pedregal, Belén')?.label).toMatch(/guardada/)
  })

  it('y no la duplica si sí es una sede activa', () => {
    const o = opcionesDeUbicacion(SEDES, 'Sede Escazú')
    expect(o.filter(x => x.value === 'Sede Escazú')).toHaveLength(1)
  })

  it('sin sedes cargadas igual deja escribir a mano', () => {
    const o = opcionesDeUbicacion([]).map(x => x.value)
    expect(o).toEqual([SIN_UBICACION, OTRA_UBICACION])
  })
})

/** El cable: que el campo llegue a la base y se vea. */
import { readFileSync } from 'node:fs'
const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('la ubicación llega a la base y se ve', () => {
  const PANTALLA = 'src/app/(admin)/servidores/admin/page.tsx'

  it('el editor la manda en el PUT/POST', () => {
    const src = sinComentarios(PANTALLA)
    expect(src).toContain('valorAGuardar(ubicSel, ubicTexto)')
    expect(src).toMatch(/location: data\.location/)
  })

  it('el API la acepta', () => {
    for (const r of [
      'src/app/api/servers/positions/[id]/route.ts',
      'src/app/api/servers/positions/route.ts',
    ]) {
      expect(sinComentarios(r), r).toContain('location')
    }
  })

  it('la consulta la TRAE: un cast no trae datos', () => {
    const selects = sinComentarios('src/lib/supabase/queries/servers.ts')
      .match(/id, title, description, functions, profile, skills, study_requirement[^\n]*/g) ?? []
    expect(selects.some(s => s.includes('location'))).toBe(true)
  })

  it('y cuenta como detalle, para que el puesto se pueda abrir a verla', () => {
    // Sin esto, un puesto que SOLO tiene ubicación no mostraba el chevron y
    // el dato quedaba guardado sin forma de verlo.
    // Se mira SOLO la expresión de `hasDetail` y no el archivo entero: con un
    // `[\s\S]*?` suelto, el guard se conformaba con un `p.location` que está
    // más abajo, en el render, y daba verde con el cambio revertido.
    const src = sinComentarios(PANTALLA)
    const i = src.indexOf('const hasDetail =')
    expect(i).toBeGreaterThan(-1)
    const expresion = src.slice(i, src.indexOf('\n', src.indexOf('||', i) + 60))
    expect(expresion).toContain('p.location')
  })
})
