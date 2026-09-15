import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  mensajeFueraDeAudiencia, exigeIdentificarse, ajustesPorRestriccion,
  aQuienSeEvalua, FUERA_DE_AUDIENCIA,
} from './audiencia'
import type { Restriccion } from '@/lib/audiencia/restriccion'

const SERVIDOR = { id: 1, group: 'service', type: 'service', area: '', committee: '', position: '', status: 'active', from: '', to: '' } as const
const soloServidores: Restriccion = { conditions: [SERVIDOR], groups: [], ops: {} }

describe('mensajeFueraDeAudiencia', () => {
  it('dice por qué, no "no tenés permiso"', () => {
    // El link se comparte por WhatsApp y le llega a gente que no cumple: que
    // entienda de una que no es para ella.
    expect(mensajeFueraDeAudiencia(soloServidores)).toMatch(/^Este formulario es solo para: .+\.$/)
  })

  it('sin restricción cae en un mensaje genérico, no en "undefined"', () => {
    expect(mensajeFueraDeAudiencia(null)).toBe('Este formulario está limitado a cierto grupo de personas.')
  })

  it('el código del rechazo es estable', () => {
    expect(FUERA_DE_AUDIENCIA).toBe('fuera_de_audiencia')
  })
})

describe('una restricción obliga a identificarse', () => {
  it('con restricción, requires_auth queda forzado', () => {
    // Sin sesión no hay contra quién evaluar la condición: la restricción
    // quedaría escrita y sin aplicarse, que es lo peor de los dos mundos.
    expect(exigeIdentificarse(soloServidores)).toBe(true)
    expect(ajustesPorRestriccion(soloServidores)).toEqual({ requires_auth: true })
  })

  it('sin restricción no se toca nada: un form público sigue público', () => {
    expect(exigeIdentificarse(null)).toBe(false)
    expect(ajustesPorRestriccion(null)).toBeNull()
    expect(ajustesPorRestriccion({ conditions: [], groups: [], ops: {} })).toBeNull()
  })
})

describe('aQuienSeEvalua', () => {
  it('normalmente, a quien llena', () => {
    expect(aQuienSeEvalua({ autorId: 'staff' })).toBe('staff')
  })

  it('"a nombre de": al titular, no a quien teclea', () => {
    // Un coordinador llenando el formulario de un servidor no lo convierte a él
    // en el destinatario.
    expect(aQuienSeEvalua({ autorId: 'staff', aNombreDeId: 'titular' })).toBe('titular')
  })

  it('sin nadie, null — que el caller decida, no que pase de largo', () => {
    expect(aQuienSeEvalua({ autorId: null })).toBeNull()
  })
})

describe('FRM-5 · el cableado, no solo la regla', () => {
  // Los tests de arriba fijan la regla pura. Estos fijan que esté CONECTADA:
  // la feature se rompe en silencio si alguien quita una llamada, y entonces
  // la pantalla dice "solo para servidores" mientras cualquiera contesta.
  const leer = (p: string) => readFileSync(p, 'utf8')

  it('guardar una restricción fuerza requires_auth en el servidor', () => {
    // No alcanza con hacerlo en el builder: el PUT es alcanzable sin pasar por
    // la pantalla.
    const q = leer('src/lib/supabase/queries/forms.ts')
    expect(q).toMatch(/ajustesPorRestriccion\(restriccion\)/)
    expect(q).toMatch(/conRestriccionNormalizada\(input\)/)
    expect(q).toMatch(/conRestriccionNormalizada\(patch\)/)
  })

  it('el POST de respuesta pasa a nombre de quién se llena', () => {
    // FRM-4 + FRM-5: la audiencia describe al titular, no a quien teclea.
    expect(leer('src/app/api/forms/[id]/responses/route.ts')).toMatch(/aNombreDeId:/)
  })

  it('el listado esconde los formularios fuera de audiencia', () => {
    expect(leer('src/app/api/forms/route.ts')).toMatch(/formIdsFueraDeAudiencia/)
  })

  it('la ruta pública mira la restricción, no solo las banderas', () => {
    // Una restricción ya fuerza requires_auth, así que esto es redundante — y
    // por eso está: si alguna vez llega una por SQL directo sin el flag, la
    // diferencia es que cualquiera conteste un formulario restringido.
    expect(leer('src/app/api/public/forms/[id]/responder/route.ts')).toMatch(/audience_restrictions/)
    expect(leer('src/lib/forms/public-access.ts')).toMatch(/tieneAudienciaRestringida\(f\)/)
  })

  it('el guard de llenado evalúa la audiencia ANTES que lo demás', () => {
    const g = leer('src/lib/supabase/queries/form-fill-access.ts')
    const audiencia = g.indexOf('miembroEnLaAudiencia')
    const staffPasa = g.indexOf('if (input.isStaff) return { allowed: true }')
    expect(audiencia).toBeGreaterThanOrEqual(0)
    // Si el atajo del staff fuera primero, el "a nombre de" se saltaría la
    // restricción — que es justo el caso que el brief pedía cubrir.
    expect(audiencia).toBeLessThan(staffPasa)
  })
})
