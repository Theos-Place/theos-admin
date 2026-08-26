// "Agregar estudio" no avisaba si la persona YA tenía ese estudio registrado.
// El 2026-08-25 alguien registró el mismo SCJ dos veces, con orígenes distintos
// ("Unidos por Cristo" y "CIU"), sin que nada lo advirtiera.
//
// La decisión: AVISAR, no bloquear. Repetir un estudio es legítimo —hay gente
// que lo lleva otra vez— así que quien registra tiene que poder decidirlo. Lo
// único que se rechaza en el servidor es el duplicado EXACTO (mismo plan, misma
// fecha), que no es una decisión de nadie sino un doble clic.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MODAL = readFileSync('src/components/studies/AddExternalStudyButton.tsx', 'utf8')
const RUTA = readFileSync('src/app/api/members/[id]/studies/route.ts', 'utf8')

describe('el formulario avisa antes de duplicar', () => {
  it('consulta lo que la persona ya tiene', () => {
    expect(MODAL).toContain('/studies`')
    expect(MODAL).toContain('yaTiene')
  })

  it('avisa pero NO deshabilita el botón de guardar', () => {
    // Si bloqueara, no se podría registrar a quien de verdad repitió el estudio.
    const guardar = MODAL.slice(MODAL.indexOf('onClick={handleSave}'))
    expect(guardar.slice(0, 260)).not.toMatch(/disabled=\{[^}]*yaTiene/)
  })

  it('el aviso dice qué hacer, no solo que hay algo', () => {
    expect(MODAL).toContain('Si de verdad lo llevó otra vez, seguí')
  })
})

describe('el servidor rechaza solo el duplicado EXACTO', () => {
  it('compara plan Y fecha, no solo el plan', () => {
    expect(RUTA).toContain("y.code === b.plan_code && y.date === (b.date ?? null)")
  })

  it('responde 409 con un código que el cliente puede distinguir', () => {
    expect(RUTA).toContain("code: 'estudio_duplicado'")
    expect(RUTA).toContain('{ status: 409 }')
  })
})
