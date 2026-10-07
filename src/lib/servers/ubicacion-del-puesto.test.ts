import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esComiteDeSede, ubicacionDelPuesto, opcionesDeUbicacion } from './ubicacion-del-puesto'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('SRV · qué comité tiene ubicación', () => {
  it('los seis de sede con vacantes publicadas', () => {
    // Verificados contra producción el 2026-10-07.
    for (const c of [
      'Sede Antares', 'Sede Liberia', 'Sede Meridiano Miércoles',
      'Sede Pedregal Domingos', 'Sede Pedregal Jueves', 'Sede Pedregal Miércoles',
    ]) {
      expect(esComiteDeSede(c), c).toBe(true)
    }
  })

  it('los que NO son sede, no', () => {
    // Un puesto del Comité Campamentos o del Comité Youth no se hace en un
    // cantón: es la mitad del pedido de Floriana.
    for (const c of ['Comité Campamentos', 'Comité Youth', 'Área de Ministerios', '', null]) {
      expect(esComiteDeSede(c), String(c)).toBe(false)
    }
  })

  it('«Sedecita» no cuela: se exige la palabra completa', () => {
    expect(esComiteDeSede('Sedecita')).toBe(false)
    expect(esComiteDeSede('Sede  Antares')).toBe(true)
  })
})

describe('SRV · la ubicación que se muestra', () => {
  it('el ejemplo del pedido: Meridiano es Escazú', () => {
    expect(ubicacionDelPuesto({
      nombreDelComite: 'Sede Meridiano Miércoles', cantonDeLaSede: 'Escazú',
    })).toBe('Escazú')
  })

  it('un comité que no es sede no tiene, aunque le pasen un cantón', () => {
    expect(ubicacionDelPuesto({
      nombreDelComite: 'Comité Campamentos', cantonDeLaSede: 'Escazú',
    })).toBeNull()
  })

  it('una sede sin cantón cargado tampoco inventa nada', () => {
    /**
     * El cantón no está en ningún lado del sistema y no se puede derivar:
     * un filtro que dice «Escazú» sobre una sede que no está en Escazú
     * manda a alguien al lugar equivocado. Vacío es honesto.
     */
    for (const c of [null, undefined, '', '   ']) {
      expect(ubicacionDelPuesto({ nombreDelComite: 'Sede Antares', cantonDeLaSede: c }), String(c))
        .toBeNull()
    }
  })

  it('las opciones del filtro salen ordenadas y sin repetir', () => {
    expect(opcionesDeUbicacion([
      { location: 'Escazú' }, { location: 'Belén' }, { location: 'Escazú' },
      { location: null }, { location: undefined },
    ])).toEqual(['Belén', 'Escazú'])
  })

  it('sin ninguna ubicación, el filtro no tiene qué mostrar', () => {
    expect(opcionesDeUbicacion([{ location: null }, { location: null }])).toEqual([])
  })
})

describe('SRV · el cableado', () => {
  it('la cartelera YA NO filtra por área con rótulo de ubicación', () => {
    /**
     * Era el bug: el desplegable decía «Todas las ubicaciones» y filtraba
     * por `v.area` («Área de Ministerios»). Nunca filtró por ubicación.
     */
    const pg = sinComentarios('src/app/(admin)/servidores/puestos/page.tsx')
    expect(pg).not.toContain('v.area === areaFilter')
    expect(pg).toContain("v.location === ubicacionFilter")
  })

  it('y el filtro desaparece si no hay ubicaciones cargadas', () => {
    // Un desplegable con una sola opción es ruido.
    const pg = sinComentarios('src/app/(admin)/servidores/puestos/page.tsx')
    expect(pg).toContain('{ubicacionOptions.length > 0 && (')
  })

  it('la ubicación se hereda de la sede, no se escribe por vacante', () => {
    // Son 26 vacantes de 6 sedes: repetir el cantón en cada una es pedir que
    // se desincronice.
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    expect(q).toContain("from('sedes').select('name, canton')")
    expect(q).toContain('ubicacionDelPuesto({')
  })

  it('pero una ubicación escrita A MANO en la vacante gana', () => {
    // Si alguien la puso a propósito, la sede no debería pisarla.
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    expect(q).toMatch(/location: \(row\.location as string \| null\)\s*\n?\s*\?\?/)
  })

  it('la columna del cantón es distinta de `location`, que es el lugar', () => {
    const m = readFileSync('supabase/migrations/20261007140000_srv_ubicacion_por_sede.sql', 'utf8')
    expect(m).toContain('add column if not exists canton text')
    // No se toca la que ya existe: «Plaza Antares, San Pedro» sirve para
    // llegar, no para filtrar.
    expect(m).not.toMatch(/alter\s+column\s+location/i)
  })
})
