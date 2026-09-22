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

import { esMenor, exigeContacto, type FichaConEdad } from '@/lib/members/reglas-de-menores'

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

/**
 * Una persona esperando algo en el panel de la puerta. Dos casos, y son
 * distintos a propósito:
 *
 *  · `contacto` — adulto sin correo o sin teléfono. Se le pide y se guarda ahí
 *    mismo (CHK-5).
 *  · `menor_sin_adulto` — menor que no tiene NINGÚN adulto en su familia. Acá
 *    no hay nada que escribir en la puerta: vincular familias es trabajo de
 *    padrón y necesita otro permiso. Lo que se hace es AVISAR, para que alguien
 *    consiga el dato mientras la persona todavía está ahí (DAT-12).
 */
export type PendienteDeContacto = {
  id: string
  name: string
} & (
  | { tipo?: 'contacto'; pedir: { email: boolean; phone: boolean } }
  | { tipo: 'menor_sin_adulto'; pedir?: undefined }
)

/**
 * DAT-12 · El menor que no tiene a quién asociarle la cuenta.
 *
 * DE DÓNDE SALE. El pedido original era aflojar el bloqueo de correo duplicado
 * para que un menor pudiera llevar el del papá. Pero el problema de fondo
 * apareció al mirarlo: en los casos que lo motivaron —Lucía y Naomy Sánchez
 * Arguedas— **el papá no tiene ficha**. No hay a quién asociarlas. Aflojar la
 * validación no resolvía nada; lo que falta es el adulto.
 *
 * Son 297 menores activos sin ningún adulto en su familia, pero solo unos 5 por
 * semana pasan por la puerta: el aviso no inunda a nadie.
 */
export const MENSAJE_MENOR_SIN_ADULTO =
  'es menor y no tiene ningún adulto asociado en el sistema. Preguntá con quién viene y pasá el dato: sin un adulto no se le puede dar acceso ni contactar a su familia.'

/** ¿Hay que avisar por este menor? */
export function avisarMenorSinAdulto(
  f: FichaConEdad & { tieneAdultoEnLaFamilia?: boolean },
  hoy?: string,
): boolean {
  if (!f.birth_date) return false          // sin fecha no se sabe, y no se inventa
  if (!esMenor(f, hoy)) return false
  return !f.tieneAdultoEnLaFamilia
}

/**
 * La cola del panel de la puerta.
 *
 * ES UNA COLA Y NO UNA PERSONA porque el check-in en familia registra a varios
 * de una: con una sola, de una familia de cuatro se le pediría el dato a uno y
 * los otros tres se perderían en silencio. Se atiende de a uno —la fila sigue
 * avanzando y dos formularios apilados la trancan— y cerrar pasa al siguiente.
 *
 * Deja fuera a quien no tiene nada que pedir, y no repite a quien ya está: con
 * el QR es fácil escanear dos veces a la misma persona, y verla aparecer dos
 * veces parece un error de la pantalla.
 */
export function encolarPendientes(
  actual: PendienteDeContacto[],
  nuevos: PendienteDeContacto[],
): PendienteDeContacto[] {
  const ya = new Set(actual.map(x => x.id))
  const utiles: PendienteDeContacto[] = []
  for (const n of nuevos) {
    // El aviso del menor siempre tiene algo que decir; el de contacto solo si
    // falta algún campo.
    if (n.tipo !== 'menor_sin_adulto' && !n.pedir.email && !n.pedir.phone) continue
    if (ya.has(n.id)) continue
    ya.add(n.id)
    utiles.push(n)
  }
  // Devuelve el MISMO array si no hay nada que agregar: en React eso evita un
  // render de más por cada check-in de alguien que ya tiene sus datos.
  return utiles.length > 0 ? [...actual, ...utiles] : actual
}
