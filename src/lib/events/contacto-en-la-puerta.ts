/**
 * CHK-5 · Pedirle el correo, en la puerta, al adulto que no lo tiene.
 *
 * POR QUÉ ACÁ. A un menor no se le registra correo (FAM-2), así que al cumplir
 * 18 queda sin ninguno. AUT-4 le desbloquea la cuenta el 1.º de mes, pero sin
 * correo ese desbloqueo no sirve de nada: no hay a dónde mandarle el enlace
 * para definir su contraseña. Hoy son 65 personas en esa situación y UNA tiene
 * correo.
 *
 * El check-in es el único momento en que la persona está parada enfrente.
 * Pedirle el dato ahí cuesta diez segundos; perseguirlo después cuesta un mes.
 *
 * QUÉ NO ES. Esto no crea cuentas, no manda correos y no edita fichas en
 * general: llena un campo vacío y nada más. El operador de la puerta sigue sin
 * poder editar miembros, que es como debe ser.
 *
 * Módulo puro: sin React ni Supabase, para poder probar la decisión sola.
 */

import { exigeContacto, type FichaConEdad } from '@/lib/members/reglas-de-menores'

export type FichaEnLaPuerta = FichaConEdad & {
  email?: string | null
  phone?: string | null
}

/** Los campos que este flujo puede llenar. Ningún otro. */
export const CAMPOS_DE_CONTACTO = ['email', 'phone'] as const
export type CampoDeContacto = (typeof CAMPOS_DE_CONTACTO)[number]

function vacio(v: string | null | undefined): boolean {
  return !v || !v.trim()
}

/**
 * ¿A esta persona se le pide el dato?
 *
 * Tres condiciones, y las tres tienen que darse:
 *
 *  1. **Se SABE que es adulta.** No basta con que no conste como menor: si la
 *     ficha no tiene fecha de nacimiento, NO se pregunta. Es más estricto que
 *     el resto del sistema a propósito — en otros lados la edad desconocida se
 *     trata como adulta para no bloquear a nadie, pero acá el riesgo va al
 *     revés: guardarle el correo propio a un chico de 15 es justo lo que FAM-2
 *     no quiere. Son 3.260 fichas sin fecha, y prefiero perder la oportunidad
 *     antes que capturar el dato equivocado.
 *  2. **No tiene datos protegidos.** Lo resuelve `exigeContacto`.
 *  3. **El campo está vacío.** Esto nunca pisa un valor que ya existe.
 */
export function pedirContacto(
  f: FichaEnLaPuerta,
  hoy?: string,
): { email: boolean; phone: boolean } {
  const sabemosQueEsAdulta = !!f.birth_date && exigeContacto(f, hoy)
  if (!sabemosQueEsAdulta) return { email: false, phone: false }
  return { email: vacio(f.email), phone: vacio(f.phone) }
}

/** ¿Hay algo que pedir? Atajo para la pantalla. */
export function faltaAlgunContacto(f: FichaEnLaPuerta, hoy?: string): boolean {
  const p = pedirContacto(f, hoy)
  return p.email || p.phone
}

/**
 * El aviso para el operador. El correo va primero porque es el que destraba la
 * cuenta; el teléfono es el premio de consuelo.
 */
export function avisoDeContacto(nombre: string, f: FichaEnLaPuerta, hoy?: string): string | null {
  const p = pedirContacto(f, hoy)
  if (p.email && p.phone) return `${nombre} no tiene correo ni teléfono registrados — aprovechá y pedíselos.`
  if (p.email) return `${nombre} no tiene correo registrado — pedíselo para que pueda entrar al sistema.`
  if (p.phone) return `${nombre} no tiene teléfono registrado — pedíselo para mantener su ficha al día.`
  return null
}

export type RechazoDeGuardado =
  | 'campo_ya_tiene_valor'   // no se pisa lo que ya está: para eso está la edición normal
  | 'no_se_le_pide'          // menor, edad desconocida o datos protegidos
  | 'vacio'                  // no mandaron nada

/**
 * La decisión del SERVIDOR antes de escribir. La pantalla ya filtró, pero la
 * pantalla no es la autoridad: quien tenga el endpoint podría mandar cualquier
 * `member_id`.
 */
export function puedeGuardar(
  f: FichaEnLaPuerta,
  campo: CampoDeContacto,
  valor: string,
  hoy?: string,
): { ok: true } | { ok: false; motivo: RechazoDeGuardado } {
  if (vacio(valor)) return { ok: false, motivo: 'vacio' }
  if (!pedirContacto(f, hoy)[campo]) {
    // Distinguir los dos noes: al operador le sirve saber si el dato ya estaba
    // (y entonces alguien más lo puso) o si a esa persona no se le pide.
    return { ok: false, motivo: vacio(f[campo]) ? 'no_se_le_pide' : 'campo_ya_tiene_valor' }
  }
  return { ok: true }
}

export const MENSAJE_RECHAZO: Record<RechazoDeGuardado, string> = {
  campo_ya_tiene_valor: 'Ese dato ya está registrado. Para corregirlo hay que editar la ficha.',
  no_se_le_pide: 'A esta persona no se le piden datos de contacto desde el check-in.',
  vacio: 'Escribí el dato antes de guardar.',
}

/** El correo ya está en otra ficha. NO se dice de quién: el operador de la
 *  puerta no tiene por qué ver el padrón (mismo criterio que DAT-10). */
export const MENSAJE_CORREO_DUPLICADO =
  'Ese correo ya está registrado a nombre de otra persona. Confirmá el dato con ella.'
