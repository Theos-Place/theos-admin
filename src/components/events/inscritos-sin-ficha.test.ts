import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('inscritos por el link público sin ficha (2026-10-19)', () => {
  const ruta = readFileSync('src/app/api/events/[id]/guest-responses/route.ts', 'utf8')
  it('mismo permiso que la lista de inscripciones del evento', () => {
    expect(ruta).toContain('requireEventAccess(id)')
  })
  it('lee SOLO las respuestas sin ficha del formulario de inscripción del evento', () => {
    expect(ruta).toContain(".eq('form_id', formId).is('member_id', null)")
  })
  it('se muestra en la pestaña de inscripciones', () => {
    expect(readFileSync('src/app/(admin)/eventos/[id]/page.tsx', 'utf8'))
      .toContain("tabEfectivo === 'inscripciones' && event.registration_form_id && <InscritosSinFicha eventId={id} />")
  })
})
