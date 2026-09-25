import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { hayFiltroActivo, avisoDeExportacion, type FiltrosDelPadron } from './filtros-activos'

const sinNada: FiltrosDelPadron = {
  busqueda: false, donantes: false, servidores: false,
  activos: false, asistenciaDeEstudios: false, condiciones: 0,
}

describe('PAR-5b · ¿hay filtro puesto?', () => {
  it('sin nada, no', () => {
    expect(hayFiltroActivo(sinNada)).toBe(false)
  })

  it('CUALQUIER bandera alcanza', () => {
    for (const k of ['busqueda', 'donantes', 'servidores', 'activos', 'asistenciaDeEstudios'] as const) {
      expect(hayFiltroActivo({ ...sinNada, [k]: true }), k).toBe(true)
    }
  })

  it('las condiciones avanzadas CUENTAN — el bug era justo este', () => {
    // Ari filtró con una condición avanzada, le quedaron 431 resultados, y el
    // aviso de export decía 24.000 porque esta bandera se había quedado fuera
    // de una de las tres copias de la regla.
    expect(hayFiltroActivo({ ...sinNada, condiciones: 1 })).toBe(true)
  })

  it('el chip de asistencia a estudios también contaba y también faltaba', () => {
    expect(hayFiltroActivo({ ...sinNada, asistenciaDeEstudios: true })).toBe(true)
  })
})

describe('el aviso antes de exportar', () => {
  it('sin filtros avisa, con el total del padrón', () => {
    const aviso = avisoDeExportacion(sinNada, 24000)
    // El separador de miles NO se fija a mano: `es-CR` devuelve un espacio fino
    // y no un punto, y el ICU de Node puede no coincidir con el del navegador.
    // Lo que importa es que el número sea el del padrón y que la frase pregunte.
    expect(aviso).toContain((24000).toLocaleString('es-CR'))
    expect(aviso).toContain('Vas a exportar')
    expect(aviso).toContain('¿Continuás?')
  })

  it('con una condición avanzada NO avisa', () => {
    // El caso de Ari. El export ya es acotado e intencional: el modal solo
    // estorba, y con el número global encima miente.
    expect(avisoDeExportacion({ ...sinNada, condiciones: 1 }, 24000)).toBeUndefined()
  })

  it('con cualquier chip tampoco', () => {
    expect(avisoDeExportacion({ ...sinNada, donantes: true }, 24000)).toBeUndefined()
    expect(avisoDeExportacion({ ...sinNada, asistenciaDeEstudios: true }, 24000)).toBeUndefined()
  })
})

describe('la regla vive en UN lugar', () => {
  const pagina = readFileSync('src/app/(admin)/miembros/page.tsx', 'utf8')

  it('la pantalla la importa en vez de reescribirla', () => {
    expect(pagina).toContain("from '@/lib/members/filtros-activos'")
    expect(pagina).toContain('avisoDeExportacion(filtrosPuestos')
  })

  it('NO quedó ninguna lista de banderas escrita a mano', () => {
    // Tres copias había, y la tercera fue la que falló. Una cadena de
    // `showDonors || showServers` suelta es la firma de una cuarta.
    expect(pagina).not.toMatch(/showDonors \|\| showServers/)
    expect(pagina).not.toMatch(/!searchActive && !showDonors/)
  })

  it('el menú de export cuenta lo que va al ARCHIVO, no lo cargado', () => {
    // `data` son las filas de la tabla; con `fetchData` el archivo trae todas
    // las que calzan. En el padrón eso es 50 contra 431.
    expect(pagina).toContain('totalACargar={resultTotal}')
    const boton = readFileSync('src/components/shared/ExportButton.tsx', 'utf8')
    expect(boton).toContain('(totalACargar ?? data.length)')
  })
})
