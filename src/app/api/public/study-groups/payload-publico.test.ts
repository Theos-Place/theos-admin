import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * EST-20 · Una página sin login tiene dos formas de salir mal, y las dos son
 * silenciosas:
 *
 *  1. MOSTRAR DE MÁS: un grupo que la matrícula interna no ofrece. Alguien
 *     llega de redes, crea una cuenta y su grupo no está. Para esa persona
 *     el sistema quedó mal, no el grupo.
 *  2. MANDAR DE MÁS: un campo que no se pinta pero viaja igual. Lo que llega
 *     al navegador es público aunque no se dibuje.
 */
const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: el comentario de la ruta nombra `requireRoles` a
 *  propósito, para explicar por qué NO lo lleva. */
const sinComentarios = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const ruta = sinComentarios(leer('src/app/api/public/study-groups/route.ts'))
const query = leer('src/lib/supabase/queries/studies.ts')

function cuerpoDe(nombre: string): string {
  const i = query.indexOf(`export async function ${nombre}(`)
  expect(i, `no existe ${nombre}()`).toBeGreaterThan(-1)
  const sig = query.indexOf('\nexport ', i + 1)
  return query.slice(i, sig === -1 ? query.length : sig)
}

describe('EST-20 · la ruta pública', () => {
  it('NO lleva requireRoles, y es a propósito', () => {
    expect(ruta).not.toMatch(/requireRoles|requireAccesoAReporte|requireModuleView/)
  })

  it('pero sí rate limit por IP', () => {
    // Lo único que la protege de ser martillada: no hay sesión que limitar.
    expect(ruta).toMatch(/rateLimit\(/)
    expect(ruta).toMatch(/clientIp\(/)
  })

  it('cachea corto, no indefinido', () => {
    expect(ruta).toMatch(/max-age=\d{1,3}\b/)
  })
})

describe('EST-20 · lo que viaja al navegador', () => {
  const cuerpo = cuerpoDe('getGruposPublicosNivel1')

  it('el filtro es el compartido, no uno escrito acá', () => {
    // Si alguien reimplementara el filtro, las dos definiciones podrían
    // divergir sin que nada falle — que es exactamente REP-15 otra vez.
    expect(cuerpo).toMatch(/seMuestraEnPublico\(/)
  })

  it('el precio sale de la función que COBRA, no de plan.cost', () => {
    // Nivel 1 cuesta 0 en el catálogo porque el esquema nuevo cobra el PAR.
    // Leer plan.cost habría puesto «gratis» en tres de los grupos abiertos
    // y la persona se encontraba el cobro al matricularse.
    expect(cuerpo).toMatch(/montoDelBloque\(/)
    expect(cuerpo).not.toMatch(/costo = Number\(plan\?\.cost/)
  })

  it('no manda ningún dato de los matriculados', () => {
    // Se leen sus estados para contar cupos, pero nada de eso sale.
    for (const campo of ['member_id', 'first_name:', 'email', 'phone', 'cedula']) {
      expect(cuerpo.split('out.push(')[1] ?? '', campo).not.toContain(campo)
    }
  })

  it('el payload es una whitelist explícita', () => {
    // Nada de `...fila`: lo que se manda se escribe campo por campo.
    const empuje = cuerpo.slice(cuerpo.indexOf('out.push('))
    expect(empuje).not.toMatch(/\.\.\.f[,\s}]/)
  })
})
