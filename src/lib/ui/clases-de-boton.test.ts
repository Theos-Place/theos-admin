import { describe, it, expect } from 'vitest'
import { clasesDeBoton } from './clases-de-boton'

const tiene = (c: string, clase: string) => c.split(' ').includes(clase)

describe('clases de botón', () => {
  it('por defecto es el primario: coral pill con texto blanco', () => {
    const c = clasesDeBoton()
    expect(tiene(c, 'bg-coral')).toBe(true)
    expect(tiene(c, 'text-white')).toBe(true)
    expect(tiene(c, 'rounded-full')).toBe(true)
  })

  it('el hover del primario OSCURECE, no aclara', () => {
    // El README del design system dice coral-soft. Con texto blanco eso da
    // 2.46:1 — ver la cabecera del módulo y `contrast.test.ts`.
    const c = clasesDeBoton({ variante: 'primario' })
    expect(tiene(c, 'hover:bg-coral-deep')).toBe(true)
    expect(c).not.toContain('coral-soft')
  })

  it('todos llevan foco visible: es requisito de AA y era lo que más se olvidaba', () => {
    for (const v of ['primario', 'secundario', 'navy', 'fantasma'] as const) {
      expect(clasesDeBoton({ variante: v })).toContain('focus-visible:ring-2')
    }
  })

  it('todos manejan el deshabilitado, incluso cuando el botón es un Link', () => {
    const c = clasesDeBoton()
    expect(tiene(c, 'disabled:opacity-40')).toBe(true)
    expect(tiene(c, 'disabled:pointer-events-none')).toBe(true)
  })

  it('el secundario no pinta fondo: solo borde, y el fondo llega en hover', () => {
    const c = clasesDeBoton({ variante: 'secundario' })
    expect(c).not.toMatch(/(?<![\w-])bg-(?!surface-low)/)
    expect(tiene(c, 'hover:bg-surface-low')).toBe(true)
  })

  it('la fantasma no tiene caja', () => {
    const c = clasesDeBoton({ variante: 'fantasma' })
    expect(c).not.toContain('rounded')
    expect(tiene(c, 'text-teal-deep')).toBe(true)
    // Subrayado, para no distinguirse solo por color — la lección de QA-1/M3.
    expect(tiene(c, 'hover:underline')).toBe(true)
  })

  it('el ancho es una opción, no clases que cada pantalla vuelve a escribir', () => {
    expect(tiene(clasesDeBoton({ ancho: 'full' }), 'w-full')).toBe(true)
    expect(tiene(clasesDeBoton({ ancho: 'flex' }), 'flex-1')).toBe(true)
    expect(clasesDeBoton({ ancho: 'auto' })).not.toContain('w-full')
  })

  it('el radio se puede conservar: hay 53 pantallas que no usan pill', () => {
    // Unificarlas es un cambio visible de diseño, y esa decisión no es del
    // refactor. Ver la cabecera del módulo.
    expect(tiene(clasesDeBoton({ radio: 'xl' }), 'rounded-xl')).toBe(true)
    expect(tiene(clasesDeBoton({ radio: 'xl' }), 'rounded-full')).toBe(false)
  })

  it('los tres tamaños se distinguen', () => {
    const t = (s: 'sm' | 'md' | 'lg') => clasesDeBoton({ tamano: s })
    expect(t('sm')).toContain('text-[13px]')
    expect(t('md')).toContain('text-sm')
    expect(t('lg')).toContain('font-semibold')
    expect(new Set([t('sm'), t('md'), t('lg')]).size).toBe(3)
  })

  it('el resplandor sale del token, nunca de un rgba a mano', () => {
    // Había botones con el coral retirado metido dentro de la sombra.
    const c = clasesDeBoton({ resplandor: true })
    expect(c).toContain('shadow-[var(--shadow-pulse)]')
    expect(c).not.toContain('rgba')
    expect(clasesDeBoton()).not.toContain('shadow')
  })

  it('no salen espacios dobles ni sobrantes', () => {
    for (const v of ['primario', 'secundario', 'navy', 'fantasma'] as const) {
      const c = clasesDeBoton({ variante: v, ancho: 'auto', resplandor: false })
      expect(c).toBe(c.trim())
      expect(c).not.toContain('  ')
    }
  })
})
