/**
 * SRV-9 · Lo que el dirigente dice de SÍ MISMO.
 *
 * QUÉ VIENE A MATAR. La disponibilidad se recoge tres veces al año (marzo,
 * julio, noviembre) con formularios sueltos de Linktree, y lo que la gente
 * contesta no vuelve al sistema: queda en una hoja que alguien transcribe.
 *
 * LAS TRES PALABRAS QUE NO SON SINÓNIMOS, y que este módulo existe para no
 * dejar mezclar:
 *   · CAPACITADO (`formation_study_codes`) — se formó. Lo dice el comité, y la
 *     persona no lo puede tocar ni por accidente: está fuera de
 *     `CAMPOS_DEL_DIRIGENTE`.
 *   · DISPONIBLE (`qualified_study_codes`) — quiere darlo ahora Y puede. Lo
 *     dice la persona.
 *   · INTERESADO (`interested_study_codes`) — quiere APRENDER a darlo y
 *     todavía no puede. Lo dice la persona. Sirve para convocar a la próxima
 *     capacitación y NO habilita para asignar un grupo. Sin esta tercera
 *     casilla, quien marca interés en algo para lo que no está capacitado se
 *     cuela entre los «disponibles» y termina asignado a un grupo que no puede
 *     dar.
 *
 * Módulo PURO.
 */

/** Códigos de día, los mismos que usa `schedule_days` en los grupos. */
export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
export type DiaCodigo = typeof DIAS[number]

export const DIA_LABEL: Record<DiaCodigo, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves',
  V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

/** Las franjas se escriben igual que en `study_requests.proposed_time`, con
 *  tilde incluida: son el mismo vocabulario y tenerlo escrito de dos formas es
 *  la manera de que un día no crucen. */
export const FRANJAS = ['mañana', 'tarde', 'noche'] as const
export type Franja = typeof FRANJAS[number]

/** Un slot es 'L-mañana'. Un arreglo de estos y no siete columnas: la pregunta
 *  real es siempre «¿quién puede los martes en la noche?», que con un arreglo
 *  es una intersección y con columnas sería un OR de catorce términos. */
export function slot(dia: DiaCodigo, franja: Franja): string {
  return `${dia}-${franja}`
}

export const TODOS_LOS_SLOTS: string[] = DIAS.flatMap(d => FRANJAS.map(f => slot(d, f)))

export function esSlotValido(valor: string): boolean {
  return TODOS_LOS_SLOTS.includes(valor)
}

/** Descarta lo que no sea un slot y los repetidos, conservando el orden
 *  canónico (lunes→domingo, mañana→noche) para que dos personas con la misma
 *  disponibilidad tengan el mismo arreglo. */
export function sanearSlots(valores: readonly string[] | null | undefined): string[] {
  const pedidos = new Set((valores ?? []).filter(esSlotValido))
  return TODOS_LOS_SLOTS.filter(s => pedidos.has(s))
}

export function etiquetaDeSlot(valor: string): string {
  const [d, f] = valor.split('-')
  return `${DIA_LABEL[d as DiaCodigo] ?? d} ${f}`
}

/**
 * Los campos que el PROPIO dirigente puede cambiar.
 *
 * Es una lista de permitidos y no de prohibidos, por la misma razón que
 * `CAMPOS_AUTOEDITABLES` del padrón: con una lista de prohibidos, la columna
 * que se agregue mañana nace abierta. `formation_study_codes` y
 * `availability_status` NO están, y no es un descuido — la formación la
 * certifica el comité y el estado administrativo es una decisión sobre la
 * persona, no una preferencia suya.
 */
export const CAMPOS_DEL_DIRIGENTE = [
  'qualified_study_codes',
  'interested_study_codes',
  'zone_preference',
  'available_slots',
  'offers_home',
  'available_as_substitute',
  'available_from',
  'available_to',
  'folleto_location',
] as const
export type CampoDelDirigente = typeof CAMPOS_DEL_DIRIGENTE[number]

/** Los que solo escribe el comité. Se nombran para poder decir POR QUÉ se
 *  rechaza, en vez de un «campo desconocido» que suena a bug. */
export const CAMPOS_DEL_COMITE: Record<string, string> = {
  formation_study_codes: 'La formación la certifica el comité de dirigentes, no se edita desde tu perfil.',
  availability_status: 'El estado administrativo lo maneja la coordinación de dirigentes.',
  active: 'Activarse o desactivarse como dirigente lo decide la coordinación.',
}

