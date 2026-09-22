import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * El rol `lider_comite` SIGUE a la estrellita, en los dos sentidos: se pone al
 * ponerla y se quita al quitarla (pedido del usuario, 2026-09-22).
 *
 * Se lee el fuente en vez de invocar la función porque `setEncargadoDeComite`
 * habla con Supabase, y lo que hay que blindar acá es que NINGUNA de las dos
 * salidas se olvide de sincronizar. Es justo el error que creó el problema: los
 * dos datos vivían por separado y se desalinearon en 17 personas.
 */
const SRC = readFileSync('src/lib/supabase/queries/servers.ts', 'utf8')
const CUERPO = SRC.slice(
  SRC.indexOf('export async function setEncargadoDeComite'),
  SRC.indexOf('export async function removeVolunteer'),
)

describe('el rol sigue a la estrellita', () => {
  it('al PONER la estrella se sincroniza el rol', () => {
    // La rama de asignar termina ajustando el cupo del puesto; el sync va después.
    const alPoner = CUERPO.slice(CUERPO.indexOf('await assignVolunteer('))
    expect(alPoner).toContain('sincronizarRolDeLider(memberId)')
  })

  it('al QUITARLA también', () => {
    const alQuitar = CUERPO.slice(
      CUERPO.indexOf("if (plan.accion === 'quitar')"),
      CUERPO.indexOf("if (plan.accion === 'crear_y_sumar')"),
    )
    expect(alQuitar).toContain('sincronizarRolDeLider(memberId)')
  })

  it('el sync DECIDE por los comités que encarga, no por lo que se acaba de tocar', () => {
    // Quien encarga DOS comités y pierde uno sigue siendo líder. Recalcular
    // desde getManageableCommitteeIds es lo que hace que ese caso salga bien
    // sin tener que pensarlo en cada rama.
    const fn = SRC.slice(SRC.indexOf('async function sincronizarRolDeLider'))
    expect(fn).toContain('getManageableCommitteeIds(memberId)')
    expect(fn).toContain("eq('role', 'lider_comite')")
  })

  it('no revienta la operación si el sync falla', () => {
    // La estrella ya quedó puesta y eso es lo que manda: la API de Mi comité
    // mira los PUESTOS, no el rol. Tirar acá dejaría el puesto a medias.
    const fn = SRC.slice(SRC.indexOf('async function sincronizarRolDeLider'))
    expect(fn).toContain('try {')
    expect(fn).toContain('reportarFalla(')
  })
})
