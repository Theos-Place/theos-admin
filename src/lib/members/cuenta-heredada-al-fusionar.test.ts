import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  queHacerConLaCuentaHeredada, avisoDeCuentaBloqueada,
} from './cuenta-heredada-al-fusionar'

const HOY = '2026-10-12'

describe('la cuenta que hereda el principal al fusionar', () => {
  it('EL CASO DE DANIELA: adulta con cuenta bloqueada → se desbloquea', () => {
    /**
     * 33 años. La cuenta venía de una ficha duplicada registrada como menor
     * (n. 2011) y estaba bloqueada por la regla de menores. Al fusionar, la
     * adulta heredó la cuenta con el bloqueo y quedó sin poder entrar, sin
     * ninguna explicación.
     */
    expect(queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: '1993-06-18', is_active: true } }, HOY,
    )).toEqual({ accion: 'desbloquear' })
  })

  it('si la ficha que sobrevive es de un MENOR, se deja bloqueada', () => {
    // Fusionar dos fichas de un menor no le abre la cuenta: el bloqueo es la
    // regla, no el bug.
    const r = queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: '2012-03-01', is_active: true } }, HOY)
    expect(r.accion).toBe('dejar_bloqueada')
    expect(r).toMatchObject({ motivo: 'es menor de edad' })
  })

  it('sin fecha de nacimiento NO se adivina', () => {
    /**
     * Desbloquear «por si acaso» le abriría la cuenta a un menor sin fecha.
     * Se deja como está y se reporta, que es lo que el repo ya hace con
     * `edadDesconocida`.
     */
    const r = queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: null, is_active: true } }, HOY)
    expect(r.accion).toBe('dejar_bloqueada')
    expect(r).toMatchObject({ motivo: 'la ficha no tiene fecha de nacimiento' })
  })

  it('una ficha inactiva tampoco recupera su cuenta', () => {
    const r = queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: '1990-01-01', is_active: false } }, HOY)
    expect(r.accion).toBe('dejar_bloqueada')
    expect(r).toMatchObject({ motivo: 'la ficha quedó inactiva' })
  })

  it('si la cuenta NO está bloqueada no se toca nada', () => {
    // El caso normal: la inmensa mayoría de las fusiones.
    expect(queHacerConLaCuentaHeredada(
      { bloqueada: false, ficha: { birth_date: '2012-03-01', is_active: true } }, HOY,
    )).toEqual({ accion: 'nada' })
  })

  it('justo el día del cumpleaños 18 ya cuenta como adulto', () => {
    expect(queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: '2008-10-12', is_active: true } }, HOY,
    )).toEqual({ accion: 'desbloquear' })
    // Y un día antes, no.
    expect(queHacerConLaCuentaHeredada(
      { bloqueada: true, ficha: { birth_date: '2008-10-13', is_active: true } }, HOY,
    ).accion).toBe('dejar_bloqueada')
  })

  it('el aviso dice el motivo, no solo que quedó bloqueada', () => {
    // Sin el motivo, quien fusiona no sabe si tiene que hacer algo.
    expect(avisoDeCuentaBloqueada('es menor de edad'))
      .toContain('es menor de edad')
    expect(avisoDeCuentaBloqueada('es menor de edad'))
      .toContain('revisarlo a mano')
  })
})

describe('el cableado con la fusión', () => {
  const sinComentarios = (r: string) =>
    readFileSync(r, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const FUSION = sinComentarios('src/lib/supabase/queries/members-mutations.ts')
  const PANTALLA = sinComentarios('src/components/members/ResolucionDeFusion.tsx')

  it('la fusión revisa la cuenta que HEREDA el principal', () => {
    // Era lo que faltaba: el SQL ya evitaba bloquear la única cuenta que
    // queda, pero nadie miraba si venía bloqueada de antes.
    expect(FUSION).toContain('queHacerConLaCuentaHeredada({')
    expect(FUSION).toContain('r.keep_auth_user_id')
  })

  it('y la decisión la toma el módulo, no la query', () => {
    // La regla de quién es menor ya existe y tiene pruebas; reescribirla acá
    // sería tener dos definiciones de «menor de edad».
    expect(FUSION).not.toContain('birth_date <')
    expect(FUSION).not.toContain('esMenor(')
  })

  it('desbloquear va por la API de Auth, no por SQL', () => {
    // El estado de una cuenta lo lleva Auth.
    /**
     * Anclado en el USO y no en el nombre: la línea del import viene antes y
     * haría pasar la prueba sin mirar el código (el mismo error que este repo
     * ya documentó en FRM-6).
     *
     * Y se exige que el desbloqueo CUELGUE de la decisión, no que exista en
     * algún lado: la primera versión de esta prueba solo buscaba el texto, y
     * al cambiar la condición por `if (false)` seguía pasando en verde.
     */
    const i = FUSION.indexOf('queHacerConLaCuentaHeredada({')
    expect(i, 'tiene que llamarse').toBeGreaterThan(-1)
    const guard = FUSION.indexOf("decision.accion === 'desbloquear'", i)
    expect(guard, 'el desbloqueo cuelga de la decisión').toBeGreaterThan(-1)
    const ban = FUSION.indexOf("ban_duration: 'none'", guard)
    expect(ban, 'y llama a Auth dentro de esa rama').toBeGreaterThan(-1)
    expect(ban - guard, 'dentro de la misma rama').toBeLessThan(260)
  })

  it('NO tumba la fusión si Auth falla', () => {
    /**
     * La fusión ya está hecha y es lo que vale. Si esto pudiera tirar el
     * request, un problema de Auth dejaría la fusión aplicada y al usuario
     * viendo un error, sin saber qué quedó hecho.
     */
    const i = FUSION.indexOf('queHacerConLaCuentaHeredada({')
    const antes = FUSION.slice(0, i)
    expect(antes.lastIndexOf('try {')).toBeGreaterThan(antes.lastIndexOf('} catch'))
  })

  it('la pantalla AVISA en los dos casos', () => {
    /**
     * Si se liberó, para que nadie la crea rota. Y si quedó bloqueada,
     * porque esa persona no va a poder entrar y quien fusiona es la única
     * que está mirando en ese momento — fue justo lo que no pasó con
     * Daniela.
     */
    expect(PANTALLA).toContain('d?.cuentaDesbloqueada')
    expect(PANTALLA).toContain('d?.cuentaSigueBloqueada')
    expect(PANTALLA).toContain('no va a poder entrar')
  })

  it('y el endpoint deja pasar los campos nuevos', () => {
    const api = sinComentarios('src/app/api/members/[id]/merge/route.ts')
    expect(api).toContain('...r')
  })
})
