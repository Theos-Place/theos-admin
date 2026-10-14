/**
 * El adjunto de un formulario público no pide sesión (2026-10-14).
 *
 * «Matrimonios - Octubre 2026» es público y sin login; la gente respondía
 * bien pero al adjuntar el comprobante veía «No autenticado», porque el campo
 * de imagen subía por la ruta con sesión. Dos 401 en los logs del día.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('adjunto público', () => {
  it('la página pública sube por la ruta pública', () => {
    expect(sin('src/components/forms/PublicFormFiller.tsx')).toContain('uploadUrl={`/api/public/forms/${formId}/upload-attachment`}')
    expect(sin('src/components/forms/PublicField.tsx')).toContain('uploadUrl={uploadUrl}')
  })

  it('la ruta pública NO exige sesión, pero SÍ que el formulario esté abierto', () => {
    const src = sin('src/app/api/public/forms/[id]/upload-attachment/route.ts')
    expect(src).not.toContain('requireRoles')
    expect(src).toContain('esFormularioAbierto(f)')
    expect(src).toContain("formWindowStatus(f)")
    expect(src).toContain('rateLimit(')
  })

  it('las reglas del archivo son las mismas que con sesión', () => {
    const pub = sin('src/app/api/public/forms/[id]/upload-attachment/route.ts')
    const priv = sin('src/app/api/forms/upload-attachment/route.ts')
    for (const r of ["const BUCKET = 'form-uploads'", 'const MAX_BYTES = 5 * 1024 * 1024', "['image/jpeg', 'image/png', 'image/webp']"]) {
      expect(pub).toContain(r); expect(priv).toContain(r)
    }
  })

  it('con sesión, el campo sigue subiendo por la ruta de siempre', () => {
    expect(sin('src/components/forms/ImageAnswerField.tsx')).toContain("uploadUrl = '/api/forms/upload-attachment'")
  })
})
