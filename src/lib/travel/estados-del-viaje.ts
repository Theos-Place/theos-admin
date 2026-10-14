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

/** Los que agrega la fase B (liquidación). */
export const ESTADOS_DE_FASE_B: readonly EstadoDeViaje[] = [
  'anticipo_entregado', 'liquidacion_pendiente', 'liquidada', 'cerrada',
]

/**
 * Cuándo se pueden tocar los GASTOS de la liquidación.
 *
 * Es distinto de `esEditable`, que habla del presupuesto: el presupuesto se
 * congela al enviar la solicitud y los gastos recién empiezan a existir
 * después. Tener una sola función para las dos cosas dejaría editar el
 * presupuesto de un viaje ya aprobado.
 */
export const seLiquida = (estado: EstadoDeViaje): boolean =>
  estado === 'liquidacion_pendiente'

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
 * Quién puede PEDIR un viaje: SOLO QUIEN TIENE FICHA DE EMPLEADO.
 *
 * La primera versión aproximaba «staff» con «cualquier rol que no sea
 * miembro raso», y eso dejaba pedir viáticos a dirigentes, folletos y
 * formularios. Floriana lo cerró el 2026-10-14: «por ahora nadie, hasta que
 * se llene la lista de empleados». La puerta es una fila viva en
 * `employees` (`end_date` null), que RH carga; no es un rol. Hoy esa tabla
 * está vacía, así que hoy no pide nadie — y eso es lo correcto.
 *
 * Los que REVISAN y APRUEBAN no pasan por acá: esos sí son roles.
 */
export const puedePedirViaje = (esEmpleado: boolean | null | undefined): boolean => esEmpleado === true

/** Quien revisa o aprueba ve todos los expedientes: finanzas, dirección, admin. */
export const puedeRevisarViajes = (roles: readonly string[]): boolean =>
  [...ROLES_REVISION_FINANCIERA, ...ROLES_AUTORIDAD_COMPETENTE].some(r => roles.includes(r))

/**
 * Quién puede ENTRAR a la pantalla de viáticos. Es la unión de las dos puertas
 * —pedir o revisar— y vive acá para que el guard del layout, el sidebar y la
 * API digan lo mismo. Finanzas NO tiene el módulo Empleados: sin esta regla
 * el guard por prefijo de ruta la dejaba fuera de lo que ella misma revisa.
 */
export const puedeEntrarAViaticos = (esEmpleado: boolean | null | undefined, roles: readonly string[]): boolean =>
  puedePedirViaje(esEmpleado) || puedeRevisarViajes(roles)

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

  // --- FASE B · del viaje aprobado a la liquidación cerrada ---------------
  // El anticipo lo marca finanzas cuando lo entrega, no el que lo recibe.
  { de: 'aprobada', a: 'anticipo_entregado', quien: 'revision' },
  // «Ya volví». Dos puertas porque un viaje sin anticipo no pasa por la de
  // arriba, y obligarlo a pasar sería inventarle un anticipo de cero.
  { de: 'aprobada', a: 'liquidacion_pendiente', quien: 'solicitante' },
  { de: 'anticipo_entregado', a: 'liquidacion_pendiente', quien: 'solicitante' },
  // Enviar la liquidación. La declaración jurada se exige aparte, al guardar
  // los gastos: acá el paso ya la da por firmada.
  { de: 'liquidacion_pendiente', a: 'liquidada', quien: 'solicitante' },
  // Finanzas la devuelve con observaciones, o la cierra.
  { de: 'liquidada', a: 'liquidacion_pendiente', quien: 'revision', exigeNota: true },
  { de: 'liquidada', a: 'cerrada', quien: 'revision' },
]

export type Veredicto =
  | { ok: true }
  | { ok: false; motivo: string }

export function puedeMover(
  de: EstadoDeViaje,
  a: EstadoDeViaje,
  actores: Actor | readonly Actor[],
  nota: string | null | undefined,
): Veredicto {
  const quienes = Array.isArray(actores) ? actores : [actores as Actor]
  const paso = PASOS.find(p => p.de === de && p.a === a)
  if (!paso) return { ok: false, motivo: `Un viaje en «${de}» no puede pasar a «${a}».` }
  if (!quienes.includes(paso.quien)) {
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

/**
 * TODOS los papeles que esta persona puede hacer, no uno solo.
 *
 * La primera versión devolvía uno y «el más alto ganaba». Se cayó probando
 * el flujo completo: quien tiene finanzas Y dirección —y cualquier admin—
 * quedaba como 'autoridad' a secas y YA NO PODÍA tomar un expediente para
 * revisarlo, porque ese paso es de 'revision'. El expediente se trababa y no
 * había manera de destrabarlo.
 *
 * Que alguien con los dos roles pueda dar los dos pasos es correcto y es una
 * decisión de la organización, no del código: la separación de las tres
 * firmas es POR ROL. Si hace falta que además sean tres PERSONAS distintas,
 * eso se agrega acá comparando contra quién dio el paso anterior.
 */
export function actoresDe(
  roles: readonly string[],
  esElDueno: boolean,
): Actor[] {
  const out: Actor[] = []
  if (esElDueno) out.push('solicitante')
  if (roles.some(r => (ROLES_REVISION_FINANCIERA as readonly string[]).includes(r))) out.push('revision')
  if (roles.some(r => (ROLES_AUTORIDAD_COMPETENTE as readonly string[]).includes(r))) out.push('autoridad')
  return out
}

/** ¿Se puede todavía editar el contenido del expediente? */
export const esEditable = (estado: EstadoDeViaje): boolean =>
  estado === 'borrador' || estado === 'por_corregir'

/** Los que siguen vivos, para la bandeja. */
export const ESTADOS_ABIERTOS: readonly EstadoDeViaje[] =
  ['borrador', 'enviada', 'en_revision', 'por_corregir',
    'aprobada', 'anticipo_entregado', 'liquidacion_pendiente', 'liquidada']
