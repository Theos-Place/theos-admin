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
