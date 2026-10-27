/**
 * FIN-9 · Cómo se VE un crédito por congelamiento.
 *
 * EL BUG (reclamo de Ari, 2026-10-27): Raquel Ulate, Dennise Castañeda y Ana
 * María Murillo se matricularon a SCJ, el grupo se cerró antes de empezar y
 * estudios les congeló la matrícula. El crédito de ₡5.000 SÍ se creó —los
 * tres existen, activos, atados a su pago— pero NINGUNA pantalla lo decía:
 * el pago seguía en «Pagado» a secas, el perfil no mencionaba el crédito y
 * finanzas se enteró por correo. «Los primeros que tienen que saber» no
 * sabían.
 *
 * Esto es lo que se muestra, en un solo lugar, para que el pago, el perfil y
 * la pantalla de finanzas digan lo mismo. Módulo PURO.
 */
import { formatDate } from '@/lib/format'
import { plata } from './saldo-a-favor'

/** Lo que cualquier pantalla necesita saber de un crédito. */
export type CreditoResumen = {
  id: string
  /** Estado guardado: active | used | revoked. «Vencido» se deriva de la fecha. */
  status: string
  monto: number
  currency: string
  /** YYYY-MM-DD o ISO; null = sin vencimiento. */
  vence: string | null
  /** El porqué que escribió quien congeló. */
  motivo: string | null
  /** De qué estudio salió («Sirviendo como Jesús»), si se sabe. */
  origen: string | null
  /** El pago del que nació. */
  origin_payment_id: string | null
}

export type EstadoDelCredito = 'vigente' | 'usado' | 'vencido' | 'revocado'

/**
 * Qué le pasa hoy al crédito. El vencimiento se DERIVA: un `active` con la
 * fecha pasada ya no sirve aunque la fila no lo diga.
 */
export function estadoDelCredito(c: Pick<CreditoResumen, 'status' | 'vence'>, hoy: string): EstadoDelCredito {
  if (c.status === 'used') return 'usado'
  if (c.status === 'revoked') return 'revocado'
  if (c.vence && c.vence.slice(0, 10) < hoy.slice(0, 10)) return 'vencido'
  return 'vigente'
}

export const ETIQUETA_ESTADO: Record<EstadoDelCredito, string> = {
  vigente: 'Vigente',
  usado: 'Ya se usó',
  vencido: 'Vencido',
  revocado: 'Revocado',
}

/**
 * La etiqueta sobre el PAGO: «Pagado» a secas es mentira a medias —se pagó,
 * pero el estudio no existió—. Dice que se congeló y en qué quedó.
 */
export function etiquetaCongelado(c: CreditoResumen, hoy: string): string {
  const estado = estadoDelCredito(c, hoy)
  if (estado === 'vigente') {
    return `Congelado → crédito a favor de ${plata(c.monto, c.currency)}`
      + (c.vence ? ` (vence ${formatDate(c.vence)})` : '')
  }
  if (estado === 'usado') return 'Congelado → crédito ya usado en otra matrícula'
  if (estado === 'vencido') return `Congelado → crédito de ${plata(c.monto, c.currency)} vencido el ${formatDate(c.vence)}`
  return 'Congelado → crédito revocado'
}

/**
 * La línea del PERFIL: lo que la persona, estudios y finanzas ven en
 * «Pagos y cobros». Solo los vigentes: un crédito usado ya se cuenta en la
 * matrícula donde se aplicó, y uno vencido no es plata a favor.
 */
export function lineaDeCreditoEnPerfil(c: CreditoResumen): string {
  const origen = c.origen ? ` (origen: ${c.origen}, matrícula congelada)` : ' (matrícula congelada)'
  return `Crédito a favor: ${plata(c.monto, c.currency)}${origen}`
    + (c.vence ? ` · vence ${formatDate(c.vence)}` : '')
}

/** Los que todavía valen, de mayor a menor. */
export function creditosVigentes<T extends CreditoResumen>(cs: readonly T[], hoy: string): T[] {
  return cs.filter(c => estadoDelCredito(c, hoy) === 'vigente').sort((a, z) => z.monto - a.monto)
}

/** Total a favor por moneda, para la tarjeta de finanzas. */
export function totalPorMoneda(cs: readonly CreditoResumen[]): Array<{ currency: string; total: number }> {
  const m = new Map<string, number>()
  for (const c of cs) m.set(c.currency, (m.get(c.currency) ?? 0) + c.monto)
  return [...m.entries()].map(([currency, total]) => ({ currency, total }))
}

/* ── El aviso a finanzas ──────────────────────────────────────────────── */

export const TIPO_AVISO_FINANZAS = 'credito_emitido_finanzas'

/** Campana a finanzas cuando alguien congela. Nunca más un congelamiento que
 *  finanzas descubre por correo. */
export function avisoAFinanzas(i: {
  member_name: string
  monto: number
  currency: string
  estudio: string | null
  motivo: string
  quien: string | null
}): { title: string; body: string } {
  return {
    title: `Matrícula congelada: ${i.member_name}`,
    body: `${i.quien ?? 'Alguien'} le congeló ${i.estudio ? `${i.estudio} ` : 'la matrícula '}`
      + `y quedó un crédito de ${plata(i.monto, i.currency)} a su favor. Motivo: ${i.motivo.slice(0, 140)}`,
  }
}
