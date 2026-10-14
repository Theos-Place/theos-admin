import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CAMPOS_DEL_DIRIGENTE, motivoQueImpideEditar } from './disponibilidad-de-dirigente'

/**
 * DIR-8 · «Mi comunidad»: a qué grupo SIENTE que pertenece el dirigente.
 *
 * NO es dónde asiste ni dónde puede dar estudios. Alguien asiste en
 * Pedregal, da en el este y se siente de Antares. Sirve para invitaciones
 * dirigidas: talleres, get-togethers, koinonías.
 *
 * EL CATÁLOGO SON LAS SEDES ACTIVAS, por ahora (decisión de Floriana,
 * 2026-10-13): se empieza con lo que existe en vez de esperar una lista de
 * comunidades que nadie ha escrito. Lo que importa es que SEA un catálogo —
 * un texto libre acá se llena de cuatro grafías del mismo lugar, que es
 * exactamente lo que pasó con «dónde te dejamos los folletos».
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = sinComentarios('src/app/api/studies/dirigentes/[id]/route.ts')
const PANTALLA = sinComentarios('src/components/studies/ConfiguracionDelDirigente.tsx')

describe('mi comunidad', () => {
  it('lo dice la PERSONA: está entre los campos que edita el dirigente', () => {
    expect(CAMPOS_DEL_DIRIGENTE).toContain('comunidades')
    expect(motivoQueImpideEditar('comunidades')).toBeNull()
  })

  it('el servidor lo valida contra el catálogo de sedes activas', () => {
    // La pantalla nunca fue el permiso: un PATCH a mano entraría igual.
    const i = API.indexOf('patch.comunidades')
    expect(i).toBeGreaterThan(-1)
    const bloque = API.slice(i, i + 1200)
    expect(bloque).toContain("from('sedes')")
    expect(bloque).toContain("eq('is_active', true)")
    expect(bloque).toContain('status: 400')
  })

  it('valida por CODE, no por la PK', () => {
    /**
     * El catálogo que ve la pantalla (`/api/sedes`) expone el CODE como
     * `id` y deja el UUID en `sede_id`. Validar contra la PK rechazaba
     * todo con 400 — fue lo primero que pasó al probarlo en staging. Es
     * además lo que ya hace `folleto_location`, así que los dos campos
     * guardan la misma clase de valor.
     */
    const i = API.indexOf('patch.comunidades')
    const bloque = API.slice(i, i + 1200)
    expect(bloque).toContain("select('code')")
    expect(bloque).toContain("in('code', pedidas)")
  })

  it('y una lista vacía es válida: no haber contestado no es un error', () => {
    const i = API.indexOf('patch.comunidades')
    expect(API.slice(i, i + 900)).toContain('if (pedidas.length)')
  })

  it('la pantalla la ofrece como catálogo, no como texto libre', () => {
    expect(PANTALLA).toContain("alternarLista('comunidades'")
    expect(PANTALLA).toContain('activeSedes.map')
  })

  it('y se distingue de «dónde podés dar»', () => {
    // Si las dos preguntas se leyeran igual, la gente marcaría lo mismo en
    // las dos y el campo no serviría para nada.
    expect(PANTALLA).toContain('Mi comunidad')
    expect(PANTALLA).toContain('¿Dónde podés dar?')
  })
})
