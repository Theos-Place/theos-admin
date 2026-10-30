import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * FRM-8 · Del editor a las respuestas y de vuelta, con el mismo gate que ya
 * tiene cada vista. Las pruebas leen el código porque el permiso lo resuelve
 * el servidor (form_access_grants, event_managers) y la pantalla solo dibuja.
 */
describe('FRM-8 · enlace entre el editor y las respuestas', () => {
  const builder = readFileSync('src/app/(admin)/formularios/_components/FormBuilder.tsx', 'utf8')
  it('el editor pide el acceso y ofrece «Ver respuestas (N)» solo si puede verlas', () => {
    expect(builder).toContain('?export_access=1')
    expect(builder).toContain('formId && respuestas?.puede && (')
    expect(builder).toContain('Ver respuestas ({respuestas.count})')
    expect(builder).toContain('href={`/formularios/${formId}/respuestas`}')
  })
  it('el servidor contesta «respuestas» con la misma regla que las rutas de respuestas', () => {
    const ruta = readFileSync('src/app/api/forms/[id]/route.ts', 'utf8')
    expect(ruta).toContain('respuestas: (await puedeVerRespuestas(id, auth.ctx)).puede')
    const guard = readFileSync('src/lib/auth/respuestas-guard.ts', 'utf8')
    expect(guard).toContain('const v = await puedeVerRespuestas(formId, ctx)')
  })
  it('el camino inverso: desde las respuestas, «Editar formulario» con el permiso de edición', () => {
    const respuestas = readFileSync('src/app/(admin)/formularios/[id]/respuestas/page.tsx', 'utf8')
    expect(respuestas).toContain("const canEditForm = can('formularios', 'edit')")
    expect(respuestas).toContain('{canEditForm && (')
    expect(respuestas).toContain('Editar formulario')
  })
})
