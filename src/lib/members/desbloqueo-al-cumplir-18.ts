/**
 * AUT-4 · A quién se le quita el bloqueo por haber cumplido 18.
 *
 * QUÉ HACE Y QUÉ NO. Esto NO crea cuentas. Las cuentas de estas personas ya
 * existen —las creó AUTH-1 en julio de 2026— y lo único que se les hizo después
 * fue bloquearlas por ser menores (FAM-2). Acá se les quita ese bloqueo, nada
 * más. Quien nunca tuvo cuenta sigue sin tenerla: se la crea la persona cuando
 * quiera, por el camino normal.
 *
 * Y desbloquear tampoco le da acceso a nadie por sí solo: ninguna de estas
 * cuentas se usó jamás, así que no tienen contraseña. Lo que cambia es que el
 * "olvidé mi contraseña" empieza a funcionar, que es justo lo que hoy falla con
 * un enlace que sale vencido.
 *
 * NO SE TOCAN las cuentas de fichas fusionadas —correo
 * `fusionado+…@theosplace.invalid`—, que están bloqueadas a propósito y para
 * siempre. Ni las que no tienen fecha de nacimiento: sin el dato no se puede
 * afirmar que alguien cumplió 18, y en la duda no se abre una cuenta.
 *
 * Módulo PURO.
 */
import { esMenorDeEdad, hoyCR } from '@/lib/members/alta-persona'

/** Las cuentas de fichas fusionadas llevan este dominio y no se desbloquean. */
export const DOMINIO_DE_FUSION = '@theosplace.invalid'

export type CuentaBloqueada = {
  auth_user_id: string
  email: string | null
  birth_date: string | null
  nombre: string
}

export type Decision =
  | { desbloquear: true }
  | { desbloquear: false; motivo: 'sigue_siendo_menor' | 'sin_fecha_de_nacimiento' | 'ficha_fusionada' }

export function decidir(c: CuentaBloqueada, hoy: string = hoyCR()): Decision {
  if ((c.email ?? '').toLowerCase().includes(DOMINIO_DE_FUSION)) {
    return { desbloquear: false, motivo: 'ficha_fusionada' }
  }
  if (!c.birth_date) return { desbloquear: false, motivo: 'sin_fecha_de_nacimiento' }
  if (esMenorDeEdad(c.birth_date, hoy)) return { desbloquear: false, motivo: 'sigue_siendo_menor' }
  return { desbloquear: true }
}

export type Reparto = {
  desbloquear: CuentaBloqueada[]
  /** Los que se quedan, con el porqué — para poder mirar la lista después. */
  seQuedan: Array<{ cuenta: CuentaBloqueada; motivo: string }>
}

export function repartir(
  cuentas: readonly CuentaBloqueada[],
  hoy: string = hoyCR(),
): Reparto {
  const desbloquear: CuentaBloqueada[] = []
  const seQuedan: Array<{ cuenta: CuentaBloqueada; motivo: string }> = []
  for (const c of cuentas) {
    const d = decidir(c, hoy)
    if (d.desbloquear) desbloquear.push(c)
    else seQuedan.push({ cuenta: c, motivo: d.motivo })
  }
  return { desbloquear, seQuedan }
}
