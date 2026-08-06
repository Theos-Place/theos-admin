// FRM-2 · Encabezado del formulario: validación de la subida y render.
import { describe, it, expect } from 'vitest'
import {
  validateHeroUpload, heroExtension, HERO_MAX_BYTES, HERO_BUCKET,
} from './hero-upload'
import { hasHero } from '@/components/forms/FormHero'
import { formToWriteInput, formToPartialWriteInput } from './form-mapper'

describe('validación de la imagen del encabezado', () => {
  it('acepta JPG, PNG y WEBP dentro del tamaño', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateHeroUpload({ type, size: 1024 })).toBeNull()
    }
  })

  it('rechaza formatos que los clientes no muestran parejo', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/html']) {
      expect(validateHeroUpload({ type, size: 1024 })?.error).toMatch(/formato no permitido/i)
    }
  })

  it('rechaza pasado el máximo, y acepta justo en el límite', () => {
    expect(validateHeroUpload({ type: 'image/png', size: HERO_MAX_BYTES })).toBeNull()
    expect(validateHeroUpload({ type: 'image/png', size: HERO_MAX_BYTES + 1 })?.error).toMatch(/5 MB/)
  })

  it('la extensión sale del MIME, no del nombre del archivo (que miente)', () => {
    expect(heroExtension('image/jpeg')).toBe('jpg')
    expect(heroExtension('image/webp')).toBe('webp')
    expect(heroExtension('cualquier/cosa')).toBe('bin')
  })

  it('el bucket es propio de formularios, no el de eventos', () => {
    expect(HERO_BUCKET).toBe('form-heroes')
  })
})

describe('hasHero — sin encabezado, el formulario se ve igual que siempre', () => {
  it('vacío o nulo: no hay hero', () => {
    expect(hasHero(null)).toBe(false)
    expect(hasHero({})).toBe(false)
    expect(hasHero({ hero_image_url: null, hero_title: null, hero_subtitle: null })).toBe(false)
  })

  it('alcanza con cualquiera de las tres piezas', () => {
    expect(hasHero({ hero_image_url: 'https://x/y.png' })).toBe(true)
    expect(hasHero({ hero_title: 'Campa 2026' })).toBe(true)
    expect(hasHero({ hero_subtitle: 'Te esperamos' })).toBe(true)
  })
})

describe('mapeo al guardar', () => {
  it('un campo en blanco se guarda como null, no como cadena vacía', () => {
    const w = formToWriteInput({ name: 'F', hero_title: '   ', hero_subtitle: '' })
    expect(w.hero_title).toBeNull()
    expect(w.hero_subtitle).toBeNull()
  })

  it('los valores reales pasan recortados', () => {
    const w = formToWriteInput({ name: 'F', hero_title: '  Campa 2026 ', hero_image_url: 'https://x/y.png' })
    expect(w.hero_title).toBe('Campa 2026')
    expect(w.hero_image_url).toBe('https://x/y.png')
  })

  it('el patch parcial NO toca el encabezado si el body no lo trae', () => {
    // Si no, editar solo el nombre borraría el flyer.
    const p = formToPartialWriteInput({ name: 'Otro nombre' })
    expect('hero_image_url' in p).toBe(false)
    expect('hero_title' in p).toBe(false)
  })

  it('mandar null explícito sí lo borra (quitar la imagen)', () => {
    const p = formToPartialWriteInput({ hero_image_url: null })
    expect(p.hero_image_url).toBeNull()
  })

  it('la imagen se guarda como URL, nunca como base64 (lección de EVE-2)', () => {
    // No hay validación de esquema acá, pero sí dejamos constancia de la regla:
    // el builder sube a Storage y guarda el link que devuelve el endpoint.
    const w = formToWriteInput({ name: 'F', hero_image_url: 'https://proyecto.supabase.co/storage/v1/object/public/form-heroes/abc.png' })
    expect(w.hero_image_url).toMatch(/^https:\/\//)
    expect(w.hero_image_url).not.toMatch(/^data:/)
  })
})
