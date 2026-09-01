/**
 * Qué hacer cuando se cambia el correo de acceso y YA existe otra cuenta con
 * ese correo.
 *
 * Pasa seguido y siempre igual: alguien corrige el correo en la ficha, la
 * persona no puede entrar, se registra por su cuenta con su correo bueno —y
 * eso le crea una SEGUNDA cuenta, sin ficha— mientras la ficha sigue apuntando
 * a la vieja, que nunca se usó. Adriana Jiménez, otras cuatro el mismo día, y
 * Silvia Aguilar.
 *
 * La primera versión de la pantalla detectaba el choque y se rendía: "Ya existe
 * otra cuenta con ese correo, hay que resolver el duplicado". Cierto e inútil —
 * el duplicado es una cuenta de Auth, no sale en el padrón, y no había forma de
 * resolverlo sin entrar a la base.
 *
 * Ahora se decide acá, y la decisión es de tres:
 *
 *   · renombrar → no hay otra cuenta: se le cambia el correo a la que tiene.
 *   · religar   → la otra cuenta tiene el correo bueno y NO es de nadie; la
 *                 actual nunca se usó. La ficha pasa a la otra y la muerta se
 *                 borra. Es el caso de arriba.
 *   · bloquear  → cualquier duda. Con dos cuentas que tienen historia, o con
 *                 una que ya es de otra persona, elegir por alguien es perder
 *                 algo que no se recupera.
 */

export type PlanDeCorreo =
  | { accion: 'renombrar' }
  | { accion: 'religar'; cuentaNueva: string; cuentaAbandonada: string }
  | { accion: 'bloquear'; motivo: string }

export type CuentaDeAcceso = {
  id: string
  /** ¿Alguna vez inició sesión? */
  haEntrado: boolean
  /** Cuántas fichas apuntan a esta cuenta. */
  fichas: number
}

export function planDeCambioDeCorreo(input: {
  /** La cuenta a la que apunta la ficha hoy. */
  actual: CuentaDeAcceso
  /** La cuenta que YA tiene el correo destino, si existe. */
  conEseCorreo: CuentaDeAcceso | null
}): PlanDeCorreo {
  const { actual, conEseCorreo } = input
  if (!conEseCorreo) return { accion: 'renombrar' }
  if (conEseCorreo.id === actual.id) return { accion: 'renombrar' }

  if (conEseCorreo.fichas > 0) {
    return { accion: 'bloquear', motivo: 'Ese correo ya es de la cuenta de otra persona.' }
  }
  if (actual.haEntrado) {
    // Las dos tienen historia: la actual con ingresos, la otra con el correo
    // bueno. Mover la ficha abandona los ingresos de una; renombrar es
    // imposible por el índice único. Lo decide una persona, no el sistema.
    return {
      accion: 'bloquear',
      motivo: 'Hay dos cuentas con historial: la actual ya se usó para entrar y existe otra con ese correo. '
        + 'Hay que decidir cuál se conserva antes de cambiarlo.',
    }
  }
  return { accion: 'religar', cuentaNueva: conEseCorreo.id, cuentaAbandonada: actual.id }
}
