import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EL DETALLE DE UN TIQUETE DE REUBICACIÓN (Floriana, 2026-10-12):
 * «no sale el nombre del estudiante ni el del dirigente… ese detalle no me
 * dice prácticamente nada».
 *
 * Tenía razón, y lo que fallaba no era que el dato no existiera. Un tiquete
 * de reubicación nace sin `source_group_id` ni `origin_group_id`, así que
 * las tarjetas que se alimentan de esos dos salían vacías. Pero
 * `study_requests.resulting_folleto_request_id` apunta al tiquete desde la
 * solicitud, que sí sabe quién es, con quién estaba y a dónde entró.
 * Faltaba seguir el enlace.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const QUERY = sinComentarios('src/lib/supabase/queries/folletos.ts')
const PANTALLA = sinComentarios('src/app/(admin)/estudios/folletos/[id]/page.tsx')

describe('el detalle sigue el enlace a la solicitud', () => {
  it('la query busca por `resulting_folleto_request_id`', () => {
    const fn = QUERY.slice(QUERY.indexOf('export async function getFolletoDetalle'))
    expect(fn).toContain("from('study_requests')")
    expect(fn).toContain("eq('resulting_folleto_request_id', t.id)")
  })

  it('trae estudiante, dirigente anterior, grupo destino y quién resolvió', () => {
    // Las cuatro cosas que convierten «no dice nada» en un detalle útil.
    const fn = QUERY.slice(QUERY.indexOf('export async function getFolletoDetalle'))
    expect(fn).toContain('estudiante:')
    expect(fn).toContain('last_leader_name')
    expect(fn).toContain('destino:')
    expect(fn).toContain('revisor:')
  })

  it('se pide SIEMPRE, no solo cuando el tipo dice reubicación', () => {
    /**
     * `tipo` es un texto de la fila. Si mañana aparece otro que también
     * venga de una solicitud, el detalle lo muestra sin que nadie se
     * acuerde de tocar esta condición.
     */
    const fn = QUERY.slice(QUERY.indexOf('export async function getFolletoDetalle'))
    expect(fn).not.toMatch(/tipo === 'reubicacion'[\s\S]{0,120}study_requests/)
  })

  it('va en el mismo Promise.all: no agrega una espera en serie', () => {
    const fn = QUERY.slice(QUERY.indexOf('export async function getFolletoDetalle'))
    expect(fn).toContain('const [grupoRes, origenRes, pagosRes, reubRes] = await Promise.all([')
  })

  it('sin solicitud enlazada queda en null y no inventa una tarjeta vacía', () => {
    const fn = QUERY.slice(QUERY.indexOf('export async function getFolletoDetalle'))
    expect(fn).toContain('= rr ? {')
    expect(fn).toContain('} : null')
  })
})

describe('la pantalla', () => {
  it('pinta la tarjeta solo cuando hay reubicación', () => {
    // En un tiquete de cierre no debe aparecer una tarjeta en blanco.
    expect(PANTALLA).toContain('{d.reubicacion && (')
  })

  it('va en su PROPIA tarjeta, no mezclada con «a quién se le entrega»', () => {
    /**
     * Son dos cosas distintas: el folleto se le entrega al dirigente NUEVO,
     * y esto cuenta de dónde viene la persona. Mezclarlas haría pensar que
     * los folletos van al dirigente anterior.
     */
    expect(PANTALLA).toContain('De quién es esta reubicación')
    const entrega = PANTALLA.indexOf('A quién se le entrega')
    const reub = PANTALLA.indexOf('De quién es esta reubicación')
    expect(reub).toBeGreaterThan(entrega)
  })

  it('el estudiante enlaza a su ficha', () => {
    // Es el primer clic que alguien quiere dar desde acá.
    expect(PANTALLA).toContain('/miembros/${d.reubicacion.estudiante_id}')
  })

  it('y dice cuando un dato falta, en vez de dejar un hueco', () => {
    expect(PANTALLA).toContain('No lo dijo en la solicitud')
  })
})
