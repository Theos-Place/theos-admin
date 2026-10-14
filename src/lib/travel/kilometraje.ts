/**
 * FIN-11 · Bitácora de kilometraje (ANX-05), fase C.
 *
 * Una fila por desplazamiento, con odómetro: origen, destino, horas, km
 * inicial y final. Los kilómetros recorridos y el monto a reconocer se
 * CALCULAN; no se guardan ni se escriben a mano.
 *
 * POR QUÉ EL ODÓMETRO Y NO UN CAMPO «KM RECORRIDOS». Lo pidió así la minuta
 * del 2026-09-29 («el más detallado: distancias, odómetro»), y la razón es
 * que dos lecturas son verificables y un número suelto no: con el odómetro
 * se ve si un tramo se solapa con el anterior o si quedó un hueco sin
 * explicar, y eso es justo lo que una bitácora existe para mostrar.
 *
 * Módulo PURO.
 */
import type { Moneda } from './presupuesto'

export type Tramo = {
  fecha: string
  origen: string
  destino: string
  hora_salida?: string | null
  hora_regreso?: string | null
  km_inicial: number
  km_final: number
}

/**
 * LA TARIFA POR KILÓMETRO.
 *
 * Es un parámetro del sistema y hoy vive acá porque no hay tabla de
 * parámetros: el reglamento está en versión 1.0 y Floriana avisó que los
 * montos pueden cambiar en la final. Cuando haya pantalla de configuración,
 * esto pasa a ser el valor por defecto y nada más cambia.
 *
 * EN CERO A PROPÓSITO mientras no esté confirmada. Poner un número inventado
 * —«₡250, que suena razonable»— haría que las primeras bitácoras se liquiden
 * con una tarifa que nadie autorizó, y eso se descubre cuando ya se pagó.
 * Con cero, el monto sale en cero y se nota.
 */
export const TARIFA_POR_KM = { monto: 0, moneda: 'CRC' as Moneda }

/** Los kilómetros de un tramo. Nunca negativos: eso lo atrapa `revisarBitacora`. */
export const kmDelTramo = (t: Pick<Tramo, 'km_inicial' | 'km_final'>): number =>
  Math.max(0, Math.round((Number(t.km_final || 0) - Number(t.km_inicial || 0)) * 100) / 100)

export const kmTotales = (tramos: readonly Tramo[]): number =>
  Math.round(tramos.reduce((a, t) => a + kmDelTramo(t), 0) * 100) / 100

/**
 * El monto a reconocer.
 *
 * `tarifa` se pasa SIEMPRE y no se lee de la constante: un expediente viejo
 * tiene que seguir valiendo lo que valía cuando se liquidó, aunque la tarifa
 * haya subido después. Quien llama decide cuál usar — la vigente para una
 * bitácora nueva, la guardada para una ya enviada.
 */
export const montoAReconocer = (km: number, tarifa: number): number =>
  Math.round(Number(km || 0) * Number(tarifa || 0) * 100) / 100

export type ProblemaDeTramo = { indice: number; mensaje: string }

/**
 * Qué hace que una bitácora no se pueda enviar.
 *
 * El odómetro que RETROCEDE entre tramos consecutivos es el caso que
 * importa: significa que alguien copió mal una lectura o que los tramos
 * están en desorden, y en los dos casos el total de kilómetros —y la plata—
 * está mal.
 */
export function revisarBitacora(tramos: readonly Tramo[]): ProblemaDeTramo[] {
  const problemas: ProblemaDeTramo[] = []
  if (tramos.length === 0) problemas.push({ indice: -1, mensaje: 'La bitácora no puede ir vacía.' })
  tramos.forEach((t, i) => {
    if (!t.fecha) problemas.push({ indice: i, mensaje: 'Falta la fecha.' })
    if (!t.origen?.trim() || !t.destino?.trim()) {
      problemas.push({ indice: i, mensaje: 'Falta el origen o el destino.' })
    }
    const ini = Number(t.km_inicial), fin = Number(t.km_final)
    if (!Number.isFinite(ini) || !Number.isFinite(fin)) {
      problemas.push({ indice: i, mensaje: 'Las lecturas del odómetro tienen que ser números.' })
      return
    }
    if (ini < 0 || fin < 0) problemas.push({ indice: i, mensaje: 'El odómetro no puede ser negativo.' })
    if (fin < ini) {
      problemas.push({ indice: i, mensaje: 'El odómetro final no puede ser menor que el inicial.' })
    }
    if (fin === ini) problemas.push({ indice: i, mensaje: 'El tramo no tiene kilómetros.' })
  })
  return problemas
}

export type AvisoDeBitacora = { indice: number; mensaje: string }

/**
 * Lo que NO bloquea pero quien revisa tiene que ver.
 *
 * Un hueco en el odómetro entre un tramo y el siguiente puede ser legítimo
 * —el carro se usó para otra cosa en el medio— y por eso avisa en vez de
 * frenar. Que el odómetro RETROCEDA entre tramos, en cambio, no tiene
 * lectura inocente: o están en desorden o hay una lectura mal copiada.
 */
export function avisosDeBitacora(tramos: readonly Tramo[]): AvisoDeBitacora[] {
  const avisos: AvisoDeBitacora[] = []
  for (let i = 1; i < tramos.length; i++) {
    const anterior = Number(tramos[i - 1].km_final)
    const actual = Number(tramos[i].km_inicial)
    if (!Number.isFinite(anterior) || !Number.isFinite(actual)) continue
    if (actual < anterior) {
      avisos.push({ indice: i, mensaje: 'El odómetro retrocede respecto al tramo anterior.' })
    } else if (actual > anterior) {
      const hueco = Math.round((actual - anterior) * 100) / 100
      avisos.push({ indice: i, mensaje: `Quedan ${hueco} km sin registrar desde el tramo anterior.` })
    }
    if (tramos[i].fecha && tramos[i - 1].fecha && tramos[i].fecha < tramos[i - 1].fecha) {
      avisos.push({ indice: i, mensaje: 'Este tramo es anterior al que está arriba.' })
    }
  }
  return avisos
}

/**
 * LA APROBACIÓN DEL JEFE ES REQUISITO, y no es un adjunto más.
 *
 * Lo pidió la minuta del 2026-09-29 con esas palabras: el de kilometraje
 * «incluirá como requisito adjuntar la aprobación del jefe/supervisor del
 * viaje». Sin ese archivo la bitácora no se manda — ni con la declaración
 * jurada firmada, porque son dos cosas distintas: una la firma quien viajó y
 * la otra la firma quien lo autorizó.
 */
export const faltaAprobacionDelJefe = (path: string | null | undefined): boolean =>
  !(path ?? '').trim()
