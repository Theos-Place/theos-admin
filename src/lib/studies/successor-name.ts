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

/**
 * Los meses como los escribe la gente acá, con y sin tilde. «Setiembre» va
 * primero porque es la forma de Costa Rica; «septiembre» se acepta al leer.
 */
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

const ALIAS_DE_MES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, setiembre: 8, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Cambia el MES Y AÑO escritos en el nombre por los del arranque real.
 *
 * EL PROBLEMA (reportado el 2026-10-05): el sucesor heredaba el nombre del
 * origen cambiándole solo el nivel, así que un grupo que arranca el 11 de
 * octubre se llamaba «Nivel 4. Michelle Guier. Julio 2026». El correo de
 * folletos lo dice tal cual y quien imprime lee «Julio» en octubre.
 *
 * Solo toca el nombre si YA trae un mes escrito: a un grupo que se llama
 * «N1 — Heredia» no se le inventa una fecha que nadie puso.
 *
 * @param inicio YYYY-MM-DD del arranque del grupo nuevo.
 */
export function conElMesDelInicio(nombre: string, inicio: string | null | undefined): string {
  const ymd = (inicio ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return nombre
  const [anio, mes] = ymd.split('-').map(Number)
  const nuevo = `${MESES[mes - 1]} ${anio}`

  // El mes puede venir con tilde o sin ella, así que se busca sobre el texto
  // sin tildes y se reemplaza por POSICIÓN en el original.
  const plano = sinTildes(nombre)
  const re = new RegExp(`\\b(${Object.keys(ALIAS_DE_MES).join('|')})\\b(\\s*(?:de\\s*)?(\\d{4}))?`, 'i')
  const m = re.exec(plano)
  if (!m) return nombre
  return nombre.slice(0, m.index) + nuevo + nombre.slice(m.index + m[0].length)
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
  /**
   * Cuándo arranca el grupo NUEVO (YYYY-MM-DD). Si viene, el mes escrito en
   * el nombre se actualiza: un sucesor que empieza en octubre no se puede
   * seguir llamando «Julio 2026».
   */
  inicioDestino?: string | null
}): string {
  const destino = etiquetaNivel(input.codigoDestino)
  const nombre = conElMesDelInicio((input.nombreOrigen ?? '').trim(), input.inicioDestino)
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
