import { z } from 'zod'
import { motivoNormalizado, MENSAJE_MOTIVO_CORTO } from '@/lib/finance/cancelacion-de-beca'

/**
 * API-1 · Validación del body de becas y cupones, con zod.
 *
 * Antes eran quince `if`s repartidos entre dos handlers, cada uno armando su
 * propio 400 a mano. La convención del repo (AGENTS.md) es zod con
 * `detalles: z.treeifyError(...)`, y la razón no es de estilo: con `if`s
 * encadenados el handler reporta SOLO el primer campo malo, así que quien llena
 * el formulario de un cupón con tres errores los descubre de a uno.
 *
 * El destino va como UNIÓN DISCRIMINADA por `entity_type`. La forma vieja
 * —elegir a mano entre `plan_id` y `event_id` según el tipo— aceptaba un body
 * con `entity_type: 'event'` y un `plan_id` válido: el plan se ignoraba en
 * silencio. La pantalla manda las dos claves siempre (una en null), así que las
 * dos están declaradas.
 */

/** Los campos del destino, para pegarle los propios de cada acción. Es una
 *  función y no un objeto suelto porque zod v4 no admite intersecciones como
 *  miembros de una unión discriminada: hay que construir el objeto completo. */
function conDestino<T extends z.ZodRawShape>(campos: T) {
  return z.discriminatedUnion('entity_type', [
    z.object({
      ...campos,
      entity_type: z.literal('study_plan'),
      plan_id: z.string().uuid('se requiere un destino válido'),
      event_id: z.null().optional(),
    }),
    z.object({
      ...campos,
      entity_type: z.literal('event'),
      event_id: z.string().uuid('se requiere un destino válido'),
      plan_id: z.null().optional(),
    }),
  ])
}

/**
 * Qué acción es. Se valida aparte y antes que el resto: `action` decide QUÉ
 * campos hacen falta, y un body con la acción mal escrita tiene que decir eso
 * y no una lista de campos faltantes de una acción que nadie pidió.
 */
export const scholarshipActionSchema = z.object({
  action: z.enum(['mover', 'cancelar'], { message: "debe ser 'mover' o 'cancelar'" }),
})

/** PATCH { action: 'mover' } — cambiar el destino de una beca asignada. */
export const scholarshipMoveSchema = conDestino({
  motivo: z.string().nullish(),
  /** Por omisión SÍ se avisa: mover una beca sin decirle a la persona la deja
   *  esperando en un estudio que ya no es el suyo. */
  notificar: z.boolean().default(true),
})

/** PATCH { action: 'cancelar' } — cerrar una beca sin usar. */
export const scholarshipCancelSchema = z.object({
  // La regla de qué cuenta como motivo suficiente vive en
  // lib/finance/cancelacion-de-beca, no acá: es la misma que aplica
  // revokeScholarship del otro lado, y dos copias se desalinean.
  motivo: z.unknown().transform(v => motivoNormalizado(v))
    .refine((v): v is string => v !== null, { message: MENSAJE_MOTIVO_CORTO }),
})

/** POST /api/scholarships/coupons — cupón genérico. */
export const couponCreateSchema = conDestino({
  discount_type: z.enum(['percentage', 'fixed'], { message: 'debe ser percentage o fixed' }),
  // coerce: la pantalla puede mandar el monto como texto. Es lo que hacía el
  // `Number(...)` de antes; se conserva para no romperla.
  discount_value: z.coerce.number().positive('debe ser mayor a 0'),
  code: z.string().trim().min(1, 'requerido').transform(s => s.toUpperCase()),
  // Un cupón genérico lo puede usar cualquiera: sin vencimiento queda vivo para
  // siempre. Por eso acá es obligatorio y en el resto de las becas no.
  expires_at: z.string().trim().min(1, 'requerido para cupones genéricos'),
})

/** Lo que garantiza `conDestino` después de validar. */
export type DestinoDeBeca =
  | { entity_type: 'study_plan'; plan_id: string; event_id?: null }
  | { entity_type: 'event'; event_id: string; plan_id?: null }

/** El id del destino ya resuelto, para no repetir el ternario en cada handler. */
export function idDelDestino(d: DestinoDeBeca): string {
  return d.entity_type === 'study_plan' ? d.plan_id : d.event_id
}
