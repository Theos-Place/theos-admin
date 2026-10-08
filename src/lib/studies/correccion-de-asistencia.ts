/**
 * Corregir y borrar una sesión de asistencia ya registrada.
 *
 * NO EXISTÍA, y se notaba: el 2026-09-10 el grupo «Nivel 2. Eric Arguello»
 * quedó con DOS sesiones de la misma fecha, una con 10 presentes y otra con
 * 2 — alguien pasó lista dos veces y nadie pudo borrar la mala. Quedó ahí,
 * contándose como una sesión más, bajándole el promedio a todo el grupo.
 *
 * Pasar lista es rápido y se hace con el grupo enfrente: la fecha mal, un
 * nombre mal marcado y la lista pasada dos veces son errores NORMALES, no
 * descuidos. Un sistema donde el registro es solo de ida obliga a convivir
 * con cada uno.
 *
 * Lo que este módulo decide: qué es un cambio válido, qué hay que avisar
 * antes de aplicarlo y cómo se describe en la bitácora. El permiso NO se
 * decide acá — es el mismo `groupViewerScope` que ya gobierna pasar lista.
 */

export type MarcaDeAsistencia = { member_id: string; present: boolean }

export type SesionRegistrada = {
  id: string
  session_date: string
  topic: string | null
  marcas: MarcaDeAsistencia[]
}

export type CambioDeSesion = {
  session_date?: string
  topic?: string | null
  marcas?: MarcaDeAsistencia[]
}

/** `YYYY-MM-DD`. Un `date` de Postgres no acepta otra cosa y una fecha con
 *  hora acá volvería a abrir el corrimiento de un día que se arregló hoy. */
export function esFechaValida(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)
}

/**
 * Por qué NO se puede aplicar este cambio, o null si se puede.
 *
 * Una sesión sin NINGUNA marca no se rechaza: un grupo donde no llegó nadie
 * es un dato real y además es el caso en que el dirigente más necesita
 * dejarlo escrito.
 */
export function motivoQueImpide(cambio: CambioDeSesion): string | null {
  if (cambio.session_date !== undefined && !esFechaValida(cambio.session_date)) {
    return 'La fecha debe venir como YYYY-MM-DD.'
  }
  if (cambio.marcas !== undefined) {
    const ids = cambio.marcas.map(m => m.member_id)
    if (new Set(ids).size !== ids.length) {
      // Con dos filas de la misma persona, la última gana en silencio y el
      // dirigente ve un estado que no eligió.
      return 'Viene la misma persona dos veces en la lista.'
    }
  }
  if (cambio.session_date === undefined && cambio.topic === undefined && cambio.marcas === undefined) {
    return 'No viene ningún cambio.'
  }
  return null
}

export type Diferencia = {
  fechaCambia: { de: string; a: string } | null
  temaCambia: boolean
  /** member_ids que pasan de ausente a presente. */
  pasanAPresente: string[]
  /** member_ids que pasan de presente a ausente. */
  pasanAAusente: string[]
  /** member_ids que no tenían marca y ahora la tienen. */
  seAgregan: string[]
  /** member_ids que tenían marca y la pierden: vuelven a «sin registro». */
  seQuitan: string[]
}

/** Qué cambia de verdad. Lo usa la confirmación y lo usa la bitácora, para
 *  que lo que se le avisa al dirigente y lo que queda escrito sean lo mismo. */
export function diferencia(antes: SesionRegistrada, cambio: CambioDeSesion): Diferencia {
  const previas = new Map(antes.marcas.map(m => [m.member_id, m.present]))
  const nuevas = cambio.marcas === undefined
    ? previas
    : new Map(cambio.marcas.map(m => [m.member_id, m.present]))

  const pasanAPresente: string[] = []
  const pasanAAusente: string[] = []
  const seAgregan: string[] = []
  const seQuitan: string[] = []

  for (const [id, ahora] of nuevas) {
    const antesV = previas.get(id)
    if (antesV === undefined) { seAgregan.push(id); continue }
    if (antesV === ahora) continue
    ;(ahora ? pasanAPresente : pasanAAusente).push(id)
  }
  for (const id of previas.keys()) if (!nuevas.has(id)) seQuitan.push(id)

  const fechaNueva = cambio.session_date
  return {
    fechaCambia: fechaNueva !== undefined && fechaNueva !== antes.session_date
      ? { de: antes.session_date, a: fechaNueva }
      : null,
    temaCambia: cambio.topic !== undefined && (cambio.topic ?? null) !== (antes.topic ?? null),
    pasanAPresente, pasanAAusente, seAgregan, seQuitan,
  }
}

export function hayCambios(d: Diferencia): boolean {
  return d.fechaCambia !== null || d.temaCambia
    || d.pasanAPresente.length > 0 || d.pasanAAusente.length > 0
    || d.seAgregan.length > 0 || d.seQuitan.length > 0
}

/**
 * El texto de la confirmación de BORRADO.
 *
 * Dice CUÁNTAS marcas se van, no solo «¿seguro?». Borrar una sesión de diez
 * personas y borrar una vacía son la misma pregunta con consecuencias muy
 * distintas, y el dirigente las contesta igual si no se las distinguen.
 */
export function textoDeBorrado(s: { session_date: string; marcas: unknown[] }): string {
  const n = s.marcas.length
  const cuantas = n === 0
    ? 'No tiene ninguna marca de asistencia'
    : n === 1 ? 'Se borra también la marca de 1 participante'
    : `Se borran también las marcas de ${n} participantes`
  return `Se va a borrar la sesión del ${s.session_date}. ${cuantas}. Esto no se puede deshacer.`
}
