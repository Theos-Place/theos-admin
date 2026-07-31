import { describe, it, expect, beforeEach } from 'vitest'
import { getHelpDoc, getHelpIndex, isValidHelpSlug, __clearHelpCache } from './loader'

// Test de SEGURIDAD contra el contenido REAL de content/ayuda: el loader es la
// única puerta a los .md, así que se prueba con los archivos que se van a servir.
// Si mañana alguien marca mal un archivo, este test lo caza.

const PUBLICO = 'entrar-al-sistema-por-primera-vez'
const INTERNO = 'ciclo-de-vida-de-un-grupo'          // roles de estudios
const INTERNO_PERFILES = 'encontrar-una-persona'     // roles de perfiles/coordinación

beforeEach(() => { __clearHelpCache() })

describe('isValidHelpSlug', () => {
  it('acepta slugs normales', () => {
    expect(isValidHelpSlug('entrar-al-sistema-por-primera-vez')).toBe(true)
    expect(isValidHelpSlug('paso2')).toBe(true)
  })

  it('rechaza path traversal y basura', () => {
    expect(isValidHelpSlug('../../../etc/passwd')).toBe(false)
    expect(isValidHelpSlug('..')).toBe(false)
    expect(isValidHelpSlug('con espacio')).toBe(false)
    expect(isValidHelpSlug('Mayuscula')).toBe(false)
    expect(isValidHelpSlug('')).toBe(false)
  })
})

describe('petición SIN sesión', () => {
  it('sirve el tutorial público', async () => {
    const doc = await getHelpDoc(PUBLICO, null)
    expect(doc?.visibilidad).toBe('publica')
    expect(doc?.content).toContain('Creá tu contraseña')
  })

  it('NO sirve un tutorial interno aunque se adivine la URL', async () => {
    expect(await getHelpDoc(INTERNO, null)).toBeNull()
    expect(await getHelpDoc(INTERNO_PERFILES, null)).toBeNull()
  })

  it('el índice trae solo lo público', async () => {
    const index = await getHelpIndex(null)
    expect(index.length).toBeGreaterThan(0)
    expect(index.every(d => d.visibilidad === 'publica')).toBe(true)
  })
})

describe('petición con rol miembro', () => {
  it('NO sirve un tutorial interno', async () => {
    expect(await getHelpDoc(INTERNO, ['miembro'])).toBeNull()
    expect(await getHelpDoc(INTERNO_PERFILES, ['miembro'])).toBeNull()
  })

  it('sí sirve el público', async () => {
    expect(await getHelpDoc(PUBLICO, ['miembro'])).not.toBeNull()
  })

  it('el índice del miembro no incluye lo interno', async () => {
    const index = await getHelpIndex(['miembro'])
    expect(index.some(d => d.slug === INTERNO)).toBe(false)
  })
})

describe('petición con el rol correcto', () => {
  it('el dirigente abre el ciclo de vida del grupo', async () => {
    const doc = await getHelpDoc(INTERNO, ['dirigente'])
    expect(doc?.titulo).toBe('Ciclo de vida de un grupo de estudio')
    expect(doc?.tipo).toBe('infografia')
  })

  it('pero el dirigente NO abre la guía de perfiles', async () => {
    expect(await getHelpDoc(INTERNO_PERFILES, ['dirigente'])).toBeNull()
  })

  it('admin abre todo', async () => {
    expect(await getHelpDoc(INTERNO, ['admin'])).not.toBeNull()
    expect(await getHelpDoc(INTERNO_PERFILES, ['admin'])).not.toBeNull()
  })
})

describe('slug inexistente', () => {
  it('devuelve null (la página responde 404 igual que si no te tocara)', async () => {
    expect(await getHelpDoc('no-existe-esta-guia', ['admin'])).toBeNull()
  })
})

describe('contenido real de content/ayuda', () => {
  it('todo archivo tiene título, sección válida y orden', async () => {
    const index = await getHelpIndex(['admin'])
    expect(index.length).toBeGreaterThanOrEqual(3)
    for (const d of index) {
      expect(d.titulo).not.toBe(d.slug)      // el título salió del frontmatter
      expect(d.orden).toBeLessThan(999)      // orden explícito
      expect(['infografia', 'tutorial']).toContain(d.tipo)
    }
  })

  it('los que declaran roles, los declaran de verdad (no lista vacía)', async () => {
    const index = await getHelpIndex(['admin'])
    for (const d of index.filter(x => x.visibilidad === 'roles')) {
      expect(d.roles.length).toBeGreaterThan(0)
    }
  })
})
