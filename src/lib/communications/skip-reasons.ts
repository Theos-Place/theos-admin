// Por qué un destinatario NO recibe un comunicado. Puro: lo usa el envío para
// explicar un "no salió nada" en vez de dejar el broadcast en 'fallido' sin más.

export type SkipReasons = {
  /** El miembro no tiene correo en su ficha. */
  sin_correo: number
  /** Correo rebotado (hard bounce): excluido siempre. */
  rebotado: number
  /** Marcó el correo como spam: excluido siempre. */
  queja: number
  /** Se dio de baja del newsletter: excluido SOLO en correos de marketing. */
  baja: number
  /** Silenció "Mensajes del sistema" (canal interna). */
  silenciado: number
}

export function emptySkipReasons(): SkipReasons {
  return { sin_correo: 0, rebotado: 0, queja: 0, baja: 0, silenciado: 0 }
}

export function totalSkipped(r: SkipReasons): number {
  return r.sin_correo + r.rebotado + r.queja + r.baja + r.silenciado
}

const PLURAL = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

/** Mensaje para cuando NINGÚN destinatario quedó elegible: dice por qué y qué
 *  hacer. `isMarketing` cambia la salida sugerida (cambiar a transaccional). */
export function noRecipientsMessage(r: SkipReasons, isMarketing: boolean): string {
  const partes: string[] = []
  if (r.baja) partes.push(PLURAL(r.baja, 'se dio de baja del newsletter', 'se dieron de baja del newsletter'))
  if (r.rebotado) partes.push(PLURAL(r.rebotado, 'tiene el correo rebotado', 'tienen el correo rebotado'))
  if (r.queja) partes.push(PLURAL(r.queja, 'marcó un correo como spam', 'marcaron un correo como spam'))
  if (r.sin_correo) partes.push(PLURAL(r.sin_correo, 'no tiene correo en su ficha', 'no tienen correo en su ficha'))
  if (r.silenciado) partes.push(PLURAL(r.silenciado, 'silenció los mensajes del sistema', 'silenciaron los mensajes del sistema'))

  if (partes.length === 0) {
    return 'No hay destinatarios: no se seleccionó a nadie. El comunicado quedó como borrador.'
  }

  const detalle = partes.length === 1
    ? partes[0]
    : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  const salida = isMarketing && r.baja > 0
    ? ' Si es un aviso necesario y no una campaña, cambialo a "transaccional" y volvé a enviarlo: eso ignora la baja del newsletter.'
    : ''
  return `Nadie quedó elegible para recibirlo: ${detalle}. El comunicado quedó como borrador, no se envió nada.${salida}`
}