/** null = puede tocarlo. Si no, el motivo con el texto que va a leer. */
export function motivoQueImpideEditar(campo: string): string | null {
  if ((CAMPOS_DEL_DIRIGENTE as readonly string[]).includes(campo)) return null
  return CAMPOS_DEL_COMITE[campo] ?? 'Ese campo no se edita desde tu perfil.'
}

/**
 * La ventana del año en que puede dar.
 *
 * LAS DOS VACÍAS = TODO EL AÑO, que es el caso normal y no debería obligar a
 * nadie a escribir dos fechas. Solo se valida cuando puso algo.
 *
 * `hoy` entra como parámetro: el selector arranca desde la fecha actual
 * (pedido explícito), y una función que lee el reloj adentro no se puede
 * probar en una fecha cualquiera.
 */
export function motivoQueImpideElRango(
  desde: string | null | undefined,
  hasta: string | null | undefined,
  hoy: string,
): string | null {
  const d = (desde ?? '').slice(0, 10)
  const h = (hasta ?? '').slice(0, 10)
  if (!d && !h) return null
  for (const [v, cual] of [[d, 'de inicio'], [h, 'de fin']] as const) {
    if (!v) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return `La fecha ${cual} no tiene el formato esperado.`
    // El formato no alcanza: '2026-13-01' y '2026-02-31' lo pasan. `Date.parse`
    // los ACEPTA y los corre a otro mes, así que la prueba es el ida y vuelta —
    // el mismo truco que `motivoParaRechazarInicio` en successor-dates.
    const t = Date.parse(`${v}T00:00:00Z`)
    if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) {
      return `Esa fecha ${cual} no existe.`
    }
  }
  if (d && h && h < d) return 'La fecha de fin no puede ser anterior a la de inicio.'
  // El PASADO no se acepta acá, al revés que en el cierre de grupos (EST-16):
  // allá se registra algo que ya pasó, y acá se declara hacia adelante. Decir
  // «estoy disponible desde marzo» en octubre no significa nada.
  if (h && h < hoy) return 'Esa ventana ya pasó: poné una fecha de fin de hoy en adelante.'
  return null
}

/** Texto humano de la ventana, para el chip y el export. */
export function textoDelRango(
  desde: string | null | undefined,
  hasta: string | null | undefined,
): string {
  const d = (desde ?? '').slice(0, 10)
  const h = (hasta ?? '').slice(0, 10)
  if (!d && !h) return 'Todo el año'
  if (d && h) return `Del ${d} al ${h}`
  if (d) return `Desde el ${d}`
  return `Hasta el ${h}`
}

/**
 * CUÁNDO SE CONSIDERA VIEJA UNA CONFIRMACIÓN.
 *
 * Las campañas son tres veces al año —marzo, julio y noviembre—, o sea cada
 * cuatro meses. Se da un mes de gracia: a los cinco, la persona se saltó una
 * campaña entera y el dato ya no dice nada.
 *
 * NUNCA CONFIRMÓ no es lo mismo que CONFIRMÓ HACE MUCHO, y por eso son dos
 * estados y no un booleano: la primera es alguien a quien nunca se le preguntó
 * —hoy son las 505 fichas— y la segunda, alguien que dejó de contestar.
 */
export const MESES_DE_VIGENCIA_DE_LA_CONFIRMACION = 5

export type EstadoDeConfirmacion = 'nunca' | 'vigente' | 'vencida'

export function estadoDeConfirmacion(
  confirmadoIso: string | null | undefined,
  ahora: Date,
): EstadoDeConfirmacion {
  if (!confirmadoIso) return 'nunca'
  const t = Date.parse(confirmadoIso)
  if (!Number.isFinite(t)) return 'nunca'
  const limite = new Date(ahora)
  limite.setMonth(limite.getMonth() - MESES_DE_VIGENCIA_DE_LA_CONFIRMACION)
  return t >= limite.getTime() ? 'vigente' : 'vencida'
}

export const CONFIRMACION_LABEL: Record<EstadoDeConfirmacion, string> = {
  nunca: 'Nunca confirmó',
  vigente: 'Al día',
  vencida: 'Desactualizada',
}
