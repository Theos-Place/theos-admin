/**
 * PAR-2 · Quién es un dirigente ACTIVO.
 *
 * LA DEFINICIÓN (decisión del usuario, 2026-09-23): está activo si
 *   (a) dirige o co-dirige un grupo en curso o en matrícula, o
 *   (b) su último grupo dirigido terminó hace 12 meses o menos —tres
 *       cuatrimestres—.
 * Inactivo si no cumple ninguna.
 *
 * QUÉ SIGNIFICABA ANTES, porque el cambio es más grande de lo que suena:
 * "activo" no era actividad reciente sino PERTENENCIA al comité de Dirigentes.
 * Alguien entraba al activarlo a mano o al asignarle un grupo (EST-1), y salía
 * al quitarlo. Nadie miraba hace cuánto había dirigido.
 *
 * ESTO ES SOLO LA REGLA. Aplicarla tiene consecuencias que viven en
 * `setDirigenteActive`: desactivar saca del comité Y revoca el rol `dirigente`.
 * Por eso la función es pura y se testea sola: la decisión de quién está activo
 * no debería depender de poder hablar con la base.
 *
 * UN CUIDADO CON LOS DATOS, medido el 2026-09-23 y que conviene no olvidar: una
 * buena parte de las fechas de cierre vienen de la importación de CCB y son
 * fechas de COHORTE, no de cierre real — el 27 de julio se repite con 156
 * grupos en 2019, 135 en 2025 y 106 en 2017. Con la ventana en 12 meses el
 * corte cae justo sobre la cohorte del 2025-07-27, y 20 de las 31 bajas de la
 * primera corrida salen de ahí. Se aplicó igual, por decisión del usuario, con
 * el dato a la vista. Si algún día las bajas se ven raras, mirar esto primero.
 */

/** Meses que vale el último grupo dirigido. Tres cuatrimestres. */
export const MESES_DE_VIGENCIA = 12

/**
 * Los estados de GRUPO que significan «lo está dando ahora» — el inciso (a).
 *
 * `en_matricula` cuenta, y no es obvio: el grupo todavía no arrancó. Va
 * incluido porque la persona YA está comprometida con ese grupo, que es lo que
 * pregunta esta definición. Medido el 2026-09-23: 77 dirigentes con un grupo
 * `en_curso` y 37 más que solo tienen uno `en_matricula`.
 *
 * NO confundir con `cursandoAhora` de `estudio-actual.ts`, que es estricto
 * (solo `en_curso`). Son preguntas distintas a propósito: ahí se pregunta si
 * alguien ya fue a una sesión; acá, si tiene un grupo a cargo.
 */
export const ESTADOS_DIRIGIENDO = ['en_curso', 'en_matricula'] as const

/**
 * ¿Alguno de estos grupos está a su cargo ahora?
 *
 * Existe para que el inciso (a) se calcule EN UN SOLO LUGAR. El cron lo
 * derivaba con un `if` suelto y la pantalla de dirigentes con otro, así que la
 * lista y el recálculo podían discrepar sin que nada lo notara.
 */
export function dirigeAhora(estadosDeSusGrupos: readonly (string | null | undefined)[]): boolean {
  return estadosDeSusGrupos.some(e => (ESTADOS_DIRIGIENDO as readonly string[]).includes(e ?? ''))
}

export type SituacionDelDirigente = {
  /** ¿Dirige o co-dirige algún grupo en curso o en matrícula? */
  dirigeAhora: boolean
  /** Fin del último grupo FINALIZADO que dirigió (YYYY-MM-DD), o null. */
  ultimoCierre: string | null
}

/**
 * @param hoy la fecha contra la que se mide, como YYYY-MM-DD. Entra como
 *   parámetro y no se lee el reloj adentro: así el test puede pararse en
 *   cualquier día y la función sigue siendo pura.
 */
export function esDirigenteActivo(s: SituacionDelDirigente, hoy: string): boolean {
  if (s.dirigeAhora) return true
  if (!s.ultimoCierre) return false
  return s.ultimoCierre >= limiteDeVigencia(hoy)
}

/**
 * La fecha más antigua que todavía cuenta (YYYY-MM-DD).
 *
 * Se resta en UTC sobre las partes de la fecha, sin construir un `Date` desde
 * el string: `new Date('2026-09-23')` es medianoche UTC y en Costa Rica sería
 * el día anterior. Comparar strings YYYY-MM-DD es exacto y no tiene zona.
 */
export function limiteDeVigencia(hoy: string): string {
  const [y, m, d] = hoy.split('-').map(Number)
  // Date.UTC normaliza el desborde de mes solo: mes 0 - 12 → año anterior.
  const lim = new Date(Date.UTC(y, m - 1 - MESES_DE_VIGENCIA, d))
  return lim.toISOString().slice(0, 10)
}

export type CambioDeDirigente = {
  memberId: string
  nombre: string
  de: boolean
  a: boolean
}

export type RepartoDeDirigentes = {
  activar: CambioDeDirigente[]
  desactivar: CambioDeDirigente[]
  sinCambio: number
}

/**
 * Qué hacer con cada dirigente.
 *
 * «EN REVISIÓN» NO ENTRA EN EL CÁLCULO. Es una ETIQUETA sobre la persona, no un
 * estado de actividad: si está dando un grupo o lo dio dentro de los tres
 * cuatrimestres, está activo, y la etiqueta se queda puesta al lado.
 *
 * Lo escribo porque mi primera versión los saltaba, y estaba mal por dos
 * motivos. Uno, mezclaba dos cosas distintas —una situación abierta con la
 * persona, y si está dirigiendo o no—. Dos, dejaba fuera del recálculo
 * justamente a quien conviene tener bien clasificado.
 *
 * Lo que sí hay que respetar es que activar NO borre la etiqueta: de eso se
 * encarga `setDirigenteActive`, que la conserva.
 */
export function repartirDirigentes(
  dirigentes: Array<{
    memberId: string; nombre: string; activoHoy: boolean
    situacion: SituacionDelDirigente
  }>,
  hoy: string,
): RepartoDeDirigentes {
  const out: RepartoDeDirigentes = { activar: [], desactivar: [], sinCambio: 0 }
  for (const d of dirigentes) {
    const deberia = esDirigenteActivo(d.situacion, hoy)
    if (deberia === d.activoHoy) { out.sinCambio++; continue }
    const cambio = { memberId: d.memberId, nombre: d.nombre, de: d.activoHoy, a: deberia }
    ;(deberia ? out.activar : out.desactivar).push(cambio)
  }
  return out
}
