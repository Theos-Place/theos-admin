/**
 * AUT-2 · Qué cuenta de acceso se queda y cuál sobra.
 *
 * EL PROBLEMA. `auth.users` tiene 18.560 cuentas y solo 714 se loguearon alguna
 * vez: el resto salió de la creación masiva de AUTH-1 (2026-07-28), que le hizo
 * cuenta a todo el padrón "por si acaso". Cada una es un correo ocupado y una
 * fila que hay que mirar cada vez que se busca algo en auth.
 *
 * QUÉ SE BORRA. SOLO la cuenta de login. La ficha del miembro no se toca nunca,
 * y como "Conseguí tu contraseña" vuelve a crear la cuenta cuando la persona
 * aparece —`buildPasswordLink` con tipo `invite` la crea y la enlaza—, el
 * borrado es recuperable en la práctica. Esa es toda la razón por la que esto
 * se puede hacer sin miedo.
 *
 * Módulo puro: la consulta la arma el script, la DECISIÓN vive acá con tests.
 */

/** Por qué una cuenta se queda. El orden es el del reporte: de la razón más
 *  fuerte a la más circunstancial. */
export type MotivoParaQuedarse =
  | 'se_logueo'            // la usó: no hay más que discutir
  | 'bloqueada'            // ver abajo, es la que casi se nos pasa
  | 'cuenta_de_prueba'     // las maneja limpiar-datos-de-prueba.ts, no este proceso
  | 'tiene_rol'            // jamás se borra la cuenta de alguien que sirve
  | 'asistencia_reciente'
  | 'estudio_reciente'

export type CuentaParaEvaluar = {
  email: string | null
  seLogueoAlgunaVez: boolean
  estaBloqueada: boolean
  tieneRolActivo: boolean
  asistioEnLaVentana: boolean
  estudioEnLaVentana: boolean
}

/** Los dos años de la ventana. */
export const ANIOS_DE_VENTANA = 2

const DOMINIO_DE_PRUEBA = '@prueba.theosplace.invalid'

export function esCuentaDePrueba(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase().endsWith(DOMINIO_DE_PRUEBA)
}

/**
 * El motivo por el que la cuenta se queda, o `null` si es candidata a borrar.
 *
 * **`bloqueada` NO estaba en el pedido original y es la corrección importante.**
 * Las 106 cuentas de menores que FAM-2 deshabilitó en setiembre cumplen todo lo
 * que este proceso busca: nunca se loguearon, no tienen rol y muchas no tienen
 * asistencia reciente. Borrarlas rompería AUT-4 —el cron del 1.º de mes les
 * quita el ban al cumplir 18 y ya no habría nada que desbloquear— y liberaría
 * el correo, que es justo lo que se decidió NO hacer: «borrarlas dejaría el
 * correo ocupado por un usuario huérfano».
 *
 * Una cuenta bloqueada no es una cuenta sin usar: es una cuenta guardada.
 */
export function motivoParaQuedarse(c: CuentaParaEvaluar): MotivoParaQuedarse | null {
  if (c.seLogueoAlgunaVez) return 'se_logueo'
  if (c.estaBloqueada) return 'bloqueada'
  if (esCuentaDePrueba(c.email)) return 'cuenta_de_prueba'
  if (c.tieneRolActivo) return 'tiene_rol'
  if (c.asistioEnLaVentana) return 'asistencia_reciente'
  if (c.estudioEnLaVentana) return 'estudio_reciente'
  return null
}

export function esCandidataABorrar(c: CuentaParaEvaluar): boolean {
  return motivoParaQuedarse(c) === null
}

export const ETIQUETA_MOTIVO: Record<MotivoParaQuedarse, string> = {
  se_logueo: 'Entró alguna vez',
  bloqueada: 'Bloqueada (menor — la desbloquea AUT-4 al cumplir 18)',
  cuenta_de_prueba: 'Cuenta de prueba (la maneja SEC-4)',
  tiene_rol: 'Tiene un rol activo',
  asistencia_reciente: `Asistió en los últimos ${ANIOS_DE_VENTANA} años`,
  estudio_reciente: `Estudió en los últimos ${ANIOS_DE_VENTANA} años`,
}
