/**
 * DIR-8 · La taxonomía de estados del dirigente.
 *
 * Acordada con Fabiola el 2026-10-12 y fijada con su diagrama. Reemplaza el
 * set viejo —`available` / `inactive` / `resting` / `en_revision`, todo
 * plano en una columna— que mezclaba tres preguntas distintas:
 *
 *   1. ¿SIGUE SIENDO dirigente?            → activo / inactivo
 *   2. ¿PUEDE TOMAR un grupo ahora?        → disponible / no disponible
 *   3. ¿HAY ALGO QUE MIRAR con esta persona? → la banderita
 *
 * Mezcladas, no se podía responder ninguna: «en revisión» tapaba si la
 * persona estaba disponible, y «resting» no decía si volvía.
 *
 * LO QUE ES AUTOMÁTICO Y LO QUE NO. El estado base lo decide el sistema
 * (PAR-2: dirigir activa; doce meses sin dirigir desactiva) y «dirigiendo un
 * estudio» también. Todo lo demás lo pone coordinación a mano, incluida la
 * banderita de datos sin confirmar — decisión de Floriana del 2026-10-12,
 * aunque el diagrama la pinte distinta.
 *
 * Módulo PURO.
 */

/* ── 1 · Estado base ─────────────────────────────────────────────────── */

export const ESTADOS_BASE = ['activo', 'inactivo'] as const
export type EstadoBase = (typeof ESTADOS_BASE)[number]

/* ── 2 · Si está INACTIVO, por qué ───────────────────────────────────── */

export const RAZONES_INACTIVO = ['no_asiste', 'asiste_no_ejerce'] as const
export type RazonInactivo = (typeof RAZONES_INACTIVO)[number]

/** Solo cuando la razón es `asiste_no_ejerce`. */
export const DETALLES_NO_EJERCE = ['no_aprobo_cdeb', 'decision_propia'] as const
export type DetalleNoEjerce = (typeof DETALLES_NO_EJERCE)[number]

/** Solo cuando el detalle es `no_aprobo_cdeb`. */
export const SITUACIONES_CDEB = ['definitivo', 'seguimiento'] as const
export type SituacionCdeb = (typeof SITUACIONES_CDEB)[number]

/* ── 3 · Si está ACTIVO, puede o no tomar grupo ──────────────────────── */

export const DISPONIBILIDADES = ['disponible', 'no_disponible'] as const
export type Disponibilidad = (typeof DISPONIBILIDADES)[number]

export const RAZONES_NO_DISPONIBLE = [
  'dirigiendo',
  'estudiante_capacitacion',
  'en_formacion',
  'pasantia',
  'pausa',
] as const
export type RazonNoDisponible = (typeof RAZONES_NO_DISPONIBLE)[number]

/** La ÚNICA que pone el sistema solo. Las demás las elige coordinación. */
export const RAZON_AUTOMATICA: RazonNoDisponible = 'dirigiendo'

/* ── 4 · La banderita, que coexiste con cualquier estado ─────────────── */

export const RAZONES_DE_REVISION = [
  'testimonio',
  'compromiso',
  'preparacion',
  'no_confirmo_datos',
] as const
export type RazonDeRevision = (typeof RAZONES_DE_REVISION)[number]

/**
 * DIR-14 · Las que se marcan A MANO. «Por compromiso» salió de esta lista: la
 * pone y la quita el cron semanal (ver `revision-por-compromiso.ts`). Si se
 * pudiera marcar también a mano, el cron no sabría si quitarla cuando la
 * persona vuelve a cumplir.
 */
export const RAZONES_DE_REVISION_MANUALES = [
  'testimonio',
  'preparacion',
  'no_confirmo_datos',
] as const satisfies readonly RazonDeRevision[]

/* ── Dónde se puede escribir una nota ────────────────────────────────── */

/**
 * Las notas son OPCIONALES y solo en estos cinco lugares (las flechas rojas
 * del diagrama). No en todos los estados: un campo de texto en cada nodo se
 * vuelve un formulario que nadie llena.
 *
 * La de `pausa` es la excepción: ahí la justificación NO es opcional, va
 * junto con la fecha de regreso.
 */
export const LUGARES_CON_NOTA = [
  'revision',
  'cdeb_definitivo',
  'cdeb_seguimiento',
  'decision_propia',
  'pausa',
] as const
export type LugarConNota = (typeof LUGARES_CON_NOTA)[number]

export function admiteNota(lugar: string): lugar is LugarConNota {
  return (LUGARES_CON_NOTA as readonly string[]).includes(lugar)
}

/* ── El estado completo de una persona ───────────────────────────────── */

export type EstadoDelDirigente = {
  base: EstadoBase
  razonInactivo: RazonInactivo | null
  detalleNoEjerce: DetalleNoEjerce | null
  situacionCdeb: SituacionCdeb | null
  disponibilidad: Disponibilidad | null
  razonNoDisponible: RazonNoDisponible | null
  /** Obligatoria con `pausa`: una pausa sin fecha es una baja disfrazada. */
  pausaHasta: string | null
  /** Puede tener varias a la vez, o ninguna. */
  revision: readonly RazonDeRevision[]
}

