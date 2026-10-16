/**
 * DIR-14 · La banderita «por compromiso», AUTOMÁTICA (pedido 2026-10-16).
 *
 * Hasta DIR-8 toda la banderita era manual. La razón «por compromiso» la pone
 * y la quita ahora un cron semanal: si un dirigente ACTIVO no cumple la
 * donación o la asistencia, se le pone con la justificación; cuando vuelve a
 * cumplir las dos, se le quita sola. Las demás razones (testimonio,
 * preparación, no confirmó datos) siguen siendo manuales y esto no las toca.
 *
 * NINGUNA REGLA SE DEFINE ACÁ. Lo que es «cumplir» viene de donde ya vive:
 *  - donación: `members.is_donor`, que mantiene `refresh_donor_flags()` con la
 *    ventana de FIN-10 (mes actual + 3 anteriores, el cónyuge cuenta);
 *  - asistencia: `getActiveAttendanceMemberIds()`, el mismo criterio de SRV-4
 *    y de la elegibilidad de estudios.
 * Este módulo es PURO: recibe esos dos datos ya resueltos y decide.
 *
 * Se guarda en columnas propias (`revision_auto_faltan`, `revision_auto_desde`)
 * y no en la lista manual: ver la migración de DIR-14 para por qué.
 */

export const FALTANTES = ['donacion', 'asistencia'] as const
export type Faltante = (typeof FALTANTES)[number]

const PALABRA: Record<Faltante, string> = { donacion: 'donación', asistencia: 'asistencia' }

/** Qué le falta, en el orden fijo de `FALTANTES` (así se compara sin ordenar). */
export function faltantesDeCompromiso(c: { donante: boolean; asistencia: boolean }): Faltante[] {
  const f: Faltante[] = []
  if (!c.donante) f.push('donacion')
  if (!c.asistencia) f.push('asistencia')
  return f
}

/** «No cumple: donación» · «No cumple: donación y asistencia». '' si no falta nada. */
export function justificacion(faltan: readonly string[]): string {
  const palabras = FALTANTES.filter(f => faltan.includes(f)).map(f => PALABRA[f])
  return palabras.length ? `No cumple: ${palabras.join(' y ')}` : ''
}

/** Lo que el cron necesita de cada dirigente. */
export type DirigenteParaRevision = {
  memberId: string
  nombre: string
  /** Activo según la ficha (`estado_base`). Sobre los inactivos no corre la regla. */
  activo: boolean
  donante: boolean
  asistencia: boolean
  /** Lo que tiene puesto HOY la banderita automática. */
  faltanAhora: readonly string[]
}

export type CambioDeRevision = {
  memberId: string
  nombre: string
  de: Faltante[]
  a: Faltante[]
}

export type RepartoDeRevision = {
  /** No la tenía y ahora sí. */
  poner: CambioDeRevision[]
  /** La tenía y le cambió lo que falta (p. ej. donó pero sigue sin asistir). */
  actualizar: CambioDeRevision[]
  /** La tenía y ya cumple, o dejó de ser activo. */
  quitar: CambioDeRevision[]
  sinCambio: number
}

const normalizar = (xs: readonly string[]): Faltante[] =>
  FALTANTES.filter(f => xs.includes(f))

/**
 * Qué hay que cambiar. IDEMPOTENTE: aplicado el resultado, la segunda corrida
 * devuelve todo en `sinCambio`.
 *
 * Un dirigente INACTIVO no lleva banderita automática: la regla es sobre los
 * activos, y dejarle una puesta de cuando lo era la mostraría para siempre.
 */
export function repartirRevision(dirigentes: readonly DirigenteParaRevision[]): RepartoDeRevision {
  const r: RepartoDeRevision = { poner: [], actualizar: [], quitar: [], sinCambio: 0 }
  for (const d of dirigentes) {
    const de = normalizar(d.faltanAhora)
    const a = d.activo ? faltantesDeCompromiso(d) : []
    const cambio = { memberId: d.memberId, nombre: d.nombre, de, a }
    if (de.join() === a.join()) r.sinCambio++
    else if (de.length === 0) r.poner.push(cambio)
    else if (a.length === 0) r.quitar.push(cambio)
    else r.actualizar.push(cambio)
  }
  return r
}

/**
 * El freno: con CERO personas cumpliendo la asistencia, el cron NO escribe.
 *
 * `getActiveAttendanceMemberIds()` devuelve `[]` cuando falla, en vez de tirar
 * (lo usan pantallas que prefieren mostrar algo). Para este cron, `[]` diría
 * «nadie asiste» y le pondría la banderita a todo el cuerpo de dirigentes de
 * un solo golpe. Un domingo cualquiera hay cientos de personas que cumplen: si
 * llegan cero, es una falla y no un dato.
 */
export function asistenciaCreible(idsConAsistencia: readonly string[]): boolean {
  return idsConAsistencia.length > 0
}

/**
 * Las razones que se MUESTRAN: las manuales, más «compromiso» si la tiene la
 * automática. Es lo que leen los filtros y el chip de la lista, que no tienen
 * por qué saber de dónde vino cada una.
 *
 * Solo para LEER. Lo que se guarda desde la ficha es la lista manual sola: si
 * se guardara esto, la automática se volvería manual y el cron ya no podría
 * quitarla.
 */
export function razonesVisibles(manual: readonly string[] | null | undefined, faltanAuto: readonly string[] | null | undefined): string[] {
  const m = [...(manual ?? [])]
  if ((faltanAuto ?? []).length > 0 && !m.includes('compromiso')) m.push('compromiso')
  return m
}
