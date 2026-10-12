import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * MAT-3 · El guard del borrado tiene que estar ENCHUFADO, y su motivo tiene
 * que llegar al usuario.
 *
 * Lo que falló en producción no fue que faltara la regla: fue que el borrado
 * no miraba el dinero. Y si el motivo cayera en el catch genérico, la
 * pantalla diría «Error interno» y nadie sabría que hay ₡10.000 en juego.
 */
const ruta = readFileSync(
  join(process.cwd(), 'src/app/api/studies/groups/[id]/route.ts'), 'utf8')
const query = readFileSync(
  join(process.cwd(), 'src/lib/supabase/queries/studies.ts'), 'utf8')

function cuerpoDe(nombre: string): string {
  const i = query.indexOf(`export async function ${nombre}(`)
  expect(i, `no existe ${nombre}()`).toBeGreaterThan(-1)
  const sig = query.indexOf('\nexport ', i + 1)
  return query.slice(i, sig === -1 ? query.length : sig)
}

describe('DELETE de un grupo', () => {
  const cuerpo = cuerpoDe('deleteGroup')

  it('consulta la regla antes de borrar nada', () => {
    const regla = cuerpo.indexOf('razonParaNoBorrarGrupo')
    const borra = cuerpo.indexOf(".delete().eq('group_id'")
    expect(regla).toBeGreaterThan(-1)
    expect(borra).toBeGreaterThan(-1)
    expect(regla, 'la regla se evalúa DESPUÉS de borrar').toBeLessThan(borra)
  })

  it('un cobro cancelado no bloquea: ese ya no es plata', () => {
    expect(cuerpo).toMatch(/!== 'cancelado'/)
  })

  it('cuenta las transferidas y las completadas', () => {
    expect(cuerpo).toMatch(/'transferred'/)
    expect(cuerpo).toMatch(/'completed'/)
  })

  it('el motivo llega al usuario como 409, no como «Error interno»', () => {
    expect(ruta).toMatch(/error: r\.razon/)
    expect(ruta).toMatch(/status: 409/)
  })
})
