/**
 * El logo de la pantalla de entrar aparece en DOS lugares distintos y solo uno
 * debe verse a la vez:
 *   · el panel decorativo oscuro, `hidden lg:flex` (logo blanco)
 *   · arriba del formulario, `lg:hidden` (logo oscuro, fondo claro)
 *
 * Son complementarios EN EL MISMO breakpoint. Si alguien mueve uno a `md` y deja
 * el otro en `lg`, entre 768 y 1024 se ven los dos (duplicado) o ninguno (que es
 * el bug que había: abajo de lg no había logo en ninguna parte). Los dos casos
 * son invisibles en una revisión rápida porque solo pasan en un rango de anchos.
 *
 * Comprobado además en navegador a 375, 1023 y 1024: exactamente 1 logo visible.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const layout = readFileSync('src/app/(auth)/layout.tsx', 'utf8')

describe('el logo de la pantalla de entrar', () => {
  it('el panel decorativo se muestra SOLO desde lg', () => {
    expect(layout).toContain('hidden lg:flex')
  })

  it('el logo del formulario se oculta EXACTAMENTE desde lg', () => {
    expect(layout).toContain('lg:hidden')
  })

  it('los dos usan el mismo breakpoint, así que nunca coinciden ni dejan hueco', () => {
    const panel = layout.match(/hidden (\w+):flex/)?.[1]
    const movil = layout.match(/mb-10 flex justify-center (\w+):hidden/)?.[1]
    expect(panel).toBe('lg')
    expect(movil).toBe(panel)
  })

  it('cada uno usa la versión de logo que su fondo necesita', () => {
    // Blanco sobre el panel navy; oscuro sobre el panel claro. Cruzarlos deja
    // un logo invisible, que se ve igual que "no hay logo".
    expect(layout).toContain('/logo-theos-white.png')
    expect(layout).toContain('/logo-theos-original.png')
  })

  it('hay exactamente dos logos en el layout, no más', () => {
    expect(layout.match(/alt="Theos Place"/g)?.length).toBe(2)
  })
})
