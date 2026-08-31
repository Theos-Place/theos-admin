/**
 * A dónde se paga, y qué escribir en el detalle.
 *
 * Vive en un solo lugar porque aparece en seis pantallas y correos distintos
 * (matrícula, /mis-pagos, inscripción a evento, cobro de evento, comprobante
 * rechazado, aviso de cobro). Si los datos cambian —un número de SINPE, una
 * cuenta— se cambian acá y no se sale a buscarlos por el código.
 *
 * El detalle NO es un adorno: sin "curso + nombre" finanzas recibe un SINPE
 * suelto y no sabe a quién acreditárselo. Por eso `detalleSugerido` arma el
 * texto ya listo para copiar y pegar, en vez de pedirle a la persona que lo
 * componga.
 */

export const SINPE_TELEFONO = '8726 7406'

export const CUENTA_BAC = {
  banco: 'BAC',
  moneda: 'colones',
  numero: '908921570',
  iban: 'CR36010200009089215706',
} as const

/** Qué poner en el detalle de la transferencia: el curso o evento y la persona
 *  INSCRITA (que no siempre es quien paga — un papá pagando por su hijo).
 *
 *  Si falta alguno de los dos se devuelve el que haya, sin el guion suelto ni
 *  un "undefined" a la vista. */
export function detalleSugerido(
  concepto: string | null | undefined,
  nombreInscrito: string | null | undefined,
): string {
  const partes = [concepto, nombreInscrito].map(p => (p ?? '').trim()).filter(Boolean)
  return partes.join(' — ')
}

/** Versión de una línea, para lugares apretados (un aviso, una notificación). */
export function instruccionesUnaLinea(): string {
  return `SINPE ${SINPE_TELEFONO} o cuenta ${CUENTA_BAC.banco} en ${CUENTA_BAC.moneda} ${CUENTA_BAC.numero}`
}

/** Bloque para correos. HTML plano a propósito: se mete dentro de renderEmail,
 *  que ya pone la tipografía y el ancho. El IBAN va en <code> para que no lo
 *  parta el cliente de correo a media cadena. */
export function instruccionesHtml(detalle?: string): string {
  const conDetalle = detalle?.trim()
    ? `<p style="margin:12px 0 0;"><strong>Importante:</strong> poné esto en el detalle de la
         transferencia, para que podamos identificar tu pago:<br />
         <code style="background:#fff;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;">${detalle.trim()}</code></p>`
    : `<p style="margin:12px 0 0;"><strong>Importante:</strong> en el detalle de la transferencia
         poné el nombre del curso o evento y el nombre de la persona inscrita, para que
         podamos identificar tu pago.</p>`
  return `
    <div style="background:#f5f6f8;border-radius:10px;padding:16px 18px;margin:20px 0;">
      <p style="margin:0 0 10px;font-weight:600;">Cómo pagar</p>
      <p style="margin:0 0 8px;"><strong>SINPE Móvil:</strong> ${SINPE_TELEFONO}</p>
      <p style="margin:0;"><strong>Cuenta ${CUENTA_BAC.banco} en ${CUENTA_BAC.moneda}</strong><br />
        Número: ${CUENTA_BAC.numero}<br />
        IBAN: <code>${CUENTA_BAC.iban}</code></p>
      ${conDetalle}
    </div>`
}
