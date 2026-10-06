import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esDeOtraSede, textoDeOtraSede, EN_OTRA_SEDE, YA_REGISTRADO } from './checkin-duplicado'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('check-in en otra sede · el aviso', () => {
  it('dice DÓNDE y A QUÉ HORA, no solo «ya tiene uno»', () => {
    /**
     * Con la sede y la hora, quien está en la puerta sabe al instante si es
     * alguien que viene llegando de otra sede o si se equivocó de charla
     * hace cuatro minutos — que es el caso del 9 de setiembre.
     */
    const t = textoDeOtraSede('Catherine Segura', {
      sede: 'Pedregal Miércoles', checked_at: '2026-09-09T19:11:00-06:00',
    })
    expect(t).toContain('Catherine Segura')
    expect(t).toContain('Pedregal Miércoles')
    expect(t).toMatch(/7:11/)
    expect(t).toMatch(/¿Registrarla igual/)
  })

  it('PREGUNTA, no afirma que esté mal', () => {
    const t = textoDeOtraSede('Ana', { sede: 'Antares Miércoles', checked_at: '2026-10-05T19:00:00-06:00' })
    expect(t).not.toMatch(/error|no pod|inválid/i)
    expect(t).toContain('?')
  })

  it('su código es distinto del de «ya registrado»', () => {
    // Los dos van en 409 y cada uno lleva otra pantalla: si coincidieran, el
    // duplicado se trataría como un cambio de sede.
    expect(EN_OTRA_SEDE).not.toBe(YA_REGISTRADO)
    expect(esDeOtraSede(409, { code: EN_OTRA_SEDE })).toBe(true)
    expect(esDeOtraSede(409, { code: YA_REGISTRADO })).toBe(false)
    expect(esDeOtraSede(409, { code: 'not_registered' })).toBe(false)
    expect(esDeOtraSede(201, { code: EN_OTRA_SEDE })).toBe(false)
  })
})

describe('check-in en otra sede · el cableado', () => {
  it('AVISA pero NO bloquea: con la confirmación pasa', () => {
    /**
     * Hay casos legítimos —servir en una sede y asistir en otra— y bloquear
     * obligaría a pedir permiso con la fila esperando. Lo que faltaba no era
     * un candado: era que el error no fuera silencioso.
     */
    const r = sinComentarios('src/app/api/events/[id]/checkins/route.ts')
    expect(r).toContain('if (memberId && !body?.confirmar_otra_sede)')
    const ui = sinComentarios('src/app/(admin)/eventos/[id]/checkin/page.tsx')
    expect(ui).toContain('confirmar_otra_sede: true')
    expect(ui).toContain('Sí, registrarla acá')
  })

  it('si la revisión falla, el check-in se hace igual', () => {
    // Perder una asistencia real por un aviso sería peor que el problema.
    const r = sinComentarios('src/app/api/events/[id]/checkins/route.ts')
    expect(r).toMatch(/try \{[\s\S]{0,400}checkinEnOtraSedeHoy[\s\S]{0,400}\} catch/)
  })

  it('solo entre CHARLAS, y la sede sale del diccionario canónico', () => {
    const q = sinComentarios('src/lib/supabase/queries/events.ts')
    expect(q).toContain("evento.event_type !== 'charla'")
    expect(q).toContain('canonicalCharlaTitle')
    // Sin quitar el «Youth» antes de canonizar, el youth de una sede se
    // leería como otra sede y el aviso saltaría siempre.
    expect(q).toContain("replace(/\\s+Youth$/i, '')")
  })

  it('el día se mide en hora de COSTA RICA', () => {
    // Una charla de las 7 p.m. cae en el día siguiente si se compara en UTC,
    // y el aviso no saltaría nunca.
    const q = sinComentarios('src/lib/supabase/queries/events.ts')
    expect(q).toContain("timeZone: 'America/Costa_Rica'")
    expect(q).toContain('T00:00:00.000-06:00')
    expect(q).toContain('T23:59:59.999-06:00')
  })
})
