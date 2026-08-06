import { describe, it, expect } from 'vitest'
import {
  parseHelpDoc, canViewHelpDoc, visibleHelpDocs, groupHelpBySection,
  searchHelpDocs, helpNeighbors, type HelpDocMeta,
} from './visibility'
import type { RoleId } from '@/lib/auth/roles'

const doc = (over: Partial<HelpDocMeta> = {}): HelpDocMeta => ({
  slug: 'x', titulo: 'X', seccion: 'Estudios', tipo: 'tutorial',
  visibilidad: 'roles', roles: [], orden: 1, resumen: null, ...over,
})

describe('parseHelpDoc', () => {
  it('lee el frontmatter completo', () => {
    const d = parseHelpDoc('mi-guia', `---
titulo: Mi guía
seccion: Pagos
tipo: infografia
roles: [dirigente, folletos]
orden: 3
resumen: Un resumen
---

# Hola

Cuerpo.`)
    expect(d).toMatchObject({
      slug: 'mi-guia', titulo: 'Mi guía', seccion: 'Pagos', tipo: 'infografia',
      visibilidad: 'roles', roles: ['dirigente', 'folletos'], orden: 3, resumen: 'Un resumen',
    })
    expect(d.content.startsWith('# Hola')).toBe(true)
  })

  it('acepta la lista de roles con guiones', () => {
    const d = parseHelpDoc('g', `---
titulo: G
roles:
  - dirigente
  - direccion
---
Cuerpo`)
    expect(d.roles).toEqual(['dirigente', 'direccion'])
  })

  it('visibilidad publica y gestion', () => {
    expect(parseHelpDoc('a', '---\ntitulo: A\nvisibilidad: publica\n---\nx').visibilidad).toBe('publica')
    expect(parseHelpDoc('a', '---\ntitulo: A\nvisibilidad: gestion\n---\nx').visibilidad).toBe('gestion')
  })

  it('default RESTRICTIVO: sin visibilidad ni roles, no lo ve nadie salvo admin', () => {
    const d = parseHelpDoc('roto', '---\ntitulo: Roto\n---\ncuerpo')
    expect(d.visibilidad).toBe('roles')
    expect(d.roles).toEqual([])
    expect(canViewHelpDoc(d, null)).toBe(false)
    expect(canViewHelpDoc(d, ['direccion'])).toBe(false)
    expect(canViewHelpDoc(d, ['admin'])).toBe(true)
  })

  it('sección o tipo inválidos caen en un default seguro', () => {
    const d = parseHelpDoc('a', '---\ntitulo: A\nseccion: Inventada\ntipo: video\n---\nx')
    expect(d.seccion).toBe('Primeros pasos')
    expect(d.tipo).toBe('tutorial')
    expect(d.orden).toBe(999)
  })
})

describe('canViewHelpDoc', () => {
  const publico = doc({ visibilidad: 'publica' })
  const interno = doc({ roles: ['coordinador_estudios', 'direccion'] })
  const gestion = doc({ visibilidad: 'gestion' })

  it('lo público lo ve cualquiera, con o sin sesión', () => {
    expect(canViewHelpDoc(publico, null)).toBe(true)
    expect(canViewHelpDoc(publico, [])).toBe(true)
    expect(canViewHelpDoc(publico, ['miembro'])).toBe(true)
  })

  it('sin sesión NO se ve nada interno', () => {
    expect(canViewHelpDoc(interno, null)).toBe(false)
    expect(canViewHelpDoc(interno, [])).toBe(false)
    expect(canViewHelpDoc(gestion, null)).toBe(false)
  })

  it('el rol miembro tampoco ve lo interno', () => {
    expect(canViewHelpDoc(interno, ['miembro'])).toBe(false)
    expect(canViewHelpDoc(gestion, ['miembro'])).toBe(false)
  })

  it('los roles listados sí', () => {
    expect(canViewHelpDoc(interno, ['direccion'])).toBe(true)
    expect(canViewHelpDoc(interno, ['miembro', 'coordinador_estudios'])).toBe(true)
    expect(canViewHelpDoc(interno, ['dirigente'])).toBe(false)
  })

  it("'gestion' = cualquier rol que no sea solo miembro", () => {
    expect(canViewHelpDoc(gestion, ['dirigente'])).toBe(true)
    expect(canViewHelpDoc(gestion, ['folletos'])).toBe(true)
    expect(canViewHelpDoc(gestion, ['miembro'])).toBe(false)
  })

  it('admin ve todo', () => {
    expect(canViewHelpDoc(interno, ['admin'])).toBe(true)
    expect(canViewHelpDoc(gestion, ['admin'])).toBe(true)
    expect(canViewHelpDoc(doc({ roles: [] }), ['admin'])).toBe(true)
  })
})

