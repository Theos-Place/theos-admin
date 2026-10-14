/**
 * «Volley · 18 oct 2026»: el título del evento y el día de la sesión.
 *
 * POR QUÉ EL DÍA. Un formulario compartido por cuatro sesiones de Volley deja
 * cuatro pagos que decían «Volley · ₡3.000», idénticos entre sí, y Floriana
 * los leyó como duplicados (2026-10-14). No lo eran: eran cuatro fechas. Lo
 * mismo con «Sports Day» y «Hiking», que nacen del mismo formulario.
 *
 * El día sale del string, sin construir Date: `new Date('…T00:30:00Z')` en
 * Costa Rica es el día anterior.
 *
 * Módulo PURO.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

export function descripcionDeEvento(
  ev: { title: string; starts_at?: string | null } | null | undefined,
): string | null {
  if (!ev?.title) return null
  const t = ev.title.trim()
  const m = (ev.starts_at ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return t
  return `${t} · ${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`
}
