/**
 * FIN-11 · El expediente de viaje y por dónde puede pasar.
 *
 * Las tres firmas del papel (ANX-01) se vuelven estados con actor y fecha. El
 * reglamento es de papel y el papel no se equivoca de orden: acá sí se puede,
 * y por eso el paso de un estado a otro no se decide en la pantalla ni en el
 * handler, sino en esta tabla.
 *
 * FASE A del plan: solicitud, presupuesto y aprobaciones. Los estados de
 * anticipo, liquidación e informe YA ESTÁN DECLARADOS aunque todavía no se
 * usen — no para adelantar trabajo, sino para que el CHECK de la base no haya
 * que tocarlo dos veces y para que quien lea esto vea el camino completo.
 *
 * Módulo PURO.
 */

export const ESTADOS_DE_VIAJE = [
  'borrador',          // el solicitante lo está llenando; solo él lo ve
  'enviada',           // mandada: espera revisión administrativa/financiera
  'en_revision',       // finanzas la tomó
  'por_corregir',      // devuelta al solicitante con observaciones
  'aprobada',          // la autoridad competente la aprobó
  'rechazada',
  'cancelada',         // la retiró el solicitante
  // Fases B–D. Declarados a propósito; todavía nadie los escribe.
  'anticipo_entregado',
  'en_viaje',
  'liquidacion_pendiente',
  'liquidada',
  'cerrada',
] as const

export type EstadoDeViaje = (typeof ESTADOS_DE_VIAJE)[number]

/** Hasta dónde llega la fase A. Lo usan los tests y el CHECK de la migración. */
export const ESTADOS_DE_FASE_A: readonly EstadoDeViaje[] = [
  'borrador', 'enviada', 'en_revision', 'por_corregir', 'aprobada', 'rechazada', 'cancelada',
]

/**
 * QUIÉN APRUEBA, en un solo lugar.
 *
 * El reglamento dice «revisión administrativa/financiera» y «autoridad
 * competente» sin nombrar cargos del sistema. Esta es la traducción, y es un
 * PARÁMETRO: Floriana la confirma y si cambia, cambia acá y en ningún otro
 * lado. `admin` entra en todas porque si no, un bloqueo en el flujo no lo
 * puede destrabar nadie.
 */
export const ROLES_REVISION_FINANCIERA = ['finanzas', 'admin'] as const
export const ROLES_AUTORIDAD_COMPETENTE = ['direccion', 'admin'] as const

/**
 * Quién puede PEDIR un viaje.
 *
 * La minuta del 2026-09-29 dice «formularios restringidos a staff». El
 * sistema no tiene todavía una tabla de empleados (EMP-1 quedó para 2027),
 * así que «staff» se aproxima con lo único que hoy existe y es verificable:
 * tener algún rol que no sea el de miembro raso. Es una aproximación, está
 * dicho que lo es, y se cambia acá cuando EMP-1 traiga la definición buena.
 */
export const ROLES_QUE_NO_SON_STAFF = ['miembro', 'solo_lectura'] as const

export const puedePedirViaje = (roles: readonly string[]): boolean =>
  roles.some(r => !(ROLES_QUE_NO_SON_STAFF as readonly string[]).includes(r))

/** Quién puede mover el expediente: el dueño, finanzas o la autoridad. */
export type Actor = 'solicitante' | 'revision' | 'autoridad'

type Paso = { de: EstadoDeViaje; a: EstadoDeViaje; quien: Actor; exigeNota?: boolean }

/**
 * LOS PASOS QUE EXISTEN. Cualquier otro no existe.
 *
 * Se escribe como lista y no como `if`s porque la pregunta que hay que poder
 * contestar mirando el código es «¿quién puede mandar esto a aprobada?», y
 * con `if`s repartidos esa pregunta se contesta leyendo tres archivos.
 */
export const PASOS: readonly Paso[] = [
  { de: 'borrador', a: 'enviada', quien: 'solicitante' },
  { de: 'borrador', a: 'cancelada', quien: 'solicitante' },
  { de: 'enviada', a: 'en_revision', quien: 'revision' },
  { de: 'enviada', a: 'cancelada', quien: 'solicitante' },
  { de: 'enviada', a: 'rechazada', quien: 'revision', exigeNota: true },
  { de: 'en_revision', a: 'por_corregir', quien: 'revision', exigeNota: true },
  { de: 'en_revision', a: 'rechazada', quien: 'revision', exigeNota: true },
  // El paso que importa: de la revisión financiera NO se sale a «aprobada»
  // por la misma mano. Lo aprueba la autoridad competente, que es la tercera
  // firma del papel.
  { de: 'en_revision', a: 'aprobada', quien: 'autoridad' },
  { de: 'por_corregir', a: 'enviada', quien: 'solicitante' },
  { de: 'por_corregir', a: 'cancelada', quien: 'solicitante' },
]

export type Veredicto =
  | { ok: true }
  | { ok: false; motivo: string }

export function puedeMover(
  de: EstadoDeViaje,
  a: EstadoDeViaje,
  actor: Actor,
  nota: string | null | undefined,
): Veredicto {
  const paso = PASOS.find(p => p.de === de && p.a === a)
  if (!paso) return { ok: false, motivo: `Un viaje en «${de}» no puede pasar a «${a}».` }
  if (paso.quien !== actor) {
    const dueno = paso.quien === 'solicitante' ? 'quien pidió el viaje'
      : paso.quien === 'revision' ? 'finanzas'
        : 'la autoridad que aprueba'
    return { ok: false, motivo: `Ese paso lo da ${dueno}.` }
  }
  if (paso.exigeNota && !(nota ?? '').trim()) {
    return { ok: false, motivo: 'Hay que decir por qué.' }
  }
  return { ok: true }
}

/** El actor que le toca a estos roles. El más alto gana. */
export function actorDe(
  roles: readonly string[],
  esElDueno: boolean,
): Actor | null {
  if (roles.some(r => (ROLES_AUTORIDAD_COMPETENTE as readonly string[]).includes(r))) return 'autoridad'
  if (roles.some(r => (ROLES_REVISION_FINANCIERA as readonly string[]).includes(r))) return 'revision'
  return esElDueno ? 'solicitante' : null
}

/** ¿Se puede todavía editar el contenido del expediente? */
export const esEditable = (estado: EstadoDeViaje): boolean =>
  estado === 'borrador' || estado === 'por_corregir'

/** Los que siguen vivos, para la bandeja. */
export const ESTADOS_ABIERTOS: readonly EstadoDeViaje[] =
  ['borrador', 'enviada', 'en_revision', 'por_corregir']
