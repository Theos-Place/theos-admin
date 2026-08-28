/**
 * El estado 'en_revision' y qué debe y no debe cambiar.
 *
 * Nació de los 604 casos donde el grupo se cerró y la inscripción quedó en
 * 'enrolled' — el perfil decía "En curso" para estudios de hasta 2014 y llegaba
 * a pedir el pago de una matrícula terminada.
 *
 * La regla que estos tests fijan: el estado nuevo cambia lo que se MUESTRA, no
 * lo que se PERMITE. Si alguien lo "simplifica" tratándolo como una matrícula
 * cerrada cualquiera, se destraba pedir de nuevo un estudio que quizá ya se
 * llevó — y eso es resolver la duda asumiendo la respuesta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ELIG = readFileSync('src/lib/supabase/queries/studies-eligibility.ts', 'utf8')
const RUTA = readFileSync('src/app/api/studies/groups/[id]/enrollments/route.ts', 'utf8')

describe('qué NO destraba', () => {
  it("'en_revision' sigue contando como estudio tomado, así que no se puede volver a pedir", () => {
    expect(ELIG).toMatch(/enrolledCodes[\s\S]{0,400}en_revision/)
  })
})

describe('qué SÍ deja de contar', () => {
  it('no es una matrícula activa: active_enrollments solo mira enrolled', () => {
    expect(ELIG).toMatch(/active_enrollments\s*=\s*enrollments\s*\n?\s*\.filter\(e => e\.status === 'enrolled'/)
  })
})

describe('quién ve el botón', () => {
  const COMP = readFileSync('src/components/studies/ResolverInscripcion.tsx', 'utf8')

  it('la lista de la pantalla es la MISMA que exige el endpoint', () => {
    // Si se separan: o aparece un botón que responde 403, o alguien con acceso
    // deja de ver el botón sin que nadie lo note.
    for (const rol of ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin']) {
      expect(COMP, rol).toContain(`'${rol}'`)
    }
    expect(RUTA).toMatch(/requireRoles\('coordinador_estudios', 'coordinador_dirigentes', 'direccion'\)/)
  })

  it('sin rol no se pinta nada', () => {
    expect(COMP).toContain('if (!puede) return null')
  })
})

describe('cómo se resuelve', () => {
  it('solo desde en_revision: no puede pisar un resultado ya puesto', () => {
    const patch = RUTA.slice(RUTA.indexOf('export async function PATCH'))
    expect(patch).toContain(".eq('status', 'en_revision')")
  })

  it('la fecha es la del grupo, no la de hoy', () => {
    // Fechar hoy un estudio que terminó en 2014 le ensucia el expediente.
    const patch = RUTA.slice(RUTA.indexOf('export async function PATCH'))
    expect(patch).toMatch(/ends_at/)
    expect(patch).toContain("completed_at: resultado === 'aprobado' ? fecha : null")
  })

  it('reprobado y retirado exigen motivo; aprobado no', () => {
    const patch = RUTA.slice(RUTA.indexOf('export async function PATCH'))
    expect(patch).toContain("resultado !== 'aprobado' && !razon")
  })

  it('lo restringe a los roles de estudios', () => {
    expect(RUTA).toMatch(/requireRoles\('coordinador_estudios', 'coordinador_dirigentes', 'direccion'\)/)
  })
})
