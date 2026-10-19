/**
 * Saldo a favor: plata que una persona ya pagó y que su matrícula actual no
 * consume.
 *
 * DE DÓNDE SALE. Al mover a alguien a un estudio más barato —o gratis— su pago
 * viaja con la matrícula. Si pagó ₡20.000 y el grupo nuevo vale ₡5.000, le
 * sobran ₡15.000. Esa plata es suya y tiene que estar a la vista de finanzas.
 *
 * NO SE GUARDA EN NINGÚN LADO. Es la resta entre lo que pagó y lo que cuesta
 * su matrícula, calculada cada vez. Guardarla en su propia columna sería un
 * segundo número diciendo lo mismo que el primero, y esos dos se desalinean —
 * es exactamente el tipo de bug que dejó a Adriana con ₡10.000 pagados
 * habiendo transferido ₡5.000.
 */
export type MatriculaConPagos = {
  enrollment_id: string
  member_id: string
  member_name: string
  group_name: string | null
  /** Costo del plan del grupo. */
  costo: number
  currency: string | null
  /** Suma de los pagos APROBADOS de esa matrícula. */
  pagado: number
  /** Cuándo se generó el saldo: ver `llegadaDelPago`. */
  generado_en?: string | null
}

export type SaldoAFavor = MatriculaConPagos & { saldo: number }

/**
 * El detalle de UN saldo: de dónde salió. Pedido de Floriana (2026-10-14):
 * «de dónde salió el saldo a favor, el racional detrás de ese crédito, la
 * fecha y quién lo convirtió».
 *
 * La respuesta está en los pagos de la matrícula: cada uno con su fecha, y
 * el que viajó en un cambio de grupo trae su `transfer_note` («Movida de
 * grupo el 07/10/2026: «A» → «B» (por Fulana)») — que es quién y cuándo. El
 * costo se explica por los niveles que cubre la matrícula (bajo bloques, un
 * N1 cubre el par N1+N2).
 */
export type PagoDelSaldo = {
  id: string
  amount: number
  currency: string | null
  paid_at: string | null
  created_at: string
  payment_method: string | null
  reference_code: string | null
  description: string | null
  transfer_note: string | null
}
export type DetalleDelSaldo = {
  pagos: PagoDelSaldo[]
  /** Qué niveles cubre el costo (["N1","N2"] bajo bloques; ["SCJ"] en general). */
  cubre: string[]
  modalidad: string
}

/** Solo las que tienen plata a favor, de mayor a menor. Las que deben no van
 *  acá: eso son cobros pendientes y viven en su propia cola. */
export function saldosAFavor(filas: readonly MatriculaConPagos[]): SaldoAFavor[] {
  return filas
    .map(f => ({ ...f, saldo: Number(f.pagado) - Number(f.costo) }))
    .filter(f => f.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
}

/**
 * Cuándo llegó un pago a SU matrícula actual. Si viajó en un cambio de grupo
 * (`transfer_note`), es el momento del traslado —`updated_at`, que
 * transferEnrollment pisa al moverlo—; si no, cuándo se pagó.
 *
 * La fecha en que se GENERÓ un saldo a favor (pedido de Floriana, 2026-10-19:
 * «cuando se convierte en saldo a favor») es la llegada del ÚLTIMO pago: desde
 * ese momento lo pagado supera lo que cuesta la matrícula.
 */
export function llegadaDelPago(p: { transfer_note?: string | null; updated_at?: string | null; paid_at?: string | null; created_at?: string | null }): string | null {
  if (p.transfer_note && p.updated_at) return p.updated_at
  return p.paid_at ?? p.created_at ?? null
}

/** Total por moneda: sumar colones con dólares daría un número sin significado. */
export function totalPorMoneda(filas: readonly SaldoAFavor[]): Array<{ currency: string; total: number }> {
  const por = new Map<string, number>()
  for (const f of filas) {
    const m = f.currency ?? 'CRC'
    por.set(m, (por.get(m) ?? 0) + f.saldo)
  }
  return [...por.entries()].map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total)
}

export function plata(n: number, moneda: string | null): string {
  const entero = Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${moneda === 'USD' ? '$' : '₡'}${entero}`
}
