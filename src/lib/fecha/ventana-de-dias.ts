/**
 * Correr una fecha YYYY-MM-DD N días, sin tocar el reloj.
 *
 * Existe para poder sacar `Date.now()` de dentro de un `useMemo`. Los cálculos
 * de "de hoy a +30 días" leían el reloj en pleno render, y eso tiene dos
 * problemas: uno teórico —un render no debe depender de algo que cambia solo— y
 * uno real, que la ventana se queda vieja si la pantalla pasa la medianoche
 * abierta. Con el día como ENTRADA, la función es pura y quien la llama decide
 * de dónde sale ese día.
 */

/** 'YYYY-MM-DD' + N días. En UTC para no arrastrar la zona del navegador: la
 *  fecha ya viene resuelta en el día de Costa Rica, acá solo se suma. */
export function sumarDias(ymd: string, dias: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + dias * 86400000).toISOString().slice(0, 10)
}

/** De hoy a +N días, ambos inclusive. */
export function ventanaDeDias(hoy: string, dias: number): { desde: string; hasta: string } {
  return { desde: hoy, hasta: sumarDias(hoy, dias) }
}