/* ── Qué combinaciones son válidas ───────────────────────────────────── */

/**
 * Devuelve el motivo por el que este estado NO se puede guardar, o null.
 *
 * Se valida la FORMA completa y no cada campo por su lado, porque lo que
 * importa son las combinaciones: un «inactivo» con razón de no
 * disponibilidad no significa nada, y guardarlo deja una ficha que después
 * nadie sabe leer.
 */
export function motivoInvalido(e: EstadoDelDirigente): string | null {
  if (e.base === 'inactivo') {
    if (e.disponibilidad || e.razonNoDisponible) {
      return 'Un dirigente inactivo no lleva disponibilidad: eso es de los activos.'
    }
    if (!e.razonInactivo) return 'Falta decir por qué está inactivo.'
    if (e.razonInactivo === 'no_asiste' && e.detalleNoEjerce) {
      return 'El detalle es solo para quien asiste pero no ejerce.'
    }
    if (e.razonInactivo === 'asiste_no_ejerce') {
      if (!e.detalleNoEjerce) return 'Falta decir si no aprobó el CDEB o si fue decisión propia.'
      if (e.detalleNoEjerce === 'no_aprobo_cdeb' && !e.situacionCdeb) {
        return 'Falta decir si es definitivo o si se le da seguimiento.'
      }
      if (e.detalleNoEjerce === 'decision_propia' && e.situacionCdeb) {
        return 'La situación del CDEB no aplica a una decisión propia.'
      }
    }
    return null
  }

  // Activo.
  if (e.razonInactivo || e.detalleNoEjerce || e.situacionCdeb) {
    return 'Un dirigente activo no lleva razones de inactividad.'
  }
  if (!e.disponibilidad) return 'Falta decir si está disponible o no.'
  if (e.disponibilidad === 'disponible' && e.razonNoDisponible) {
    return 'Si está disponible no lleva razón de no disponibilidad.'
  }
  if (e.disponibilidad === 'no_disponible') {
    if (!e.razonNoDisponible) return 'Falta decir por qué no está disponible.'
    if (e.razonNoDisponible === 'pausa' && !e.pausaHasta) {
      // Una pausa sin fecha es una baja que nadie se anima a declarar, y
      // seis meses después nadie sabe si la persona vuelve.
      return 'Una pausa necesita fecha de regreso.'
    }
  }
  if (e.razonNoDisponible !== 'pausa' && e.pausaHasta) {
    return 'La fecha de regreso es solo para una pausa.'
  }
  return null
}

export function esValido(e: EstadoDelDirigente): boolean {
  return motivoInvalido(e) === null
}

/* ── Cómo se dice en pantalla ────────────────────────────────────────── */

export const ETIQUETA_BASE: Record<EstadoBase, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
}

export const ETIQUETA_RAZON_INACTIVO: Record<RazonInactivo, string> = {
  no_asiste: 'No asiste a Theos',
  asiste_no_ejerce: 'Asiste, pero no ejerce este servicio',
}

export const ETIQUETA_DETALLE: Record<DetalleNoEjerce, string> = {
  no_aprobo_cdeb: 'No aprobó el CDEB',
  decision_propia: 'Por decisión propia',
}

export const ETIQUETA_CDEB: Record<SituacionCdeb, string> = {
  definitivo: 'Definitivo',
  seguimiento: 'Se le da seguimiento',
}

export const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: 'Disponible',
  no_disponible: 'No disponible',
}

export const ETIQUETA_NO_DISPONIBLE: Record<RazonNoDisponible, string> = {
  dirigiendo: 'Dirigiendo un estudio',
  estudiante_capacitacion: 'Estudiante en una capacitación',
  en_formacion: 'En formación para dar una capacitación',
  pasantia: 'En pasantía',
  pausa: 'En pausa',
}

export const ETIQUETA_REVISION: Record<RazonDeRevision, string> = {
  testimonio: 'Por testimonio',
  compromiso: 'Por compromiso',
  preparacion: 'Por preparación',
  no_confirmo_datos: 'No confirmó sus datos',
}

/** El estado en una línea, como se lee en la ficha y en el reporte. */
export function resumen(e: EstadoDelDirigente): string {
  if (e.base === 'inactivo') {
    const partes = [ETIQUETA_BASE.inactivo]
    if (e.razonInactivo) partes.push(ETIQUETA_RAZON_INACTIVO[e.razonInactivo])
    if (e.detalleNoEjerce) partes.push(ETIQUETA_DETALLE[e.detalleNoEjerce])
    if (e.situacionCdeb) partes.push(ETIQUETA_CDEB[e.situacionCdeb])
    return partes.join(' · ')
  }
  if (e.disponibilidad === 'no_disponible' && e.razonNoDisponible) {
    return `${ETIQUETA_BASE.activo} · ${ETIQUETA_NO_DISPONIBLE[e.razonNoDisponible]}`
  }
  return `${ETIQUETA_BASE.activo} · ${ETIQUETA_DISPONIBILIDAD.disponible}`
}
