/**
 * DIR-7 / REP-14 · Quién «dejó de venir», en un solo lugar.
 *
 * DOS REPORTES, UNA DEFINICIÓN. DIR-7 le muestra a cada dirigente sus
 * exalumnos perdidos para escribirles; REP-14 le muestra a dirección los
 * recurrentes que se fueron. Son preguntas distintas sobre la MISMA idea, y
 * si cada uno trajera su propia ventana de tiempo, los dos reportes se
 * contradirían en la misma pantalla —uno diría que fulano volvió y el otro
 * que no— y nadie sabría cuál creerle.
 *
 * LA VENTANA SON SEIS MESES, y es a propósito más larga que las 5 semanas de
 * REP-5. No es la misma pregunta: REP-5 busca a quien hay que llamar ESTA
 * semana porque se está enfriando. Acá se busca a quien ya se fue hace rato y
 * hay que reconectar. Con 5 semanas la lista serían cientos de personas que
 * simplemente faltaron un mes.
 *
 * LAS TRES EXCLUSIONES, y por qué cada una:
 *
 *  · FICHAS INACTIVAS. Hoy las 151 que hay son todas `merged` (medido el
 *    2026-10-05): son duplicados fusionados, no personas. Escribirle a una
 *    sería escribirle dos veces a la misma persona.
 *  · SERVIDORES ACTIVOS. Sirven aunque no asistan a charla. Mandarle un
 *    «hace rato no te vemos» a alguien que está sirviendo todos los domingos
 *    no es un error de dato: es una metida de pata frente a la persona.
 *  · DATOS DE PRUEBA.
 *
 * NO se excluye por fallecimiento: `deactivation_reason` no tiene hoy ningún
 * `deceased` (medido el 2026-10-05, los 151 inactivos son `merged`). Filtrar
 * por un valor que no existe daría una falsa sensación de cobertura; si algún
 * día se empieza a marcar, `is_active = false` ya los deja fuera.
 *
 * Módulo PURO: define y decide. Quien lee la base es la query.
 */

/** Meses sin ninguna señal para considerar que la persona se fue. */
export const MESES_SIN_VENIR = 6

/**
 * Cuántos check-ins a charla hacen a alguien RECURRENTE (REP-14).
 *
 * Veinte es mucho más que «vino varias veces»: con una charla por semana son
 * cinco meses de asistencia sostenida. Es gente que hizo de Theos parte de su
 * rutina, que es justamente lo que vuelve grave que se haya ido.
 */
export const MINIMO_CHECKINS_RECURRENTE = 20

