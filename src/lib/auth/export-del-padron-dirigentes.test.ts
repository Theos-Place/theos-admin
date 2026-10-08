import { describe, it, expect } from 'vitest'
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'
import { puedeExportarDatosPersonales } from '@/lib/auth/datos-personales-en-export'
import type { RoleId } from '@/types/auth'

const exporta = (r: string) => hasModulePermission([r] as RoleId[], 'miembros', 'export')

/**
 * La encargada de dirigentes puede bajar listas de miembros (2026-09-30).
 *
 * No podía, y las necesita para trabajar. Ya VEÍA el padrón completo, así que
 * el cambio no le abre gente nueva: le deja bajar lo que ya tenía en pantalla.
 */
describe('quién puede exportar el padrón', () => {
  it('la coordinación de dirigentes, ahora sí', () => {
    expect(exporta('coordinador_dirigentes')).toBe(true)
  })

  it('y el rol de editar miembros, que ya podía', () => {
    // `editor_perfiles` tenía `export` desde antes: no hizo falta tocarlo.
    expect(exporta('editor_perfiles')).toBe(true)
  })

  it('dirección y admin, como siempre', () => {
    expect(exporta('direccion')).toBe(true)
    expect(exporta('admin')).toBe(true)
  })

  it('pero NO se le abrió a quien solo MIRA el padrón', () => {
    /**
     * Seis roles ven el padrón entero sin poder bajarlo, y esa distinción es
     * deliberada: mirar una ficha deja rastro y es de a una; un export son
     * 14.000 personas en un archivo que se reenvía. Si esto se cae, alguien
     * amplió el export de más.
     */
    for (const r of ['coordinador_estudios', 'coordinador_servidores', 'encargado_staff',
                     'comunicaciones', 'finanzas', 'lider_comite', 'dirigente', 'miembro']) {
      expect(exporta(r), r).toBe(false)
    }
  })
})

describe('el efecto que no se ve: los datos personales de formularios', () => {
  /** El camino del PADRÓN, que es el que esta coordinación usa. Desde el
   *  2026-10-07 hay un segundo camino —tener el formulario compartido—, pero
   *  no cambia nada de lo de acá: los caminos se SUMAN. */
  const porElPadron = (roles: string[]) =>
    puedeExportarDatosPersonales({ roles: roles as RoleId[], scope: 'admin' })

  it('con export y alcance total, también puede sumarlos', () => {
    /**
     * `datos-personales-en-export` acepta `miembros` con alcance total Y
     * `export`. Al darle `export` a la coordinación de dirigentes, también
     * gana las columnas de cédula, fecha de nacimiento y alergias en el
     * export de respuestas (FRM-6). Es coherente con ver el padrón entero,
     * pero queda fijado acá para que sea una decisión visible y no una
     * sorpresa.
     */
    expect(porElPadron(['coordinador_dirigentes'])).toBe(true)
  })

  it('y quien solo ve el padrón sigue sin poder POR ESE CAMINO', () => {
    /**
     * `comunicaciones` pasó a poder el 2026-10-07, pero por el OTRO camino:
     * tiene `formularios:export`. No se le abrió el padrón — lo que ve son
     * las fichas de quienes respondieron ese formulario.
     */
    expect(porElPadron(['coordinador_estudios'])).toBe(false)
    expect(hasModulePermission(['comunicaciones'] as RoleId[], 'miembros', 'export')).toBe(false)
  })
})

describe('el alcance no se tocó', () => {
  it('sigue viendo el padrón completo, ni más ni menos', () => {
    expect(moduleScope(['coordinador_dirigentes'] as RoleId[], 'miembros')).toBe('all')
  })

  it('y no ganó crear ni editar fichas', () => {
    // Exportar es bajar lo que ya ve; no es administrar el padrón.
    expect(hasModulePermission(['coordinador_dirigentes'] as RoleId[], 'miembros', 'create')).toBe(false)
    expect(hasModulePermission(['coordinador_dirigentes'] as RoleId[], 'miembros', 'edit')).toBe(false)
  })
})
