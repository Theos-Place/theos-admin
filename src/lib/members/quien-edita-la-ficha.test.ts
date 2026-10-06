import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ROLES_QUE_EDITAN_FICHA, puedeEditarFichaCompleta } from './quien-edita-la-ficha'
import { CAMPOS_AUTOEDITABLES } from './autoedicion'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('UX-7 · el botón «Editar» y el permiso real', () => {
  it('ser dueño de la ficha NO alcanza para el formulario completo', () => {
    /**
     * Es el bug entero. El formulario manda TODOS los campos y el endpoint
     * responde 403 —rechazando el guardado completo— si viene alguno que la
     * autoedición no permite. La persona llenaba todo y lo perdía.
     */
    expect(puedeEditarFichaCompleta(['miembro'])).toBe(false)
    expect(puedeEditarFichaCompleta([])).toBe(false)
    expect(puedeEditarFichaCompleta(['dirigente'])).toBe(false)
  })

  it('los roles de padrón sí, y admin siempre', () => {
    for (const r of ROLES_QUE_EDITAN_FICHA) {
      expect(puedeEditarFichaCompleta([r]), r).toBe(true)
    }
    expect(puedeEditarFichaCompleta(['admin'])).toBe(true)
  })

  it('la pantalla y el endpoint preguntan por la MISMA lista', () => {
    // Mientras la lista vivió solo en el endpoint, la pantalla no tenía con
    // qué ponerse de acuerdo — y de eso se trataba el bug.
    const ep = sinComentarios('src/app/api/members/[id]/route.ts')
    const pg = sinComentarios('src/app/(admin)/miembros/[id]/page.tsx')
    expect(ep).toContain('ROLES_QUE_EDITAN_FICHA')
    expect(pg).toContain('ROLES_QUE_EDITAN_FICHA')
    // Y nadie se quedó con la copia vieja escrita a mano.
    expect(ep).not.toContain("const STAFF_ROLES = ['editor_perfiles'")
  })

  it('sin permiso, el botón NO se pinta (no se deshabilita)', () => {
    // Un botón deshabilitado con tooltip no lo lee nadie, y acá además no
    // hay nada que explicar: esa persona se edita en sitio.
    const h = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberHeader.tsx')
    expect(h).toContain('onEdit?: () => void')
    expect(h).toContain('{onEdit && (')
  })
})

describe('UX-7 · la edición en sitio no deja huecos', () => {
  it('todo lo autoeditable se puede tocar desde el perfil', () => {
    /**
     * Si un campo legítimo solo se pudiera editar desde el formulario, al
     * esconder el formulario la persona se quedaría sin forma de ponerlo.
     * Pasaba con provincia, cantón y distrito.
     */
    const tab = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberPersonalTab.tsx')
    // Estos tres tienen su propio componente, no una Fila editable.
    const APARTE = ['dietary_restrictions', 'autorizacion_imagen']
    const faltan = CAMPOS_AUTOEDITABLES
      .filter(c => !APARTE.includes(c))
      .filter(c => !tab.includes(`columna="${c}"`))
    expect(faltan, `sin edición en sitio: ${faltan.join(', ')}`).toEqual([])
  })

  it('provincia sale de la lista compartida, no de un <option> suelto', () => {
    const form = sinComentarios('src/app/(admin)/miembros/[id]/editar/page.tsx')
    expect(form).toContain('PROVINCIAS_CR')
    expect(form).not.toContain('<option>Guanacaste</option>')
  })
})