describe('visibleHelpDocs', () => {
  const docs = [
    doc({ slug: 'pub', visibilidad: 'publica', orden: 2, titulo: 'Público' }),
    doc({ slug: 'est', roles: ['coordinador_estudios'], orden: 1, titulo: 'Estudios' }),
    doc({ slug: 'fin', roles: ['finanzas'], orden: 3, titulo: 'Finanzas' }),
  ]

  it('sin sesión, solo lo público', () => {
    expect(visibleHelpDocs(docs, null).map(d => d.slug)).toEqual(['pub'])
  })

  it('con rol, lo suyo + lo público, ordenado por orden', () => {
    expect(visibleHelpDocs(docs, ['coordinador_estudios'] as RoleId[]).map(d => d.slug))
      .toEqual(['est', 'pub'])
  })

  it('admin ve todo', () => {
    expect(visibleHelpDocs(docs, ['admin']).length).toBe(3)
  })
})

describe('groupHelpBySection', () => {
  it('agrupa en el orden de las secciones y sin vacías', () => {
    const groups = groupHelpBySection([
      doc({ slug: 'a', seccion: 'Finanzas' }),
      doc({ slug: 'b', seccion: 'Primeros pasos' }),
      doc({ slug: 'c', seccion: 'Primeros pasos', orden: 2 }),
    ])
    expect(groups.map(g => g.seccion)).toEqual(['Primeros pasos', 'Finanzas'])
    expect(groups[0].docs.map(d => d.slug)).toEqual(['b', 'c'])
  })
})

describe('searchHelpDocs', () => {
  const docs = [
    doc({ slug: 'a', titulo: 'Cómo me matriculo' }),
    doc({ slug: 'b', titulo: 'Ciclo de un evento', resumen: 'Check-in y cierre' }),
  ]

  it('sin query devuelve todo', () => {
    expect(searchHelpDocs(docs, '  ').length).toBe(2)
  })

  it('busca sin acentos ni mayúsculas, y también en el resumen', () => {
    expect(searchHelpDocs(docs, 'COMO').map(d => d.slug)).toEqual(['a'])
    expect(searchHelpDocs(docs, 'check').map(d => d.slug)).toEqual(['b'])
    expect(searchHelpDocs(docs, 'zzz')).toEqual([])
  })
})

describe('helpNeighbors', () => {
  const docs = [
    doc({ slug: 'e1', seccion: 'Estudios', orden: 1 }),
    doc({ slug: 'e2', seccion: 'Estudios', orden: 2 }),
    doc({ slug: 'p1', seccion: 'Pagos', orden: 1 }),
  ]

  it('anterior y siguiente dentro de la MISMA sección', () => {
    expect(helpNeighbors(docs, 'e1')).toEqual({ prev: null, next: docs[1] })
    expect(helpNeighbors(docs, 'e2')).toEqual({ prev: docs[0], next: null })
    // No cruza a otra sección.
    expect(helpNeighbors(docs, 'p1')).toEqual({ prev: null, next: null })
  })

  it('slug desconocido no revienta', () => {
    expect(helpNeighbors(docs, 'nope')).toEqual({ prev: null, next: null })
  })
})

// ── El centro de ayuda real ─────────────────────────────────────────────────
// Guard de contenido: los artículos de content/ayuda tienen que parsear bien.
// Un `seccion` mal escrito NO revienta — cae en "Primeros pasos" en silencio —,
// así que se vigila acá.
describe('los artículos publicados', () => {
  it('todos declaran una sección válida y un título', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const archivos = readdirSync('content/ayuda').filter(f => f.endsWith('.md'))
    expect(archivos.length).toBeGreaterThan(10)

    for (const f of archivos) {
      const doc = parseHelpDoc(f.replace(/\.md$/, ''), readFileSync(`content/ayuda/${f}`, 'utf8'))
      const declarada = /^seccion:\s*(.+)$/m.exec(readFileSync(`content/ayuda/${f}`, 'utf8'))?.[1]?.trim()
      expect(doc.titulo, `${f} sin título`).not.toBe(doc.slug)
      expect(doc.seccion, `${f}: sección "${declarada}" no existe`).toBe(declarada)
      expect(doc.resumen, `${f} sin resumen`).toBeTruthy()
      // Las de rol tienen que decir cuáles: `roles: []` no la ve nadie.
      if (doc.visibilidad === 'roles') {
        expect(doc.roles.length, `${f} con visibilidad de roles y sin roles`).toBeGreaterThan(0)
      }
    }
  })
})
