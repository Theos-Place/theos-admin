/**
 * SRV-11 · Cuándo se pueden solicitar puestos de servicio.
 *
 * LA REGLA (dictada el 2026-09-25): del **25 al 30** de cada mes. Antes era
 * «del 25 al último día», que en enero daba 31 y en febrero 28: el líder no
 * sabía nunca hasta cuándo tenía, y el texto de la pantalla mentía la mitad de
 * los meses.
 *
 * FEBRERO ES LA EXCEPCIÓN QUE NO SE PUEDE EVITAR: no tiene día 30, así que la
 * ventana cierra el 28 (o el 29). Se calcula con el último día real del mes y
 * no con un `if (mes === 2)`, que se olvida de los bisiestos.
 *
 * LAS EXTENSIONES PUNTUALES van en `CIERRES_EXTENDIDOS` y no en el código: la
 * primera es real —la ventana de setiembre 2026 se estira hasta el 5 de
 * octubre— y la alternativa era un deploy para correr una fecha. Se escriben
 * como «la ventana que ABRIÓ en tal mes cierra tal día», porque una extensión
 * se desborda al mes siguiente y con un solo número no se podría decir.
 *
 * Módulo PURO — lo usan la pantalla y el servidor. El rechazo lo decide el
 * SERVIDOR con su propio reloj: la hora del dispositivo de quien solicita no
 * puede abrir una ventana cerrada.
 */

export const VENTANA_DIA_INICIAL = 25
export const VENTANA_DIA_FINAL = 30

/**
 * Extensiones puntuales. La clave es el mes en que la ventana ABRIÓ
 * (`YYYY-MM`) y el valor, el último día en que sigue abierta (`YYYY-MM-DD`,
 * inclusive).
 *
 * 2026-09 → 2026-10-05: decisión del 2026-09-25. Después vuelve a 25–30 sola,
 * sin que nadie tenga que acordarse de sacar la línea.
 */
export const CIERRES_EXTENDIDOS: Record<string, string> = {
  '2026-09': '2026-10-05',
}

const CR = 'America/Costa_Rica'

/** Hoy en Costa Rica como YYYY-MM-DD. Nunca se usa la fecha local del
 *  dispositivo: el sistema vive en una sola zona y un teléfono en otra abriría
 *  o cerraría la ventana un día antes. */
export function hoyEnCostaRica(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CR, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** Día del mes (1–31) en zona Costa Rica. Se conserva porque ya la importaban
 *  otras pantallas. */
export function costaRicaDayOfMonth(now: Date = new Date()): number {
  return Number(hoyEnCostaRica(now).slice(8, 10))
}

/** Cuántos días tiene ese mes. `new Date(año, mes, 0)` da el último día del mes
 *  anterior, o sea el último de este — así los bisiestos salen solos. */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')

export type Ventana = { abre: string; cierra: string }

/**
 * La ventana que ABRE en ese mes, con su cierre ya resuelto: la extensión si la
 * hay, si no el día 30 acotado al último día real del mes.
 */
export function ventanaDelMes(anio: number, mes: number): Ventana {
  const clave = `${anio}-${dosDigitos(mes)}`
  const abre = `${clave}-${dosDigitos(VENTANA_DIA_INICIAL)}`
  const extendido = CIERRES_EXTENDIDOS[clave]
  if (extendido) return { abre, cierra: extendido }
  const ultimo = Math.min(VENTANA_DIA_FINAL, diasDelMes(anio, mes))
  return { abre, cierra: `${clave}-${dosDigitos(ultimo)}` }
}

/** Mes anterior a uno dado, cruzando el año. */
function mesAnterior(anio: number, mes: number): [number, number] {
  return mes === 1 ? [anio - 1, 12] : [anio, mes - 1]
}

/**
 * La ventana vigente hoy, o `null` si está cerrada.
 *
 * Se miran DOS: la que abre este mes y la del mes pasado. La segunda no es
 * paranoia — es justamente el caso de la extensión: el 3 de octubre la ventana
 * abierta es la de setiembre, y mirando solo el mes en curso se vería cerrada.
 */
export function ventanaVigente(now: Date = new Date()): Ventana | null {
  const hoy = hoyEnCostaRica(now)
  const anio = Number(hoy.slice(0, 4))
  const mes = Number(hoy.slice(5, 7))
  const candidatas = [ventanaDelMes(anio, mes), ventanaDelMes(...mesAnterior(anio, mes))]
  // Comparación de strings YYYY-MM-DD: ordenan igual que las fechas y no
  // arrastran husos horarios.
  return candidatas.find(v => hoy >= v.abre && hoy <= v.cierra) ?? null
}

export function isVacancyRequestWindowOpen(now: Date = new Date()): boolean {
  return ventanaVigente(now) !== null
}

/** La PRÓXIMA ventana, para poder decir cuándo vuelve a abrir en vez de un
 *  «está cerrado» a secas. */
export function proximaVentana(now: Date = new Date()): Ventana {
  const hoy = hoyEnCostaRica(now)
  const anio = Number(hoy.slice(0, 4))
  const mes = Number(hoy.slice(5, 7))
  const deEsteMes = ventanaDelMes(anio, mes)
  if (hoy < deEsteMes.abre) return deEsteMes
  return mes === 12 ? ventanaDelMes(anio + 1, 1) : ventanaDelMes(anio, mes + 1)
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «25 de setiembre» a partir de un YYYY-MM-DD. */
export function fechaEnPalabras(ymd: string): string {
  const d = Number(ymd.slice(8, 10))
  const m = Number(ymd.slice(5, 7))
  return `${d} de ${MESES[m - 1] ?? ''}`.trim()
}

/**
 * El texto que ve quien entra, abierta o cerrada.
 *
 * Dice SIEMPRE la fecha concreta y no «del 25 al 30» a secas, porque los dos
 * casos en que eso sería mentira son justamente los que confunden: febrero, que
 * cierra el 28, y un mes con extensión.
 */
export function textoDeLaVentana(now: Date = new Date()): string {
  const abierta = ventanaVigente(now)
  if (abierta) return `Podés solicitar hasta el ${fechaEnPalabras(abierta.cierra)}.`
  const prox = proximaVentana(now)
  return `El período para solicitar puestos de servicio es del ${VENTANA_DIA_INICIAL} al `
    + `${VENTANA_DIA_FINAL} de cada mes. El próximo abre el ${fechaEnPalabras(prox.abre)}.`
}

/** El mensaje del rechazo del servidor. Mismo texto que la pantalla, para que
 *  nadie vea dos explicaciones distintas del mismo cierre. */
export function motivoDeVentanaCerrada(now: Date = new Date()): string {
  return textoDeLaVentana(now)
}

/** @deprecated Usar `textoDeLaVentana`, que dice la fecha real. Se conserva
 *  porque la pantalla vieja de vacantes todavía lo importa. */
export const VACANCY_REQUEST_WINDOW_TOOLTIP =
  `Las solicitudes se reciben del ${VENTANA_DIA_INICIAL} al ${VENTANA_DIA_FINAL} de cada mes. `
  + 'Fuera de esa fecha, la solicitud está deshabilitada.'

/** @deprecated Se conserva por compatibilidad: el inicio de la ventana. */
export const VACANCY_REQUEST_OPEN_DAY = VENTANA_DIA_INICIAL
