/**
 * DIR-10 · La disponibilidad del dirigente, en una línea por dato.
 *
 * POR QUÉ EXISTE: el tab mostraba las siete listas de opciones abiertas a la
 * vez —21 casillas de horario, 30 estudios, las zonas— y quien entraba a
 * cambiar UNA cosa tenía que buscarla entre todo lo demás. Ahora cada dato
 * se lee como una frase y la lista completa solo se abre al editar ese dato.
 *
 * LA FRASE TIENE QUE DECIR TAMBIÉN CUANDO NO HAY NADA. «Días: —» se lee como
 * un error de la pantalla; «Todavía no lo dijiste» se lee como lo que es:
 * algo pendiente de contestar. Por eso cada resumen devuelve `vacio` y el
 * texto ya redactado, en vez de dejar que cada pantalla improvise el suyo.
 *
 * Módulo PURO.
 */
import {
  DIAS, FRANJAS, DIA_LABEL, slot,
  type DiaCodigo, type Franja,
} from './disponibilidad-de-dirigente'

export type LineaDeResumen = {
  texto: string
  /** Nada contestado: la pantalla lo muestra en tono de pendiente. */
  vacio: boolean
}

const NADA = (que: string): LineaDeResumen => ({
  texto: `Todavía no lo dijiste: ${que}`, vacio: true,
})

/** «lunes y miércoles» · «lunes, miércoles y viernes» */
export function enumerar(partes: readonly string[]): string {
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Los horarios, agrupados por DÍA y no por casilla.
 *
 * Con 21 casillas, listarlas sueltas («lunes mañana, lunes tarde, martes
 * noche…») da una frase que no se termina de leer. Agrupadas por día se
 * lee «lunes por la mañana y por la tarde; martes por la noche».
 */
export function resumenDeHorarios(slots: readonly string[]): LineaDeResumen {
  const puestos = new Set(slots)
  const porDia: string[] = []
  for (const d of DIAS) {
    const franjas = FRANJAS.filter(f => puestos.has(slot(d as DiaCodigo, f as Franja)))
    if (franjas.length === 0) continue
    // Los tres: no vale la pena enumerarlos.
    const cuando = franjas.length === FRANJAS.length
      ? 'todo el día'
      : enumerar(franjas.map(f => `por la ${f}`))
    porDia.push(`${DIA_LABEL[d as DiaCodigo].toLowerCase()} ${cuando}`)
  }
  if (porDia.length === 0) return NADA('cuándo podés')
  return { texto: porDia.join('; '), vacio: false }
}

export function resumenDeEstudios(
  codigos: readonly string[],
  etiqueta: (code: string) => string,
  queFalta: string,
): LineaDeResumen {
  if (codigos.length === 0) return NADA(queFalta)
  const nombres = [...new Set(codigos)].map(etiqueta).sort((a, b) => a.localeCompare(b, 'es'))
  return { texto: enumerar(nombres), vacio: false }
}

export function resumenDeZonas(
  zonas: readonly string[],
  nombreDeZona: (code: string) => string,
  queFalta = 'en qué zonas podés dar',
): LineaDeResumen {
  if (zonas.length === 0) return NADA(queFalta)
  const nombres = [...new Set(zonas)].map(nombreDeZona).sort((a, b) => a.localeCompare(b, 'es'))
  return { texto: enumerar(nombres), vacio: false }
}

/**
 * Casa y suplencia en una sola línea.
 *
 * Un «no» acá NO es un dato faltante: decir que no ofrecés casa es una
 * respuesta. Por eso nunca devuelve `vacio`.
 */
export function resumenDeExtras(e: {
  offers_home: boolean
  available_as_substitute: boolean
}): LineaDeResumen {
  const si: string[] = []
  if (e.offers_home) si.push('ofrecés tu casa')
  if (e.available_as_substitute) si.push('podés ser suplente')
  if (si.length === 0) return { texto: 'No ofrecés casa ni suplencia', vacio: false }
  const frase = enumerar(si)
  return { texto: frase.charAt(0).toUpperCase() + frase.slice(1), vacio: false }
}
