// Folletos — reglas y etiquetas (módulo puro, cliente + servidor).

/** Nivel origen → nivel destino. Solo estos planes generan folletos al cerrar. */
export const FOLLETO_NEXT_LEVEL: Record<string, string> = {
  N1: 'N2',
  N2: 'N3',
  N3: 'N4',
  DIS1: 'DIS2',
  DIS2: 'DIS3',
}

export function isFolletoEligible(planCode: string | null | undefined): boolean {
  return !!planCode && planCode in FOLLETO_NEXT_LEVEL
}

export function nextLevelCode(planCode: string | null | undefined): string | null {
  return planCode ? FOLLETO_NEXT_LEVEL[planCode] ?? null : null
}

/** Etiqueta legible del código de nivel (N2 → "Nivel 2", DIS2 → "Discípulos 2"). */
import { folletosQuePide } from './corte-de-bloque'
import { modalidadDe, type Modalidad } from './modalidad-de-bloques'

/**
 * ¿El CIERRE de un grupo de este plan va a pedir folletos?
 *
 * Son dos preguntas distintas que estaban pegadas: «¿hay sucesor?»
 * (`isFolletoEligible`, que además mueve la matrícula y el cobro) y «¿el
 * sucesor pide folletos?» (`folletosQuePide`). Un cierre 1→2 de discípulos
 * tiene sucesor y NO pide folletos: la pantalla de cierre exigía el lugar de
 * entrega igual, y el tiquete se creaba (2026-10-26). Acá se pregunta por el
 * SUCESOR, que es quien recibe los folletos.
 */
export function cierrePideFolletos(
  sourceCode: string | null | undefined,
  modalidad: string | null | undefined,
): boolean {
  const next = nextLevelCode(sourceCode)
  return !!next && folletosQuePide(next, modalidadDe(modalidad)).length > 0
}

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
/**
 * FOL-3 (2026-10-29, pedido de Floriana): la cadena es creado → en impresión →
 * empacado → enviado/entregado, exactamente esos cuatro y en ese orden.
 * «Cerrada» se elimina: no había ningún tiquete en ese estado en producción
 * (6 creadas, 2 en impresión, 35 enviadas) y nadie sabía qué significaba
 * distinto de «enviado». El valor interno `creada` se conserva —renombrarlo
 * en BD no aporta nada y deja literales sueltos—; lo que se ve es «Creado».
 */
export const FOLLETO_STATES = ['creada', 'en_impresion', 'empacado', 'enviado_entregado'] as const
export type FolletoState = (typeof FOLLETO_STATES)[number]

export const FOLLETO_STATE_LABEL: Record<FolletoState, string> = {
  creada: 'Creado',
  en_impresion: 'En impresión',
  empacado: 'Empacado',
  enviado_entregado: 'Enviado / Entregado',
}

export const FOLLETO_STATE_BADGE: Record<FolletoState, string> = {
  creada: 'bg-navy-light/10 text-navy-light/80',
  en_impresion: 'bg-amber-50 text-amber-700',
  empacado: 'bg-teal-soft/30 text-teal-ink',
  enviado_entregado: 'bg-teal-deep/10 text-teal-ink',
}

export function isFolletoState(v: string): v is FolletoState {
  return (FOLLETO_STATES as readonly string[]).includes(v)
}

/** Siguiente estado del flujo lineal, o null si ya está en el último. */
export function nextFolletoState(s: FolletoState): FolletoState | null {
  const i = FOLLETO_STATES.indexOf(s)
  return i >= 0 && i < FOLLETO_STATES.length - 1 ? FOLLETO_STATES[i + 1] : null
}

/**
 * Qué folletos cubre UNA orden, en texto: «Nivel 1 y Nivel 2».
 *
 * Los del par van en la MISMA orden —decisión de Floriana del 2026-10-01,
 * después de probarlo—: quien imprime recibe un pedido por grupo, no dos que
 * tiene que juntar mentalmente.
 *
 * El par no se guarda en la fila: se DERIVA del plan del grupo con
 * `folletosQuePide`, la misma función que decide qué se cobra y qué se
 * imprime. Guardarlo sería una tercera copia de la regla, y la fila vieja
 * quedaría mintiendo el día que el par cambie.
 */
export function etiquetaDeFolletos(
  planCode: string | null | undefined,
  modalidad: Modalidad,
): string {
  const codes = folletosQuePide(planCode, modalidad)
  if (codes.length === 0) return ''
  const nombres = codes.map(levelLabel)
  // «Discípulos 1, 2 y 3» y no «Discípulos 1 y Discípulos 2 y Discípulos 3».
  if (nombres.length === 3 && nombres.every(n => n.split(' ')[0] === nombres[0].split(' ')[0])) {
    const ultima = (n: string) => n.split(' ').slice(-1)[0]
    return `${nombres[0]}, ${ultima(nombres[1])} y ${ultima(nombres[2])}`
  }
  return nombres.join(' y ')
}

/**
 * El nombre del grupo para el título del tiquete, CON el dirigente si el
 * nombre no lo trae (2026-10-19). Los grupos del histórico se llaman «Nivel 3.
 * Mirtha Cruz. Setiembre 2026» y ya lo dicen; los creados en el sistema, «N2 —
 * Escazú», y quien imprime no sabía de quién era el tiquete.
 */
export function nombreConDirigente(nombre: string | null | undefined, dirigente: string | null | undefined): string {
  const n = (nombre ?? '').trim()
  const d = (dirigente ?? '').trim()
  if (!d) return n || '—'
  if (!n) return d
  const plano = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  // Basta con nombre y primer apellido: «Mirtha Cruz» está en el grupo aunque
  // la ficha diga «Mirtha Cruz Graña».
  const [primero, apellido] = plano(d).split(/\s+/)
  const yaLoDice = plano(n).includes(primero) && (!apellido || plano(n).includes(apellido))
  return yaLoDice ? n : `${n} · ${d}`
}
