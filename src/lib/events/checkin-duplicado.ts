/**
 * Qué se le dice al operador cuando la persona YA hizo check-in.
 *
 * No es un error y no debe tratarse como tal: en la puerta de un evento el caso
 * normal es que el operador DUDE —"¿ya la registré?"— y la respuesta correcta
 * es mostrarle el estado, no un mensaje rojo. El segundo caso, mucho menos
 * frecuente, es que el registro haya sido un error y haya que deshacerlo.
 *
 * Antes no pasaba ninguna de las dos cosas: seleccionar a alguien ya registrado
 * no decía nada. El operador quedaba a ciegas y volvía a intentar.
 */

export type CheckinExistente = {
  id: string
  /** ISO. Cuándo se registró. */
  checked_at: string
  /** 'asistente' | 'servidor' (lo que guarda la base). */
  checked_in_as?: string | null
  /** Quién lo registró, si se sabe. */
  operador?: string | null
}

/** Hora en formato de reloj de Costa Rica: "7:42 p. m." */
export function horaDelCheckin(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CR', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
  })
}

export function etiquetaDeCalidad(calidad: string | null | undefined): string {
  return calidad === 'servidor' ? 'servidor' : 'asistente'
}

/**
 * La marca que va al lado del nombre en los resultados de la búsqueda, para que
 * el operador lo sepa ANTES de tocar. Null = esa persona no está registrada.
 */
export function marcaEnLaBusqueda(c: CheckinExistente | null | undefined): string | null {
  if (!c) return null
  return `✓ ${horaDelCheckin(c.checked_at)} · ${etiquetaDeCalidad(c.checked_in_as)}`
}

/** El texto del panel al seleccionar a alguien que ya estaba registrado. */
export function textoYaRegistrado(c: CheckinExistente): string {
  const hora = horaDelCheckin(c.checked_at)
  const como = etiquetaDeCalidad(c.checked_in_as)
  const quien = c.operador ? ` por ${c.operador}` : ''
  return `Ya hizo check-in a las ${hora} como ${como}${quien}.`
}

/** La confirmación del deshacer. Dice qué se pierde, no solo "¿seguro?". */
export function textoDeshacer(nombre: string): string {
  return `¿Quitar el check-in de ${nombre}? Esto la saca de la lista de asistencia.`
}

/** Lo que se le muestra al operador de puerta cuando el QR ya estaba leído. */
export function textoQrRepetido(nombre: string, c: CheckinExistente): string {
  return `${nombre} ya estaba registrada a las ${horaDelCheckin(c.checked_at)}`
}

/** Código del 409. La UI lo usa para pintar el panel en vez de un error. */
export const YA_REGISTRADO = 'duplicate'

/**
 * ¿La respuesta del servidor dice "ya estaba registrada"?
 *
 * Se mira el CÓDIGO y no el status a secas: el POST también devuelve 409 para
 * `not_registered` (evento pago sin inscripción), que es otra cosa y lleva
 * otra pantalla.
 */
export function esYaRegistrado(status: number, body: { code?: string } | null): boolean {
  return status === 409 && body?.code === YA_REGISTRADO
}
