/**
 * FRM-6 · Las columnas de datos personales del export de respuestas.
 *
 * PARA QUÉ. Un campamento se organiza con dos cosas que el formulario de
 * inscripción NO pregunta: a quién hay que llamar y qué come cada quien. Están
 * en la ficha, y hasta ahora había que cruzarlas a mano contra el padrón.
 *
 * SALEN DE LA FICHA AL MOMENTO DEL EXPORT, no de lo que la persona escribió al
 * inscribirse. Es a propósito y es la razón de ser del ítem: alguien se
 * inscribe en marzo y le detectan celiaquía en junio; la hoja que se imprime
 * para la cocina tiene que decir junio. Congelarlas al responder daría un dato
 * viejo con cara de dato bueno.
 *
 * VACÍO ES VACÍO, nunca «—» ni «N/A». Este Excel se filtra y se cuenta: una
 * celda vacía se puede filtrar y contar, un guion es texto que hay que
 * acordarse de excluir en cada fórmula.
 *
 * Módulo PURO: decide qué dice cada celda. Quien lee la base es la ruta.
 */

import { textoDeRestricciones } from '@/lib/members/restriccion-alimenticia'

export type FichaParaExport = {
  id: string
  first_name: string | null
  last_name: string | null
  cedula: string | null
  document_type: string | null
  birth_date: string | null
  gender: string | null
  phone: string | null
  email: string | null
  allergies: string | null
  dietary_restrictions: readonly string[] | null
  marital_status: string | null
}

/** Las columnas, en el orden en que se leen: quién es, cómo se le habla, qué
 *  necesita, con quién viene. `date` para que la fecha se pueda ordenar y
 *  filtrar por rango; el resto TEXTO, que es lo que salva a una cédula de que
 *  Excel le coma el cero de adelante (ver xlsx-export.ts). */
export const COLUMNAS_PERSONALES = [
  { header: 'Nombre completo (ficha)', width: 28, kind: 'text' },
  { header: 'Documento',               width: 16, kind: 'text' },
  { header: 'Fecha de nacimiento',     width: 16, kind: 'date' },
  { header: 'Género',                  width: 12, kind: 'text' },
  { header: 'Teléfono (ficha)',        width: 16, kind: 'text' },
  { header: 'Correo (ficha)',          width: 28, kind: 'text' },
  { header: 'Alergias',                width: 34, kind: 'text' },
  { header: 'Restricción alimenticia', width: 26, kind: 'text' },
  { header: 'Estado civil',            width: 16, kind: 'text' },
  { header: 'Cónyuge',                 width: 28, kind: 'text' },
] as const

/**
 * `gender` guarda 'F'/'M'/'otro'. En una hoja que lee una persona eso se
 * traduce; un valor que no esté en el mapa se escribe tal cual, porque
 * inventarle una etiqueta a un dato que no entendemos es peor que mostrarlo.
 */
export const ETIQUETA_DE_GENERO: Record<string, string> = {
  F: 'Femenino', M: 'Masculino', otro: 'Otro',
}

export function textoDeGenero(g: string | null | undefined): string {
  const v = (g ?? '').trim()
  if (!v) return ''
  return ETIQUETA_DE_GENERO[v] ?? ETIQUETA_DE_GENERO[v.toUpperCase()] ?? v
}

/**
 * ¿Está casada esta persona?
 *
 * Por PREFIJO y sin tildes, no por igualdad. El dato real de producción tiene
 * 'Casado/a' 1.994 veces pero también 'Casado' y 'Casada' sueltos: un `===`
 * contra la etiqueta canónica dejaba a tres personas sin cónyuge por una
 * diferencia de tipeo de hace años.
 *
 * 'Unión libre' NO entra: el pedido dice casado/a, y quien arma la logística
 * del campamento necesita saber qué dice la ficha, no nuestra interpretación.
 */
