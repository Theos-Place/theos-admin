/**
 * ¿Se le pide el pago de la matrícula a esta persona, en su ficha?
 *
 * La pantalla del perfil DEDUCÍA la deuda: si la matrícula estaba viva y el
 * plan tenía costo, mostraba "Pendiente: ₡X" y un botón de pagar —hubiera o no
 * un cobro de verdad. Para los 521 participantes de grupos EN CURSO importados
 * de PCO nunca se generó ninguno: la deuda, ₡2.790.000 en total, la inventaba
 * esta pantalla. No hay una sola fila en `payments` que la respalde.
 *
 * Ya se había arreglado a medias: el freno de `groupStatus !== 'finalizado'`
 * (caso Hermenéutica 2024 de Lucía Porras) tapaba los grupos cerrados, pero los
 * que están corriendo seguían pidiendo plata.
 *
 * La regla ahora es la obvia: se pide el pago cuando EXISTE el cobro. Desde el
 * 2026-08-04 toda matrícula con costo crea su fila de pago al inscribirse, así
 * que quien se matricule hoy y no pague sigue viéndolo — que es exactamente lo
 * que se quiere. Los históricos, no.
 *
 * De yapa sale bien lo que antes había que recordar caso por caso: el dirigente
 * no paga su propio grupo y una beca del 100% no cobra. En los dos casos no se
 * crea fila, así que no se les pide nada sin necesidad de listarlos acá.
 */

/** Estados de matrícula en los que la persona todavía podría deber. */
const MATRICULA_VIVA = ['enrolled', 'pendiente_de_pago']

export function muestraDeudaDeMatricula(row: {
  /** Estado crudo de la inscripción. */
  rawStatus: string
  /** ¿El plan cobra? */
  requiresPayment: boolean
  /** Estado del GRUPO: de uno cerrado no se cobra nada. */
  groupStatus: string | null
  /** Cuántos cobros de matrícula cuelgan de esta inscripción. 0 = nunca se
   *  generó, o sea no hay deuda que mostrar. */
  paymentsCount: number
}): boolean {
  if (!MATRICULA_VIVA.includes(row.rawStatus)) return false
  if (!row.requiresPayment) return false
  if (row.groupStatus === 'finalizado') return false
  return row.paymentsCount > 0
}
