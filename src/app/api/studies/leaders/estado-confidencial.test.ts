import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DIR-8 · El endpoint del estado toca datos de dos niveles distintos.
 *
 * El ESTADO lo editan los tres roles que mantienen dirigentes. Las NOTAS y
 * la BANDERITA solo coordinación. Si el handler guardara todo lo que llega,
 * `editor_dirigentes` podría escribir una nota confidencial mandando el
 * campo a mano — su pantalla no se lo muestra, pero la ruta sí lo acepta.
 *
 * Esto se vigila en el fuente porque es una condición, y una condición que
 * se borra no rompe ningún test de datos: simplemente empieza a guardar de
 * más, en silencio.
 */
const fuente = readFileSync(
  join(process.cwd(), 'src/app/api/studies/leaders/[id]/estado/route.ts'), 'utf8')

describe('DIR-8 · PATCH del estado del dirigente', () => {
  it('exige rol para entrar', () => {
    expect(fuente).toMatch(/requireRoles\(\.\.\.DIRIGENTES_ADMIN_ROLES\)/)
  })

  it('valida con la MISMA función que la pantalla', () => {
    // Tres capas para la misma regla: pantalla, endpoint y CHECK. Si el
    // endpoint no validara, un script escribiría un estado que la ficha no
    // sabe mostrar.
    expect(fuente).toMatch(/motivoInvalido\(estado\)/)
  })

  it('las NOTAS solo se guardan si quien pide puede escribirlas', () => {
    const i = fuente.indexOf('puedeEscribirNotas(auth.ctx.roles)')
    expect(i, 'no se consulta el permiso de notas').toBeGreaterThan(-1)
    // Y la asignación de los campos va DENTRO de esa condición.
    const despues = fuente.slice(i, i + 400)
    expect(despues).toMatch(/CAMPOS_RESERVADOS/)
  })

  it('la BANDERITA también', () => {
    expect(fuente).toMatch(/if \(puedeVerBanderita\(auth\.ctx\.roles\)\) cambios\.revision/)
  })

  it('ningún campo de nota se asigna fuera de la condición', () => {
    // El modo de fallo: alguien agrega `nota_general` al objeto base «para
    // que sea más simple» y la restricción se evapora.
    const base = fuente.slice(
      fuente.indexOf('const cambios: Record<string, unknown> = {'),
      fuente.indexOf('// La BANDERITA y las NOTAS'))
    for (const c of ['nota_revision', 'nota_cdeb', 'nota_general', 'revision:']) {
      expect(base.includes(c), `${c} se guarda sin revisar permiso`).toBe(false)
    }
  })

  it('`is_active` se mantiene en espejo del estado base', () => {
    // Hay código viejo que todavía la lee; si quedaran desincronizadas, un
    // dirigente activo aparecería inactivo en media app.
    expect(fuente).toMatch(/is_active: estado_base === 'activo'/)
  })
})