export function esCasado(estadoCivil: string | null | undefined): boolean {
  return /^casad/.test(
    (estadoCivil ?? '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''),
  )
}

/** Un integrante de la unidad familiar, como lo guarda `family_members`. */
export type IntegranteDeFamilia = {
  member_id: string
  /** 'Titular' | 'Cónyuge' | 'Hijo/a' | 'Otro' | 'Madre' (valores reales). */
  relation: string | null
  nombre: string
}

/** Las dos relaciones que forman la pareja de una unidad familiar. */
export const RELACIONES_DE_PAREJA = ['Titular', 'Cónyuge'] as const

function esPareja(relation: string | null): boolean {
  const v = (relation ?? '').trim().toLowerCase()
  return RELACIONES_DE_PAREJA.some(r => r.toLowerCase() === v)
}

/**
 * El nombre del cónyuge dentro de su unidad familiar, o `''`.
 *
 * EXACTAMENTE UNO o nada: si la unidad tuviera dos candidatos —un Titular y dos
 * Cónyuges por un error de carga— se devuelve vacío. Es la misma regla que
 * AGENTS.md fija para cruzar contra CCB, y por el mismo motivo: un nombre
 * equivocado en la hoja de un campamento es peor que una celda vacía, porque
 * nadie lo va a verificar.
 *
 * Medido en producción el 2026-09-28: de 1.995 casados activos, 1.115 tienen
 * familia registrada y 994 resuelven un cónyuge único. **Cero ambiguos.** Los
 * demás quedan vacíos, que es lo que pide el ítem: no adivinar.
 */
export function conyugeEnLaFamilia(
  integrantes: readonly IntegranteDeFamilia[],
  memberId: string,
): string {
  const yo = integrantes.find(i => i.member_id === memberId)
  if (!yo || !esPareja(yo.relation)) return ''
  const otros = integrantes.filter(i => i.member_id !== memberId && esPareja(i.relation))
  return otros.length === 1 ? (otros[0].nombre.trim() || '') : ''
}

/**
 * Las celdas de una persona, en el orden de `COLUMNAS_PERSONALES`.
 *
 * Sin ficha —respuesta anónima, o de alguien sin miembro resoluble— devuelve
 * todas vacías y NO omite la fila: sus respuestas siguen valiendo, lo único que
 * falta es el complemento del padrón.
 */
export function celdasPersonales(
  ficha: FichaParaExport | null | undefined,
  nombreDelConyuge = '',
): Array<string | Date | null> {
  if (!ficha) return COLUMNAS_PERSONALES.map(() => null)

  const nombre = `${ficha.first_name ?? ''} ${ficha.last_name ?? ''}`.trim()
  const doc = (ficha.cedula ?? '').trim()
  // `textoDeRestricciones` devuelve '—' cuando no hay nada, porque en pantalla
  // un guion se lee mejor que un hueco. Acá NO: esta hoja se filtra y se
  // cuenta, y un guion es texto que hay que acordarse de excluir en cada
  // fórmula. Se convierte a vacío en vez de tocar el helper, que lo usa también
  // el export de asistentes a eventos y ahí el guion está bien.
  const restricCruda = textoDeRestricciones(ficha.dietary_restrictions ?? [])
  const restric = restricCruda === '—' ? '' : restricCruda
  const civil = (ficha.marital_status ?? '').trim()

  return [
    nombre || null,
    doc || null,
    fechaDeNacimiento(ficha.birth_date),
    textoDeGenero(ficha.gender) || null,
    (ficha.phone ?? '').trim() || null,
    (ficha.email ?? '').trim() || null,
    (ficha.allergies ?? '').trim() || null,
    restric || null,
    civil || null,
    // La columna solo se llena si la ficha dice casado/a: con un soltero que
    // comparte unidad familiar con su madre, «Cónyuge» diría cualquier cosa.
    (esCasado(civil) && nombreDelConyuge.trim()) || null,
  ]
}

/** La fecha como Date real (se puede ordenar y filtrar por rango), anclada a
 *  mediodía UTC para que no se corra un día al mostrarla en Costa Rica — el
 *  mismo criterio que `answerToCell`. */
export function fechaDeNacimiento(ymd: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null
}
