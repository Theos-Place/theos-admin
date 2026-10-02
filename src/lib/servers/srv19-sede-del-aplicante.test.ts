import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lineasDelDetalle, detalleEnHtml } from '@/lib/servers/detalle-del-aplicante'
import { toDomainApplication } from '@/lib/servers/adapter'
import type { DbApplication } from '@/lib/supabase/queries/servers'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const BANDEJA = 'src/app/(admin)/servidores/aplicaciones/page.tsx'
const QUERIES = 'src/lib/supabase/queries/servers.ts'

const fila = (sede: { name: string } | null): DbApplication => ({
  id: 'a1', vacancy_id: 'v1', applicant_id: 'm1', status: 'pending',
  notes: null, applied_at: '2026-10-01T12:00:00Z',
  vacancy: { title: 'Logística', position: null, committee: { id: 'c1', name: 'Sede Escazú', parent: { name: 'Staff' } } },
  applicant: { first_name: 'Ana', last_name: 'Rojas', sede },
} as unknown as DbApplication)

describe('SRV-19 · la sede del aplicante', () => {
  it('llega hasta el dominio', () => {
    expect(toDomainApplication(fila({ name: 'Lindora' })).applicant_sede).toBe('Lindora')
  })

  it('y quien no tiene sede no rompe la fila: queda vacía', () => {
    // La ficha sin sede existe (importados viejos). Si el adapter reventara,
    // la PÁGINA entera se caería por una persona.
    expect(toDomainApplication(fila(null)).applicant_sede).toBe('')
  })

  it('sale en la hoja que se imprime y en el correo al encargado', () => {
    // Las dos salidas comparten `lineasDelDetalle`, así que con que esté acá
    // está en ambas — ese es el punto del módulo.
    const d = {
      nombre: 'Ana Rojas', telefono: null, correo: null, sede: 'Lindora',
      puesto: 'Logística', comite: 'Sede Escazú',
      ultimoEstudio: null, dirigente: null, telefonoDirigente: null,
    }
    expect(Object.fromEntries(lineasDelDetalle(d))['Sede']).toBe('Lindora')
    expect(detalleEnHtml(d)).toContain('Lindora')
  })

  it('y sin sede dice «No registrado», no queda en blanco', () => {
    const d = {
      nombre: 'Ana Rojas', telefono: null, correo: null, sede: null,
      puesto: 'Logística', comite: 'Sede Escazú',
      ultimoEstudio: null, dirigente: null, telefonoDirigente: null,
    }
    expect(Object.fromEntries(lineasDelDetalle(d))['Sede']).toBe('No registrado')
  })

  it('la bandeja tiene la columna y la pinta', () => {
    const src = sinComentarios(BANDEJA)
    expect(src).toMatch(/\['Aplicante', 'Sede',/)
    expect(src).toContain('a.applicant_sede')
  })

  it('el filtro de sede se manda al SERVIDOR, no se recorta en pantalla', () => {
    // La lista pagina de 25 en 25: filtrar en el cliente mostraría «3 de 40»
    // con el total diciendo otra cosa. Mismo criterio que comité y ubicación.
    const src = sinComentarios(BANDEJA)
    expect(src).toMatch(/u\.set\('sede', sedeFiltro\)/)
  })

  it('y es OTRO filtro que el de ubicación: la del puesto no es la de la persona', () => {
    const src = sinComentarios(BANDEJA)
    expect(src).toContain("u.set('location', ubicacionFiltro)")
    expect(src).toMatch(/u\.set\('sede', sedeFiltro\)/)
  })

  it('la query trae la sede en el MISMO select, sin una consulta por fila', () => {
    const src = readFileSync(QUERIES, 'utf8')
    const i = src.indexOf('const APPLICATION_SELECT = `')
    const bloque = src.slice(i, src.indexOf('`', i + 28))
    expect(bloque).toContain('sede:sedes(name)')
  })

  it('y filtrar por sede usa un join interno sobre el aplicante', () => {
    const src = readFileSync(QUERIES, 'utf8')
    const i = src.indexOf('const APPLICATION_SELECT_POR_SEDE = `')
    const bloque = src.slice(i, src.indexOf('`', i + 38))
    expect(bloque).toContain('!inner')
    expect(src).toContain("q.eq('applicant.sede_id', filters.sedeId)")
  })

  it('el endpoint lee el parámetro y lo cuenta como filtro', () => {
    // Sin lo segundo, pedir solo `?sede=…` caería por la rama de
    // back-compat y devolvería TODAS las aplicaciones sin filtrar.
    const src = sinComentarios('src/app/api/servers/applications/route.ts')
    expect(src).toContain("searchParams.get('sede')")
    expect(src).toMatch(/hasFilter = [^\n]*sedeId/)
  })
})
