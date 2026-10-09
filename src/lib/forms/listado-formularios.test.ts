import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Dos cosas del listado y el editor de formularios, pedidas el 2026-10-09.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const LISTA = sinComentarios('src/app/(admin)/formularios/page.tsx')
const BUILDER = sinComentarios('src/app/(admin)/formularios/_components/FormBuilder.tsx')
const API = sinComentarios('src/app/api/forms/route.ts')

describe('desactivar desde el editor', () => {
  it('el editor ofrece PUBLICAR y DESACTIVAR, no solo publicar', () => {
    /**
     * Solo estaba «Publicar». Una vez activo, desde el editor no había forma
     * de apagarlo: había que volver al listado y buscar el menú de los tres
     * puntos. Y quien recibe un formulario COMPARTIDO aterriza justo en el
     * editor —es su destino en `accionesDelFormulario`—, así que para esa
     * persona la acción no existía.
     */
    expect(BUILDER).toContain('Publicar')
    expect(BUILDER).toContain('Desactivar')
    expect(BUILDER).toMatch(/handleSave\('draft'\)/)
  })

  it('el permiso NO se tocó: sigue siendo el del guard de siempre', () => {
    // `requireFormEdit` ya aceptaba el acceso puntual desde el 2026-09-11, y
    // `is_active` viaja en el mismo PUT que todo lo demás. Faltaba el botón.
    const guard = sinComentarios('src/lib/auth/event-guard.ts')
    expect(guard).toContain('hasFormAccessGrant(formId, ctx.memberId)')
  })
})

describe('el filtro «creados por mí»', () => {
  it('lo decide el SERVIDOR, no el navegador', () => {
    /**
     * `forms.created_by` es un id de `auth.users` que la sesión del navegador
     * no conoce. Comparando en el servidor, el filtro funciona sin meterle a
     * la pantalla un identificador nuevo que después alguien use para otra
     * cosa.
     */
    expect(API).toContain('mio: !!ctx.userId && f.created_by === ctx.userId')
    expect(LISTA).not.toContain('created_by ===')
  })

  it('se aplica en el filtrado y se combina con los otros', () => {
    expect(LISTA).toContain('if (soloMios && !f.mio) return false')
    // En la misma lista que categoría y estado: son preguntas distintas que
    // se acumulan, no opciones de un mismo selector.
    expect(LISTA).toMatch(/\[forms, categoryFilter, estadoFilter, query, soloMios\]/)
  })

  it('no se ofrece si la persona no creó ninguno', () => {
    // Un filtro que siempre deja la lista vacía es una promesa falsa.
    expect(LISTA).toContain('forms.some(f => f.mio)')
  })

  it('y las dos ramas del endpoint lo marcan: con módulo y con acceso puntual', () => {
    // Marcar solo una dejaba el filtro mudo para la mitad de la gente: con el
    // módulo se devuelve `forms`; con acceso puntual, `visibles`.
    expect(API).toContain('marcar(forms)')
    expect(API).toContain('marcar(visibles)')
    expect(API).not.toMatch(/NextResponse\.json\((forms|visibles)\)/)
  })
})

describe('quién creó cada formulario', () => {
  it('se guarda al crear: la columna existía y nadie la escribía', () => {
    /**
     * Los 41 formularios de producción tenían `created_by` en null (medido el
     * 2026-10-09 al armar este filtro). Sin esto, «creados por mí» no habría
     * encontrado nada para nadie — el filtro se vería bien y no serviría.
     */
    const q = sinComentarios('src/lib/supabase/queries/forms.ts')
    const fn = q.slice(q.indexOf('export async function createForm'))
    expect(fn.slice(0, 600)).toContain('created_by: creadoPor')
    expect(API).toContain('createForm(formToWriteInput(body), formToFields(body), auth.ctx.userId)')
  })

  it('y sin sesión no se inventa un autor', () => {
    // Un `created_by: undefined` dejaría la columna en null, que es la verdad.
    const q = sinComentarios('src/lib/supabase/queries/forms.ts')
    const fn = q.slice(q.indexOf('export async function createForm'))
    expect(fn.slice(0, 600)).toContain('...(creadoPor ? { created_by: creadoPor } : {})')
  })
})
