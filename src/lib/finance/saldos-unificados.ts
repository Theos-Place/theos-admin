/**
 * Una sola lista de «a quién le debemos plata» (Floriana, 2026-10-27).
 *
 * Hasta hoy la pantalla de saldos tenía DOS listas: los sobrantes de
 * matrícula (plata que pagó y su matrícula actual no consume) y, más abajo,
 * los créditos por matrícula congelada. La pregunta de finanzas es una sola,
 * así que van en la misma tabla con una columna que diga de cuál es, y el
 * detalle de cada fila al hacer clic.
 *
 * Son DISTINTOS por dentro y eso no se esconde: el sobrante no está guardado
 * en ningún lado (se calcula) y no vence; el crédito es una fila propia con
 * estado y vencimiento. Por eso la fila unificada lleva la fuente original.
 *
 * Módulo PURO.
 */
import type { SaldoAFavor } from './saldo-a-favor'
import type { CreditoResumen } from './credito-visible'
import { estadoDelCredito, ETIQUETA_ESTADO, type EstadoDelCredito } from './credito-visible'

export type TipoDeSaldo = 'sobrante' | 'congelado'

export const ETIQUETA_TIPO: Record<TipoDeSaldo, string> = {
  sobrante: 'Sobrante de matrícula',
  congelado: 'Matrícula congelada',
}

/** Lo que un crédito trae de más para la lista. */
export type CreditoEnLista = CreditoResumen & {
  member_id: string
  member_name: string
  created_at: string
  pago_descripcion: string | null
}

export type FilaDeSaldo = {
  key: string
  tipo: TipoDeSaldo
  member_id: string
  member_name: string
  /** De dónde: el grupo actual (sobrante) o el estudio congelado (crédito). */
  origen: string | null
  monto: number
  currency: string
  estado: EstadoDelCredito
  generado_en: string | null
  /** Solo el crédito vence. */
  vence: string | null
  fuente: { tipo: 'sobrante'; saldo: SaldoAFavor } | { tipo: 'congelado'; credito: CreditoEnLista }
}

/**
 * Las dos listas en una. Primero lo VIGENTE de mayor a menor, y al final lo
 * que ya no es plata a favor (usado, vencido), para que finanzas vea la
 * historia sin que le ensucie el total.
 *
 * Un crédito REVOCADO no sale: se revocó porque no debía existir (Irene
 * Arias, 2026-10-27: su pago se devolvió y el crédito sobre ese pago seguía
 * activo; «es una devolución únicamente»). No es historia de un saldo, es
 * una corrección.
 */
export function unificarSaldos(
  sobrantes: readonly SaldoAFavor[],
  creditos: readonly CreditoEnLista[],
  hoy: string,
): FilaDeSaldo[] {
  const filas: FilaDeSaldo[] = [
    ...sobrantes.map<FilaDeSaldo>(s => ({
      key: `sobrante:${s.enrollment_id}`, tipo: 'sobrante',
      member_id: s.member_id, member_name: s.member_name, origen: s.group_name,
      monto: s.saldo, currency: s.currency ?? 'CRC', estado: 'vigente',
      generado_en: s.generado_en ?? null, vence: null,
      fuente: { tipo: 'sobrante', saldo: s },
    })),
    ...creditos.filter(c => c.status !== 'revoked').map<FilaDeSaldo>(c => ({
      key: `congelado:${c.id}`, tipo: 'congelado',
      member_id: c.member_id, member_name: c.member_name, origen: c.origen,
      monto: c.monto, currency: c.currency, estado: estadoDelCredito(c, hoy),
      generado_en: c.created_at, vence: c.vence,
      fuente: { tipo: 'congelado', credito: c },
    })),
  ]
  const peso = (f: FilaDeSaldo) => (f.estado === 'vigente' ? 0 : 1)
  return filas.sort((a, b) => peso(a) - peso(b) || b.monto - a.monto || a.member_name.localeCompare(b.member_name))
}

export const ETIQUETA_ESTADO_DE_SALDO = ETIQUETA_ESTADO

/** Total a favor por moneda: SOLO lo vigente. */
export function totalVigentePorMoneda(filas: readonly FilaDeSaldo[]): Array<{ currency: string; total: number }> {
  const m = new Map<string, number>()
  for (const f of filas) if (f.estado === 'vigente') m.set(f.currency, (m.get(f.currency) ?? 0) + f.monto)
  return [...m.entries()].map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total)
}

/** Cuánta gente tiene plata a favor hoy (una persona con dos filas cuenta una). */
export function personasConSaldo(filas: readonly FilaDeSaldo[]): number {
  return new Set(filas.filter(f => f.estado === 'vigente').map(f => f.member_id)).size
}

/** La búsqueda mira persona, origen y tipo: «congelada» tiene que encontrar. */
export function coincide(f: FilaDeSaldo, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  return f.member_name.toLowerCase().includes(t)
    || (f.origen ?? '').toLowerCase().includes(t)
    || ETIQUETA_TIPO[f.tipo].toLowerCase().includes(t)
}
