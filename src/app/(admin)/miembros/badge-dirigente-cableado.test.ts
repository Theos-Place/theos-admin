import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DIR-8 · El indicador «Dirigente» del perfil tiene que comportarse como los
 * otros cuatro: aparecer siempre, apagado cuando no aplica.
 *
 * El bug era una sola condición —`{member.es_dirigente && …}`— y volver a
 * ponerla no rompe ningún test de datos: simplemente el indicador se
 * esconde otra vez y el perfil vuelve a contradecirse.
 */
const header = readFileSync(
  join(process.cwd(), 'src/app/(admin)/miembros/[id]/_components/MemberHeader.tsx'), 'utf8')

describe('DIR-8 · el indicador «Dirigente»', () => {
  it('se decide con la regla compartida, no con un flag suelto', () => {
    expect(header).toMatch(/badgeDeDirigente\(\{/)
    expect(header).toMatch(/\{badge\.mostrar && \(/)
  })

  it('mira la FICHA y no solo si está activo', () => {
    // `es_dirigente` es «activo en el comité»; `is_dirigente` es «tiene
    // ficha». Mirar solo el primero era el bug.
    expect(header).toMatch(/tieneFicha: !!member\.is_dirigente/)
    expect(header).toMatch(/activo: !!member\.es_dirigente/)
  })

  it('ya NO se esconde cuando la persona está inactiva', () => {
    expect(header).not.toMatch(/\{member\.es_dirigente && \(/)
  })

  it('pasa tooltip también para el estado apagado', () => {
    // Sin `inactiveTooltip` el ícono apagado no explica nada y se lee como
    // un error de la pantalla.
    expect(header).toMatch(/inactiveTooltip=\{badge\.tooltip\}/)
  })
})
