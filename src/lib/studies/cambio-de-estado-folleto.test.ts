import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esAvance, esRetroceso, notaObligatoria, motivoQueImpide, textoDeConfirmacion,
  disparaEfecto, resumenDelLote, MINIMO_DE_LA_NOTA, type ResultadoPorTiquete,
} from './cambio-de-estado-folleto'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('FOL-2 · adelante y atrás', () => {
  it('sabe en qué dirección va', () => {
    expect(esAvance('creada', 'en_impresion')).toBe(true)
    expect(esAvance('creada', 'cerrada')).toBe(true)      // saltos también
    expect(esRetroceso('enviado_entregado', 'creada')).toBe(true)
    expect(esAvance('creada', 'creada')).toBe(false)
    expect(esRetroceso('creada', 'creada')).toBe(false)
  })

  it('RETROCEDER exige nota; avanzar no', () => {
    // Pedir justificación en el curso normal es fricción pura. Un retroceso
    // es siempre la corrección de algo, y en un mes alguien pregunta por qué.
    expect(notaObligatoria('enviado_entregado', 'creada')).toBe(true)
    expect(notaObligatoria('creada', 'enviado_entregado')).toBe(false)

    expect(motivoQueImpide({ desde: 'enviado_entregado', hasta: 'creada' }))
      .toMatch(/decir por qué/i)
    expect(motivoQueImpide({ desde: 'enviado_entregado', hasta: 'creada', nota: 'ups' }))
      .toMatch(/decir por qué/i)   // muy corta
    expect(motivoQueImpide({
      desde: 'enviado_entregado', hasta: 'creada', nota: 'se marcó por error',
    })).toBeNull()
    expect(MINIMO_DE_LA_NOTA).toBeGreaterThan(0)
  })

  it('avanzar no pide nada', () => {
    expect(motivoQueImpide({ desde: 'creada', hasta: 'cerrada' })).toBeNull()
  })

  it('al mismo estado, no', () => {
    expect(motivoQueImpide({ desde: 'creada', hasta: 'creada' })).toMatch(/ya está/i)
  })

  it('la confirmación nombra el SALTO, no pregunta «¿seguro?»', () => {
    expect(textoDeConfirmacion('creada', 'en_impresion'))
      .toBe('¿Cambiar de Creada a En impresión?')
    expect(textoDeConfirmacion('enviado_entregado', 'creada'))
      .toBe('¿Devolver de Enviado / Entregado a Creada?')
  })
})

describe('FOL-2 · los efectos no se repiten', () => {
  it('solo «enviado / entregado» dispara algo', () => {
    // Se censó la cadena: el único efecto es el aviso al dirigente.
    expect(disparaEfecto('enviado_entregado')).toBe(true)
    for (const e of ['creada', 'en_impresion', 'cerrada']) {
      expect(disparaEfecto(e), e).toBe(false)
    }
  })

  it('el cambio LIBRE no reenvía el aviso', () => {
    // Reenviárselo a un dirigente porque alguien corrigió un estado es
    // escribirle dos veces a la misma persona.
    const q = sinComentarios('src/lib/supabase/queries/folletos.ts')
    expect(q).toContain("status === 'enviado_entregado' && movidos.length > 0 && !opciones.libre")
  })
})

describe('FOL-2 · el lote dice qué pasó con CADA UNO', () => {
  const ok = (id: string): ResultadoPorTiquete => ({ id, movido: true, desde: 'creada' })
  const no = (id: string, motivo: string): ResultadoPorTiquete =>
    ({ id, movido: false, desde: 'cerrada', motivo })

  it('todos movidos: el mensaje de siempre', () => {
    expect(resumenDelLote([ok('a'), ok('b')], 'En impresión'))
      .toBe('2 folletos → En impresión.')
  })

  it('NINGUNO movido NO se lee como éxito — es el bug reportado', () => {
    /**
     * Antes decía «0 folletos → En impresión», con un ✓ al lado. La persona
     * creía que había funcionado y el cambio nunca se guardó.
     */
    const r = resumenDelLote([no('a', 'Ya estaba en En impresión.')], 'En impresión')
    expect(r).not.toMatch(/^0 folleto/)
    expect(r).toMatch(/ninguno/i)
    expect(r).toContain('Ya estaba en En impresión.')
  })

  it('parcial: dice cuántos de cuántos', () => {
    expect(resumenDelLote([ok('a'), ok('b'), no('c', 'x')], 'Cerrada'))
      .toBe('2 de 3 pasaron a Cerrada; 1 no.')
  })

  it('la consulta LEE el estado de cada uno antes de tocar nada', () => {
    // Sin eso no hay forma de decir por qué uno no se movió: el update
    // devolvía solo las filas que calzaron.
    const q = sinComentarios('src/lib/supabase/queries/folletos.ts')
    expect(q).toContain("select('id, status').in('id', ids)")
    expect(q).toContain('resultados.push')
    expect(q).toContain('const estadoDe = new Map(')
  })

  it('y el endpoint devuelve ese detalle a la pantalla', () => {
    const ep = sinComentarios('src/app/api/studies/folletos/bulk/route.ts')
    expect(ep).toContain('resultados')
    const pg = sinComentarios('src/app/(admin)/estudios/folletos/page.tsx')
    expect(pg).toContain('resumenDelLote(data.resultados')
    expect(pg).not.toMatch(/\$\{data\.updated\} folleto/)
  })
})

describe('FOL-2 · el cambio libre está cableado', () => {
  it('hay PATCH, valida con el módulo y audita', () => {
    const r = sinComentarios('src/app/api/studies/folletos/[id]/route.ts')
    expect(r).toContain('export async function PATCH')
    expect(r).toContain('motivoQueImpide({ desde, hasta: status, nota: body?.nota })')
    expect(r).toContain("setFolletoRequestsStatus([id], status, { libre: true })")
    expect(r).toMatch(/logAudit\(\{[\s\S]{0,300}folleto_requests/)
  })

  it('pide el mismo permiso que el lote, sin inventar uno nuevo', () => {
    const r = sinComentarios('src/app/api/studies/folletos/[id]/route.ts')
    const b = sinComentarios('src/app/api/studies/folletos/bulk/route.ts')
    const permiso = "requireModuleView('folletos', { action: 'edit' })"
    expect(r).toContain(permiso)
    expect(b).toContain(permiso)
  })
})
