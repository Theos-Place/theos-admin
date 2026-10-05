import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const INDICE = 'src/app/(admin)/servidores/page.tsx'
const TAB = 'src/app/(admin)/servidores/[committeeId]/_components/VacanciesTab.tsx'
const PUESTOS = 'src/app/(admin)/servidores/puestos/page.tsx'
const HOOK = 'src/hooks/usePuedePedirPuestos.ts'

describe('SRV-20 · el botón de solicitar no se le muestra a quien no puede', () => {
  it('el índice de Servidores lo esconde (antes no tenía NINGÚN gate)', () => {
    // Lo veía cualquiera con acceso al módulo, y al tocarlo la pantalla de
    // pedir cupos no le ofrecía ningún comité.
    const src = sinComentarios(INDICE)
    expect(src).toMatch(/\{puedePedir && \(/)
    expect(src).toContain('usePuedePedirPuestos()')
  })

  it('y la pestaña de vacantes del comité, también', () => {
    const src = sinComentarios(TAB)
    expect(src).toMatch(/\{puedePedir && \(/)
    expect(src).toContain('usePuedePedirPuestos()')
  })

  it('el permiso lo contesta el SERVIDOR, no una lista de roles', () => {
    // Es la misma fuente que llena el selector de comités de la pantalla a
    // la que lleva el botón: si ahí no hay ninguno, el botón es un callejón.
    const src = sinComentarios(HOOK)
    expect(src).toContain("fetch('/api/servers/manageable-committees')")
    expect(src).toMatch(/comites\.all \|\| comites\.ids\.length > 0/)
  })

  it('si la consulta falla, el botón NO aparece', () => {
    // Equivocarse hacia esconderlo molesta a quien sí puede; mostrarlo manda
    // a quien no puede contra un 403 sin explicación.
    const src = sinComentarios(HOOK)
    expect(src).toMatch(/catch\(\(\) => \{ if \(vivo\) setComites\(null\) \}\)/)
  })

  it('la cartelera pública MANTIENE su lista corta, que fue una decisión', () => {
    // Floriana la acortó el 2026-09-25: esa pantalla la ve cualquier
    // miembro, y ahí cada botón de más es alguien apretando lo que no le
    // toca. `solicitudes_puestos` pide desde el índice o desde su comité.
    const src = sinComentarios(PUESTOS)
    expect(src).toContain('const canRequest = hasRole(...PUEDE_GESTIONAR)')
    expect(src).not.toContain('usePuedePedirPuestos')
  })
})
