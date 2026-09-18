/**
 * De una respuesta fallida de la API al mensaje que ve la persona.
 *
 * EL PROBLEMA QUE RESUELVE (2026-09-18). Crear un grupo fallaba y la pantalla
 * decía siempre "No se pudo crear el grupo. Revisá los datos e intentá de
 * nuevo." — porque el cliente hacía `if (!res.ok) throw new Error('Error
 * creando el grupo')` y tiraba la respuesta a la basura.
 *
 * El servidor SÍ explicaba: que el dirigente está marcado como no recomendado,
 * que está en revisión, que la pareja del prematrimonial no cuadra, o que el
 * fin de matrícula se pasa del inicio del grupo. Cuatro motivos distintos, cada
 * uno con su arreglo, y quien usaba el sistema no podía ver ninguno. Se reportó
 * como "el encargado de estudios no puede crear grupos", que no era el
 * problema: el permiso estaba bien.
 *
 * Puro y testeable: recibe el cuerpo ya parseado y el status.
 */

/** Forma de `z.treeifyError`, que es lo que manda `datosInvalidos`. */
type ArbolZod = { errors?: unknown; properties?: Record<string, { errors?: unknown }> }

type CuerpoDeError = { error?: unknown; detalles?: unknown } | null | undefined

/** Los campos que zod rechazó, en el orden en que vinieron. */
export function camposConProblema(detalles: unknown): string[] {
  const d = detalles as ArbolZod | null
  if (!d || typeof d !== 'object') return []
  return Object.keys(d.properties ?? {})
}

/**
 * @param generico qué decir cuando la respuesta no explica nada.
 *
 * El status va en el texto cuando no hay explicación: "error 403" es accionable
 * —quien lo reporta dice el número y se sabe si fue permiso, dato o caída—,
 * mientras que un mensaje sin nada no deja ni por dónde empezar.
 */
export function mensajeDelError(cuerpo: CuerpoDeError, status: number, generico: string): string {
  const dicho = typeof cuerpo?.error === 'string' ? cuerpo.error.trim() : ''

  /**
   * Un 5xx es una caída, no un dato malo, y el servidor solo contesta "Error
   * interno" — que le suena a la persona como si hubiera hecho algo mal. Se le
   * pega el código para que sea REPORTABLE: quien lo ve puede decir "me salió
   * error 500" y eso separa una caída de un permiso o de un dato.
   */
  if (status >= 500) return `${dicho || generico} (error ${status})`

  // "Datos inválidos" a secas no dice cuál: se le pegan los campos.
  const campos = camposConProblema(cuerpo?.detalles)
  if (dicho && campos.length) return `${dicho}: ${campos.join(', ')}.`
  if (dicho) return dicho
  if (campos.length) return `${generico} Revisá: ${campos.join(', ')}.`

  if (status === 401) return 'Se venció tu sesión. Volvé a entrar e intentá de nuevo.'
  if (status === 403) return 'No tenés permiso para hacer esto.'
  return `${generico} (error ${status})`
}

/** Lee la respuesta fallida y arma el mensaje. Envuelve el `res.json()` que
 *  puede no ser JSON — una caída del servidor devuelve HTML. */
export async function mensajeDeLaRespuesta(res: Response, generico: string): Promise<string> {
  const cuerpo = await res.json().catch(() => null)
  return mensajeDelError(cuerpo as CuerpoDeError, res.status, generico)
}
