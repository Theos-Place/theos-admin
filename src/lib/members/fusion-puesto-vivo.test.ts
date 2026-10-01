import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * La fusión conserva el puesto VIVO, no el de la ficha principal.
 *
 * El test de verdad corre contra una base —`scripts/fusion/prueba-puesto-vivo.sql`,
 * porque lo que falla es el orden de ejecución dentro de plpgsql y eso no se
 * lee—. Este fija lo único que SÍ se puede afirmar desde el repo y que es
 * justo donde se rompió: que el rescate quede ANTES de los borrados.
 */
const DIR = 'supabase/migrations'

/** La ÚLTIMA definición de merge_members, que es la que vale. */
function ultimaDefinicion(): string {
  const archivos = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
  let ultima = ''
  for (const f of archivos) {
    const sql = readFileSync(`${DIR}/${f}`, 'utf8')
    const i = sql.toLowerCase().lastIndexOf('function public.merge_members(')
    if (i >= 0) ultima = sql.slice(i)
  }
  expect(ultima, 'ninguna migración define merge_members').not.toBe('')
  return ultima
}

describe('merge_members', () => {
  const def = ultimaDefinicion()

  it('rescata el puesto activo del duplicado antes de descartar su fila', () => {
    expect(def).toMatch(/UPDATE volunteers k[\s\S]*?a\.status = 'active'[\s\S]*?k\.status <> 'active'/)
  })

  it('y el rol activo también', () => {
    expect(def).toMatch(/UPDATE member_roles k[\s\S]*?a\.is_active[\s\S]*?NOT k\.is_active/)
  })

  it('EL ORDEN: los dos rescates van ANTES de sus borrados', () => {
    /**
     * Acá se rompió el primer intento. `member_roles` se borra UNA LÍNEA antes
     * que `volunteers`, así que un rescate puesto entre los dos llega a tiempo
     * para los puestos y tarde para los roles — y la mitad que funciona tapa
     * la que no.
     */
    const rescateRoles = def.indexOf('UPDATE member_roles k')
    const rescatePuestos = def.indexOf('UPDATE volunteers k')
    const borraRoles = def.indexOf('DELETE FROM member_roles a')
    const borraPuestos = def.indexOf('DELETE FROM volunteers a')
    for (const i of [rescateRoles, rescatePuestos, borraRoles, borraPuestos]) {
      expect(i).toBeGreaterThan(-1)
    }
    expect(rescateRoles).toBeLessThan(borraRoles)
    expect(rescatePuestos).toBeLessThan(borraPuestos)
  })

  it('las filas que SÍ son el mismo hecho dos veces se siguen descartando', () => {
    // El arreglo es acotado: un check-in o una inscripción repetida no tiene
    // estado que elegir, y convertir esto en «rescatar todo» traería de vuelta
    // los choques del índice único que el bloque vino a evitar.
    for (const t of ['event_checkins', 'event_registrations', 'study_attendance']) {
      expect(def, t).toContain(`DELETE FROM ${t} a`)
      expect(def, t).not.toContain(`UPDATE ${t} k`)
    }
  })
})

describe('merge_members · la familia', () => {
  const def = ultimaDefinicion()

  it('ya no exige que las dos fichas compartan familia', () => {
    /**
     * El índice único es sobre `member_id` SOLO. La versión vieja limpiaba el
     * choque con `k.family_unit_id = a.family_unit_id`, o sea solo dentro de
     * la misma familia, y en familias distintas la fusión moría con un 23505
     * en bruto. Dos fichas de Liam Salazar Calderon (2026-09-30).
     */
    expect(def).not.toMatch(/DELETE FROM family_members a WHERE[\s\S]{0,200}k\.family_unit_id = a\.family_unit_id/)
  })

  it('se queda con el vínculo más reciente, mire para donde mire', () => {
    // Las DOS direcciones: quien fusiona elige cuál ficha conserva, y el
    // vínculo nuevo puede estar en cualquiera de las dos.
    expect(def).toMatch(/DELETE FROM family_members a USING family_members k[\s\S]*?a\.created_at <= k\.created_at/)
    expect(def).toMatch(/DELETE FROM family_members k USING family_members a[\s\S]*?a\.created_at > k\.created_at/)
  })

  it('y se mide por la fecha del VÍNCULO, no la de la ficha', () => {
    // `members.created_at` diría cuándo nació el registro de la persona, que
    // no es cuándo se supo de esa familia. En Liam las dos fechas coincidían
    // en la respuesta; no tenían por qué.
    // Se corta hacia ADELANTE desde su encabezado: el bloque de la familia
    // vive DENTRO de la sección de choques, así que cortar hasta ese título
    // daba un trozo vacío y el test pasaba sin mirar nada.
    const i = def.indexOf('LA FAMILIA: gana el vínculo')
    expect(i).toBeGreaterThan(-1)
    const bloque = def.slice(i, def.indexOf('DELETE FROM applications a', i))
    expect(bloque).toContain('family_members.created_at')
    expect(bloque).not.toMatch(/\bm\.created_at\b/)
  })
})
