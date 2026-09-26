/**
 * SRV-12 · La publicación mensual de puestos de servicio.
 *
 * CÓMO FUNCIONA EL CICLO. Los comités piden cupos del 25 al 30 (SRV-11). Los
 * primeros del mes siguiente, quien recibe las solicitudes aprieta «Publicar
 * puestos» una vez: eso BAJA lo que estaba publicado del ciclo anterior y SUBE
 * lo nuevo. La página pública (SRV-13) muestra siempre el resultado de la
 * última publicación.
 *
 * SE DESACTIVA, NO SE BORRA. Una vacante publicada tiene aplicaciones colgando
 * y un historial de quién la pidió; borrarla se llevaría las dos cosas. Pasa a
 * `cerrada`, que es el estado que este sistema ya usaba para «dejó de aceptar
 * aplicaciones» — no hacía falta inventar uno nuevo.
 *
 * EL CICLO ES EL MES CALENDARIO de la publicación, y por eso la operación es
 * IDEMPOTENTE dentro del mes: publicar dos veces el mismo día no baja lo que
 * se acaba de subir, porque lo de este mes no cuenta como «del ciclo
 * anterior». Sin eso, un doble clic vaciaría la página pública.
 *
 * Módulo PURO: decide QUÉ hacer. Quien escribe es la ruta.
 */

/** Los estados desde los que una solicitud puede publicarse: la pidió un
 *  comité y todavía no está en la calle. */
export const ESTADOS_PUBLICABLES = ['creado', 'enviado_lider'] as const

/** El estado de lo que está publicado y el de lo que se baja. */
export const ESTADO_PUBLICADO = 'aprobado'
export const ESTADO_DESACTIVADO = 'cerrada'

export type VacanteParaPublicar = {
  id: string
  status: string
  /** ISO. Cuándo se publicó la última vez. */
  published_at: string | null
}

export type PlanDePublicacion = {
  /** Se suben: pasan a publicadas con la fecha de hoy. */
  aPublicar: string[]
  /** Se bajan: quedan desactivadas, no borradas. */
  aDesactivar: string[]
}

/** El mes calendario de una fecha ISO, como `YYYY-MM`. */
export function cicloDe(iso: string | null | undefined): string | null {
  const s = (iso ?? '').slice(0, 7)
  return /^\d{4}-\d{2}$/.test(s) ? s : null
}

/**
 * Qué se sube y qué se baja si se publica AHORA.
 *
 * Una publicada SIN fecha (`published_at` en null) también se baja: es un dato
 * inconsistente —alguien la aprobó a mano sin publicarla— y dejarla arriba
 * para siempre porque no se sabe de qué ciclo es sería el peor de los dos
 * errores posibles. Bajarla es recuperable; quedarse colgada, no se nota.
 */
export function planDePublicacion(
  vacantes: readonly VacanteParaPublicar[],
  ahora: Date,
): PlanDePublicacion {
  const cicloActual = ahora.toISOString().slice(0, 7)
  const aPublicar: string[] = []
  const aDesactivar: string[] = []
  for (const v of vacantes) {
    if ((ESTADOS_PUBLICABLES as readonly string[]).includes(v.status)) {
      aPublicar.push(v.id)
      continue
    }
    if (v.status !== ESTADO_PUBLICADO) continue
    const ciclo = cicloDe(v.published_at)
    if (ciclo === null || ciclo < cicloActual) aDesactivar.push(v.id)
  }
  return { aPublicar, aDesactivar }
}

/**
 * El texto de la confirmación. Se arma acá y no en la pantalla porque tiene
 * que decir los DOS números —cuántas entran y cuántas salen— y el segundo es
 * el que la gente no espera: «publicar» suena a agregar, y además borra la
 * publicación vigente.
 */
export function textoDeConfirmacion(plan: PlanDePublicacion): string {
  const sube = plan.aPublicar.length
  const baja = plan.aDesactivar.length
  const partes: string[] = []
  partes.push(sube === 1 ? 'Se va a publicar 1 puesto.' : `Se van a publicar ${sube} puestos.`)
  if (baja > 0) {
    partes.push(baja === 1
      ? 'Y se va a bajar el 1 que está publicado del mes pasado.'
      : `Y se van a bajar los ${baja} que están publicados del mes pasado.`)
    partes.push('Los que se bajan NO se borran: quedan desactivados con sus aplicaciones.')
  }
  return partes.join(' ')
}

/** ¿Tiene sentido apretar el botón? Sin nada que subir ni bajar, no. */
export function hayAlgoQuePublicar(plan: PlanDePublicacion): boolean {
  return plan.aPublicar.length > 0 || plan.aDesactivar.length > 0
}
