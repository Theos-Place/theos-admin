/**
 * Al fusionar fichas, la cuenta que hereda el principal puede venir BLOQUEADA.
 *
 * EL CASO (Floriana, 2026-10-12): Daniela Céspedes, 33 años, no podía entrar.
 * Tenía dos fichas con el mismo correo — la suya, sin cuenta, y una duplicada
 * registrada con fecha de nacimiento 2011. La cuenta vivía en la duplicada y
 * estaba bloqueada por la regla de menores (AUTH-1), que para esa ficha era
 * lo correcto. Al fusionar, `merge_members` le pasó la cuenta a la ficha
 * adulta… con el bloqueo puesto. Pedía el enlace, le llegaba, y al abrirlo
 * decía «el enlace no es válido», sin más explicación.
 *
 * EL SQL YA CUIDA EL CASO VECINO y conviene no confundirlos:
 * `merge_members_resuelto` dejó de devolver `dup_auth_user_id` cuando esa
 * cuenta pasó a ser la del principal, para no deshabilitar la única que hay
 * (el caso de Bárbara Solís). Eso evita que la fusión BLOQUEE. Lo que faltaba
 * es DESBLOQUEAR la que ya venía bloqueada de antes.
 *
 * NO SE DESBLOQUEA A CUALQUIERA. Si la ficha que sobrevive es de un menor, el
 * bloqueo es la regla y se respeta: fusionar dos fichas de un menor no le
 * abre la cuenta. Y sin fecha de nacimiento no se adivina — se reporta para
 * que alguien lo mire, que es lo que el repo ya hace con `edadDesconocida`.
 *
 * Módulo puro: decide. Quien habla con Auth es la query.
 */

import { esMenor, edadDesconocida } from '@/lib/members/reglas-de-menores'

export type FichaQueSobrevive = {
  birth_date: string | null
  is_active?: boolean | null
}

export type QueHacerConLaCuenta =
  | { accion: 'desbloquear' }
  | { accion: 'dejar_bloqueada'; motivo: string }
  | { accion: 'nada' }

/**
 * @param bloqueada  si la cuenta del principal está bloqueada AHORA.
 */
export function queHacerConLaCuentaHeredada(
  input: { bloqueada: boolean; ficha: FichaQueSobrevive },
  hoy?: string,
): QueHacerConLaCuenta {
  if (!input.bloqueada) return { accion: 'nada' }
  if (input.ficha.is_active === false) {
    // Una ficha desactivada no recupera su cuenta por haberse fusionado.
    return { accion: 'dejar_bloqueada', motivo: 'la ficha quedó inactiva' }
  }
  if (edadDesconocida(input.ficha)) {
    return { accion: 'dejar_bloqueada', motivo: 'la ficha no tiene fecha de nacimiento' }
  }
  if (esMenor(input.ficha, hoy)) {
    return { accion: 'dejar_bloqueada', motivo: 'es menor de edad' }
  }
  return { accion: 'desbloquear' }
}

/** Lo que se le dice a quien fusionó, cuando la cuenta quedó bloqueada igual. */
export function avisoDeCuentaBloqueada(motivo: string): string {
  return `La ficha quedó con una cuenta de acceso BLOQUEADA (${motivo}). `
    + 'Si esa persona tiene que entrar, hay que revisarlo a mano.'
}
