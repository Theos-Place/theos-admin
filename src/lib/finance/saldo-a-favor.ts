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
}

export type SaldoAFavor = MatriculaConPagos & { saldo: number }

/** Solo las que tienen plata a favor, de mayor a menor. Las que deben no van
 *  acá: eso son cobros pendientes y viven en su propia cola. */
export function saldosAFavor(filas: readonly MatriculaConPagos[]): SaldoAFavor[] {
  return filas
    .map(f => ({ ...f, saldo: Number(f.pagado) - Number(f.costo) }))
    .filter(f => f.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
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
