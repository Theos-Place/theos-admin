import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esLaPreguntaDeLaCasa, esElCampoDeUbicacion, ofreceCasa, ultimaPorPersona, etiquetaDeCasa,
} from './ofrece-casa'
import { permisosDelRoster, recortarRoster, type FilaDeRoster } from './roster-por-alcance'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('EST-26 · reconocer la pregunta', () => {
  it('encuentra la pregunta real de producción', () => {
    expect(esLaPreguntaDeLaCasa('¿Podrías ofrecer tu casa u oficina para el estudio?')).toBe(true)
  })

  it('aguanta que le cambien el texto alrededor', () => {
    // Se busca un NÚCLEO corto, no la oración entera: un signo de más o un
    // «grupo» en vez de «estudio» no deberían dejar la columna vacía.
    expect(esLaPreguntaDeLaCasa('¿Podrías ofrecer tu casa para el grupo?')).toBe(true)
    expect(esLaPreguntaDeLaCasa('PODRIAS OFRECER TU CASA')).toBe(true)
  })

  it('no confunde otras preguntas', () => {
    for (const p of ['¿Tenés casa propia?', 'Ubicación', '¿Cómo escuchaste sobre Theos Place?', null]) {
      expect(esLaPreguntaDeLaCasa(p), String(p)).toBe(false)
    }
  })

  it('la ubicación se reconoce exacta, no por contener', () => {
    // «Ubicación del evento» o «Ubicación de la iglesia» son otra cosa.
    expect(esElCampoDeUbicacion('Ubicación')).toBe(true)
    expect(esElCampoDeUbicacion('ubicacion')).toBe(true)
    expect(esElCampoDeUbicacion('Ubicación del evento')).toBe(false)
  })
})

describe('EST-26 · leer la respuesta', () => {
  it('«Sí» con y sin tilde', () => {
    expect(ofreceCasa('Sí')).toBe(true)
    expect(ofreceCasa('si')).toBe(true)
    expect(ofreceCasa('SI')).toBe(true)
  })

  it('«No» y lo vacío no son un sí', () => {
    for (const r of ['No', 'no', '', null, undefined, 'tal vez']) {
      expect(ofreceCasa(r), String(r)).toBe(false)
    }
  })

  it('de dos respuestas de la misma persona, gana la ÚLTIMA', () => {
    /**
     * Catalina Pagés contestó dos veces con direcciones distintas. Mostrar
     * las dos en la lista del grupo sería ruido; la más reciente es la que
     * quiso dejar.
     */
    const m = ultimaPorPersona([
      { member_id: 'a', ubicacion: 'la vieja', respondido: '2026-09-01T10:00:00Z' },
      { member_id: 'a', ubicacion: 'la nueva', respondido: '2026-10-01T10:00:00Z' },
      { member_id: 'b', ubicacion: 'otra', respondido: '2026-09-15T10:00:00Z' },
    ])
    expect(m.size).toBe(2)
    expect(m.get('a')?.ubicacion).toBe('la nueva')
  })

  it('la celda de quien NO ofreció queda vacía', () => {
    // Una columna con «No» repetido 25 veces es ruido: lo que se busca son
    // los pocos que sí (medido: 5 de 30).
    expect(etiquetaDeCasa(false)).toBe('')
    expect(etiquetaDeCasa(true)).toBe('Ofrece casa')
  })
})

describe('EST-26 · quién puede verlo', () => {
  it('SOLO gestión: ni el dirigente ni el estudiante', () => {
    // Decisión de Floriana (2026-10-06). La sede del grupo la define el
    // equipo de estudios, y la dirección de la casa de alguien no tiene por
    // qué viajar a más pantallas que las que la usan.
    expect(permisosDelRoster('admin').verOfrecimientoDeCasa).toBe(true)
    expect(permisosDelRoster('leader').verOfrecimientoDeCasa).toBe(false)
    expect(permisosDelRoster('member').verOfrecimientoDeCasa).toBe(false)
    expect(permisosDelRoster('none').verOfrecimientoDeCasa).toBe(false)
  })

  it('va APARTE de verDatosDeGestion, que el dirigente sí tiene', () => {
    // Meterlo ahí se lo habría dado sin que nadie lo decidiera.
    expect(permisosDelRoster('leader').verDatosDeGestion).toBe(true)
    expect(permisosDelRoster('leader').verOfrecimientoDeCasa).toBe(false)
  })

  it('el dato NO VIAJA a quien no puede verlo', () => {
    // Esconder una columna en pantalla no esconde el dato: viaja en el JSON.
    const fila: FilaDeRoster = {
      id: 'e1', member_id: 'm1', status: 'enrolled',
      ofrece_casa: { ubicacion: 'Santa Ana, 400 sur del McDonalds' },
      member: { first_name: 'Ana', last_name: 'Pérez' },
    }
    const comoAdmin = recortarRoster([fila], 'admin')[0] as Record<string, unknown>
    expect(comoAdmin.ofrece_casa).toEqual({ ubicacion: 'Santa Ana, 400 sur del McDonalds' })

    for (const scope of ['leader', 'member'] as const) {
      const recortada = JSON.stringify(recortarRoster([fila], scope))
      expect(recortada, scope).not.toContain('Santa Ana')
      expect(recortada, scope).not.toContain('ofrece_casa')
    }
  })

  it('la pantalla también lo condiciona, no solo el servidor', () => {
    const pg = sinComentarios('src/app/(admin)/estudios/grupos/[id]/page.tsx')
    expect(pg).toContain("permisos.verOfrecimientoDeCasa ? 'Ofrece casa' : ''")
    expect(pg).toContain('{permisos.verOfrecimientoDeCasa && (')
  })

  it('y el servidor solo lo CONSULTA para admin', () => {
    // Traerlo para el dirigente sería pagar una consulta por un dato que
    // recortarRoster va a tirar igual.
    const r = sinComentarios('src/app/api/studies/groups/[id]/route.ts')
    expect(r).toContain("if (scope === 'admin' && roster.length > 0)")
  })
})
