/**
 * Cómo se llama el grupo sucesor (módulo puro).
 *
 * La regla vieja buscaba el CÓDIGO del nivel dentro del nombre:
 *
 *     src.name.includes('N3') ? src.name.replace('N3', 'N4') : `N4 · ${src.name}`
 *
 * Pero los grupos no se llaman "N3 · algo", se llaman "Nivel 3. Fulano. Junio
 * 2026". Nunca encontraba el código, así que siempre caía en el fallback y
 * producía nombres con los dos niveles pegados:
 *
 *     "N4 · Nivel 3. Floriana Fonseca. Junio 2026"
 *
 * Que se lee como si el grupo fuera de nivel 3 y de nivel 4 a la vez.
 *
 * Acá se reemplaza la ETIQUETA ("Nivel 3" → "Nivel 4", "Discípulos 1" →
 * "Discípulos 2"), que es lo que de verdad aparece escrito. El código se sigue
 * intentando después, para los pocos grupos que sí lo usan.
 */

/** Código de plan → etiqueta legible. Mismo criterio que `levelLabel`, pero
 *  acá vive aparte para que el módulo no dependa de folletos. */
export function etiquetaNivel(code: string | null | undefined): string {
  if (!code) return ''
  if (/^N\d+$/.test(code)) return `Nivel ${code.slice(1)}`
  if (/^DIS\d+$/.test(code)) return `Discípulos ${code.slice(3)}`
  if (code === 'PREMAT') return 'Prematrimonial'
  return code
}

/** Escapa lo que va dentro de una expresión regular. */
function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * El nombre del grupo que sigue.
 *
 * Se prueba en orden:
 *  1. La etiqueta escrita ("Nivel 3"), sin importar mayúsculas ni tildes.
 *  2. El código suelto ("N3"), como palabra entera para no romper "N30".
 *  3. Si no aparece ninguno, se antepone la etiqueta nueva — y ahí sí el
 *     nombre queda largo, pero al menos dice de qué nivel es el grupo.
 */
export function nombreDelSucesor(input: {
  nombreOrigen: string | null | undefined
  codigoOrigen: string
  codigoDestino: string
}): string {
  const destino = etiquetaNivel(input.codigoDestino)
  const nombre = (input.nombreOrigen ?? '').trim()
  if (!nombre) return destino || 'Continuación'

  const origen = etiquetaNivel(input.codigoOrigen)
  if (origen) {
    const re = new RegExp(escapar(origen), 'i')
    if (re.test(nombre)) return nombre.replace(re, destino)
  }

  const reCodigo = new RegExp(`\\b${escapar(input.codigoOrigen)}\\b`, 'i')
  if (reCodigo.test(nombre)) return nombre.replace(reCodigo, input.codigoDestino)

  return `${destino}. ${nombre}`
}