/** Resta meses a una fecha `YYYY-MM-DD` sin pasar por zonas horarias. */
export function restarMeses(ymd: string, meses: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const objetivo = m - 1 - meses
  const anio = y + Math.floor(objetivo / 12)
  const mes = ((objetivo % 12) + 12) % 12
  // Día 0 del mes siguiente = último día de este. Sin esto, el 31 de agosto
  // menos 6 meses daría el 3 de marzo (el `setMonth` de JS desborda).
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const dia = Math.min(d, ultimo)
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** La fecha de corte: antes de esto, la persona «dejó de venir». */
export function fechaDeCorte(hoyYmd: string, meses = MESES_SIN_VENIR): string {
  return restarMeses(hoyYmd, meses)
}

/**
 * ¿Esta persona dejó de venir?
 *
 * `ultimaActividad` es la más reciente entre su último check-in a charla y su
 * última señal de estudio. `null` —nunca tuvo ninguna— CUENTA como que no
 * viene: en DIR-7 es un exalumno que terminó el estudio y jamás apareció por
 * una charla, que es exactamente a quien hay que buscar.
 */
export function dejoDeVenir(ultimaActividad: string | null, hoyYmd: string): boolean {
  if (!ultimaActividad) return true
  return ultimaActividad.slice(0, 10) < fechaDeCorte(hoyYmd)
}

/** El año en que se perdió: el de su última señal. `null` si nunca tuvo una. */
export function anioEnQueDejoDeIr(ultimaActividad: string | null): number | null {
  if (!ultimaActividad) return null
  const anio = Number(ultimaActividad.slice(0, 4))
  return Number.isFinite(anio) && anio > 1900 ? anio : null
}

// ── El mensaje de WhatsApp (DIR-7) ──────────────────────────────────────────

/**
 * LA PLANTILLA, en un solo lugar y editable acá.
 *
 * Está escrita para que la lea una persona, no una institución: sin «estimado
 * miembro», sin convocatoria y sin pedir nada. El objetivo del mensaje es
 * saludar, no recuperar una matrícula — si arranca vendiendo, el dirigente no
 * lo va a querer mandar.
 */
export const PLANTILLA_WHATSAPP =
  '¡Hola {{nombre}}! Soy {{dirigente}}, de Theos — compartimos el estudio hace un '
  + 'tiempo y me acordé de vos. Hace rato no te vemos por acá y quería saludarte: '
  + '¿cómo has estado? Si en algún momento querés retomar un estudio o ir a una '
  + 'charla, las puertas están abiertas y me encantaría verte. Un abrazo.'

/** Rellena la plantilla. Solo el PRIMER nombre: el completo suena a carta. */
export function mensajeParaWhatsApp(nombre: string, dirigente: string): string {
  const soloNombre = (s: string) => (s.trim().split(/\s+/)[0] ?? '').trim()
  return PLANTILLA_WHATSAPP
    .replace('{{nombre}}', soloNombre(nombre) || 'hola')
    .replace('{{dirigente}}', soloNombre(dirigente) || 'tu dirigente')
}

/**
 * Normaliza un teléfono costarricense a lo que espera wa.me: solo dígitos,
 * con el 506 adelante y sin el `+`.
 *
 * LOS CASOS QUE HAY EN LA BASE: «8888-8888», «8888 8888», «+506 8888-8888»,
 * «50688888888». Los tres primeros necesitan el 506 y el último NO —
 * agregárselo daría `5065068888...`, un número que no existe, y el enlace
 * abriría WhatsApp en un chat vacío sin decir que está mal.
 *
 * Devuelve `null` cuando no queda un número usable, para que la fila muestre
 * «—» en vez de un enlace roto.
 */
export function telefonoParaWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const soloDigitos = telefono.replace(/\D/g, '')
  if (!soloDigitos) return null
  // Ocho dígitos es un número nacional: lleva el código de país.
  if (soloDigitos.length === 8) return `506${soloDigitos}`
  // Once con 506 adelante ya viene completo.
  if (soloDigitos.length === 11 && soloDigitos.startsWith('506')) return soloDigitos
  // Un número de otro país (o uno largo ya con su código) se deja como está:
  // hay gente con teléfono de fuera y forzarle el 506 lo rompería.
  if (soloDigitos.length >= 10 && soloDigitos.length <= 15) return soloDigitos
  // Cualquier otra cosa —siete dígitos, un cero suelto— no es un teléfono.
  return null
}

/** El enlace de WhatsApp con el mensaje ya escrito. `null` sin teléfono. */
export function enlaceDeWhatsApp(input: {
  telefono: string | null | undefined
  nombre: string
  dirigente: string
}): string | null {
  const numero = telefonoParaWhatsApp(input.telefono)
  if (!numero) return null
  const texto = encodeURIComponent(mensajeParaWhatsApp(input.nombre, input.dirigente))
  return `https://wa.me/${numero}?text=${texto}`
}

// ── El seguimiento del contacto (DIR-7) ─────────────────────────────────────

/**
 * Los cinco desenlaces posibles de un contacto.
 *
 * Son opciones cerradas y no texto libre a propósito: el dirigente marca esto
 * desde el teléfono, entre una cosa y otra. Si hay que escribir, no se marca,
 * y un seguimiento que nadie llena no sirve. La nota opcional queda para el
 * matiz.
 */
