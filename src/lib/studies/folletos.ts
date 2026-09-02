// Folletos — reglas y etiquetas (módulo puro, cliente + servidor).

/** Nivel origen → nivel destino. Solo estos planes generan folletos al cerrar. */
export const FOLLETO_NEXT_LEVEL: Record<string, string> = {
  N1: 'N2',
  N2: 'N3',
  N3: 'N4',
  DIS1: 'DIS2',
  DIS2: 'DIS3',
}

/** Códigos de plan que disparan el paso de folletos en el cierre. */
export const FOLLETO_ELIGIBLE_CODES = Object.keys(FOLLETO_NEXT_LEVEL)

export function isFolletoEligible(planCode: string | null | undefined): boolean {
  return !!planCode && planCode in FOLLETO_NEXT_LEVEL
}

export function nextLevelCode(planCode: string | null | undefined): string | null {
  return planCode ? FOLLETO_NEXT_LEVEL[planCode] ?? null : null
}

/** Etiqueta legible del código de nivel (N2 → "Nivel 2", DIS2 → "Discípulos 2"). */
export function levelLabel(code: string | null | undefined): string {
  if (!code) return ''
  if (/^N\d+$/.test(code)) return `Nivel ${code.slice(1)}`
  if (/^DIS\d+$/.test(code)) return `Discípulos ${code.slice(3)}`
  if (code === 'PREMAT') return 'Prematrimonial'
  return code
}

/** Valor centinela del selector de lugar de entrega: "Otro lugar…" abre un
 *  texto libre. Nunca se guarda — si llega al servidor, es un bug del cliente.
 *  El prefijo `__` lo hace imposible de confundir con el nombre de una sede. */
export const OTRO_LUGAR = '__otro__'

/** Días que tardan los folletos en estar en la sede, contados desde el cierre.
 *  Eran 14 (2 semanas); el usuario corrigió a 8 el 2026-09-02. */
export const FOLLETO_LEAD_DAYS = 8

/** fecha de cierre (YYYY-MM-DD) + los días de imprenta → YYYY-MM-DD. */
export function estimatedAvailableDate(closeDateIso: string): string {
  const d = new Date(`${closeDateIso}T00:00:00`)
  d.setDate(d.getDate() + FOLLETO_LEAD_DAYS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Estados ──────────────────────────────────────────────────────────────────
export const FOLLETO_STATES = ['creada', 'en_impresion', 'enviado_entregado', 'cerrada'] as const
export type FolletoState = (typeof FOLLETO_STATES)[number]

export const FOLLETO_STATE_LABEL: Record<FolletoState, string> = {
  creada: 'Creada',
  en_impresion: 'En impresión',
  enviado_entregado: 'Enviado / Entregado',
  cerrada: 'Cerrada',
}

export const FOLLETO_STATE_BADGE: Record<FolletoState, string> = {
  creada: 'bg-navy-light/10 text-navy-light/80',
  en_impresion: 'bg-amber-50 text-amber-700',
  enviado_entregado: 'bg-teal-deep/10 text-teal-deep',
  cerrada: 'bg-teal-soft/30 text-teal-deep',
}

export function isFolletoState(v: string): v is FolletoState {
  return (FOLLETO_STATES as readonly string[]).includes(v)
}

/** Siguiente estado del flujo lineal, o null si ya está en el último. */
export function nextFolletoState(s: FolletoState): FolletoState | null {
  const i = FOLLETO_STATES.indexOf(s)
  return i >= 0 && i < FOLLETO_STATES.length - 1 ? FOLLETO_STATES[i + 1] : null
}