export const ESTADOS_DE_CONTACTO = [
  'escrito_sin_respuesta',
  'quiere_volver',
  'cambio_de_iglesia',
  'no_quiere_volver',
  'numero_equivocado',
] as const

export type EstadoDeContacto = (typeof ESTADOS_DE_CONTACTO)[number]

export const ETIQUETA_DE_CONTACTO: Record<EstadoDeContacto, string> = {
  escrito_sin_respuesta: 'Ya le escribí — sin respuesta aún',
  quiere_volver: 'Quiere volver',
  cambio_de_iglesia: 'Se cambió de iglesia',
  no_quiere_volver: 'No quiere volver',
  numero_equivocado: 'Número equivocado / no es la persona',
}

/** A qué quiere volver, cuando dijo que sí. Opcional. */
export const A_QUE_VUELVE = ['charla', 'estudio', 'evento'] as const
export type AQueVuelve = (typeof A_QUE_VUELVE)[number]

export const ETIQUETA_A_QUE_VUELVE: Record<AQueVuelve, string> = {
  charla: 'A una charla',
  estudio: 'A retomar un estudio',
  evento: 'A un evento',
}

export function esEstadoDeContacto(v: unknown): v is EstadoDeContacto {
  return typeof v === 'string' && (ESTADOS_DE_CONTACTO as readonly string[]).includes(v)
}

export function esAQueVuelve(v: unknown): v is AQueVuelve {
  return typeof v === 'string' && (A_QUE_VUELVE as readonly string[]).includes(v)
}

/**
 * Cómo se ve la fila según lo último que se marcó.
 *
 * `quiere_volver` es el único que se destaca: es el que pide una acción de
 * alguien más (abrirle la puerta cuando abra matrícula). Los otros tres
 * resueltos se apagan —ya no hay nada que hacer— y sin contacto queda
 * pendiente.
 */
export type SituacionDeFila = 'pendiente' | 'contactado' | 'quiere_volver' | 'cerrado'

export function situacionDeFila(ultimo: EstadoDeContacto | null): SituacionDeFila {
  if (!ultimo) return 'pendiente'
  if (ultimo === 'quiere_volver') return 'quiere_volver'
  if (ultimo === 'escrito_sin_respuesta') return 'contactado'
  return 'cerrado'
}

export type ResumenDeContactos = {
  total: number
  /** Cómo se ve cada fila. Suman `total`. */
  situaciones: Record<SituacionDeFila, number>
  /** Qué se marcó. Suman los que tienen algún contacto, no `total`. */
  desenlaces: Record<EstadoDeContacto, number>
}

/**
 * Resumen agregado para dirección.
 *
 * LAS DOS CUENTAS VAN SEPARADAS, y no es un capricho de forma: `quiere_volver`
 * es a la vez una SITUACIÓN de la fila y un DESENLACE marcado. En un solo
 * objeto plano la misma llave recibía los dos incrementos y el número salía
 * al doble — lo agarró el test de este módulo antes de llegar a pantalla.
 *
 * Separadas, además, se leen distinto y eso está bien: las situaciones suman
 * el total (cada fila está en exactamente una), los desenlaces no (las filas
 * pendientes no tienen ninguno).
 */
export function resumenDeContactos(
  ultimos: ReadonlyArray<EstadoDeContacto | null>,
): ResumenDeContactos {
  const situaciones: Record<SituacionDeFila, number> = {
    pendiente: 0, contactado: 0, quiere_volver: 0, cerrado: 0,
  }
  const desenlaces: Record<EstadoDeContacto, number> = {
    escrito_sin_respuesta: 0, quiere_volver: 0, cambio_de_iglesia: 0,
    no_quiere_volver: 0, numero_equivocado: 0,
  }
  for (const u of ultimos) {
    situaciones[situacionDeFila(u)] += 1
    if (u) desenlaces[u] += 1
  }
  return { total: ultimos.length, situaciones, desenlaces }
}
