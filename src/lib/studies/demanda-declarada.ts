/**
 * EST-29 · Demanda DECLARADA: las solicitudes que la gente ya hizo, agrupadas
 * para decidir dónde abrir un grupo. «Hay 4 pidiendo Nivel 1 en Heredia y 2
 * dirigentes disponibles ahí → abramos».
 *
 * No es el «Análisis de bloque» (/estudios/analisis), que calcula la demanda
 * POTENCIAL —quién está por graduarse o ya es elegible— sin mirar solicitudes.
 * Esto cuenta a quien levantó la mano.
 *
 * TRES FUENTES, y no guardan lo mismo (censo del 2026-10-16):
 *  · «Me interesa un estudio»: plan, días y franja; la zona es el NOMBRE de una
 *    sede elegido en una lista, o texto libre si eligió «Otra».
 *  · Reubicaciones (REU-2): estudio que necesita, días, franja y zonas en CÓDIGO.
 *  · Becas cuyo grupo se llenó (BEC-5 «por modificar»): plan y nada más.
 * Lo que no se pueda ubicar en una zona va a «Otra zona» con el texto a la
 * vista, no se adivina.
 *
 * Las CAPACITACIONES (todo lo que no es N1–N4 ni DIS2/DIS3, `isCapacitacion`)
 * se agrupan solo por plan: se abren centralizadas, por bloque, y partirlas
 * por zona las haría ver más chicas de lo que son.
 *
 * Módulo PURO.
 */
import { isCapacitacion } from '@/lib/studies/bloques'
import { STUDY_GROUPS } from '@/lib/studies/study-grouping'

/**
 * Las tres etapas de un clúster (Floriana, 2026-10-20):
 *  · «Listos para abrir»: 5 o más personas.
 *  · «Potencialmente»: de 2 a 4 — todavía no alcanza, pero va camino.
 *  · «Aún no»: 1 persona sola.
 * Antes había un solo corte, en 3.
 */
export const UMBRAL_ACCIONABLE = 5
export const UMBRAL_POTENCIAL = 2

export type EtapaDelCluster = 'listo' | 'potencial' | 'aun_no'

export const ETIQUETA_ETAPA: Record<EtapaDelCluster, string> = {
  listo: 'Listos para abrir',
  potencial: 'Potencialmente',
  aun_no: 'Aún no',
}

/**
 * En qué etapa está un clúster. «Otra zona» nunca es «listo» aunque junte
 * cinco: no se sabe dónde abrir (la misma regla que `accionable`).
 */
export function etapaDelCluster(c: Pick<Cluster, 'personas' | 'zona'>, umbral = UMBRAL_ACCIONABLE): EtapaDelCluster {
  const n = c.personas.length
  if (n >= umbral && c.zona !== SIN_ZONA) return 'listo'
  return n >= UMBRAL_POTENCIAL ? 'potencial' : 'aun_no'
}

export const SIN_ZONA = '__otra__'
export const CUALQUIER_ZONA = '__cualquiera__'
/** «Virtual» se elige en el formulario de interés (2026-10-20). Es una zona
 *  de verdad para abrir un grupo, no «Otra zona». */
export const ZONA_VIRTUAL = '__virtual__'
export const ETIQUETA_VIRTUAL = 'Virtual'
/** Lo que se le pide a quien elige virtual: por qué. */
export const MIN_RAZON_VIRTUAL = 10

/** ¿El texto de zona es «Virtual»? Sin importar mayúsculas ni tildes. */
export function esZonaVirtual(texto: string | null | undefined): boolean {
  return (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'virtual'
}

export type FuenteDeDemanda = 'interes' | 'reubicacion' | 'beca'

export const ETIQUETA_FUENTE: Record<FuenteDeDemanda, string> = {
  interes: 'Me interesa un estudio',
  reubicacion: 'Reubicación',
  beca: 'Beca con grupo lleno',
}

/** Una persona que pide algo, ya normalizada desde cualquiera de las fuentes. */
export type Solicitud = {
  id: string
  fuente: FuenteDeDemanda
  memberId: string
  nombre: string
  email: string | null
  telefono: string | null
  planCode: string
  /** Códigos de zona. Vacío = no se pudo ubicar; [CUALQUIER_ZONA] = le sirve cualquiera. */
  zonas: string[]
  /** Lo que escribió, si no era una zona conocida. */
  zonaTexto: string | null
  dias: string[]
  franja: string | null
  creada: string
  estado: string
  grupoPropuestoId: string | null
}

/** Las sedes que la pantalla conoce, para traducir nombre → código. */
export type SedeConocida = { code: string; name: string }

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * La zona de una solicitud, en códigos.
 *
 * Reubicación: ya viene en código (o «Cualquiera»). Interés: viene el NOMBRE
 * de la sede que eligió en la lista; se busca por nombre exacto, sin importar
 * tildes ni mayúsculas, y también con o sin el prefijo «Sede». Lo que no
 * calce queda como texto: «Virtual, vive en Estados Unidos» no es una zona y
 * no se le inventa una.
 */
export function zonasDeSolicitud(
  r: { proposed_zones?: string[] | null; proposed_location?: string | null },
  sedes: readonly SedeConocida[],
): { zonas: string[]; texto: string | null } {
  const porCodigo = new Map(sedes.map(s => [sinTildes(s.code), s.code]))
  const porNombre = new Map<string, string>()
  for (const s of sedes) {
    porNombre.set(sinTildes(s.name), s.code)
    porNombre.set(sinTildes(s.name.replace(/^sede\s+/i, '')), s.code)
  }
  const crudas = (r.proposed_zones ?? []).filter(Boolean)
  if (crudas.length) {
    if (crudas.some(z => sinTildes(z) === 'cualquiera')) return { zonas: [CUALQUIER_ZONA], texto: null }
    const zonas = crudas.map(z => porCodigo.get(sinTildes(z)) ?? porNombre.get(sinTildes(z))).filter((z): z is string => !!z)
    return { zonas: [...new Set(zonas)], texto: zonas.length ? null : crudas.join(', ') }
  }
  const texto = (r.proposed_location ?? '').trim()
  if (!texto) return { zonas: [], texto: null }
  if (esZonaVirtual(texto)) return { zonas: [ZONA_VIRTUAL], texto: null }
  const code = porNombre.get(sinTildes(texto)) ?? porNombre.get(sinTildes(texto.replace(/^sede\s+/i, ''))) ?? porCodigo.get(sinTildes(texto))
  return code ? { zonas: [code], texto: null } : { zonas: [], texto }
}

export type Cluster = {
  clave: string
  planCode: string
  esCapacitacion: boolean
  /** Código de zona, SIN_ZONA o CUALQUIER_ZONA. null en capacitaciones (no van por zona). */
  zona: string | null
  personas: Solicitud[]
  accionable: boolean
  /** Lo más pedido dentro del clúster, para prellenar el grupo. */
  diasMasPedidos: string[]
  franjaMasPedida: string | null
}

function masFrecuentes(valores: string[], cuantos: number): string[] {
  const n = new Map<string, number>()
  for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, cuantos).map(([v]) => v)
}

/**
 * Agrupa por plan × zona (las capacitaciones, solo por plan).
 *
 * Quien pidió VARIAS zonas (una reubicación con «Escazú, Santa Ana») cuenta en
 * cada una: le sirve cualquiera de las dos, y para decidir dónde abrir importa
 * saber que en las dos hay alguien. Por eso los clústeres de una misma persona
 * pueden sumar más que el total de solicitudes — la pantalla lo dice.
 */
export function agruparDemanda(solicitudes: readonly Solicitud[], umbral = UMBRAL_ACCIONABLE): Cluster[] {
  const grupos = new Map<string, Cluster>()
  for (const s of solicitudes) {
    const cap = isCapacitacion(s.planCode)
    const zonas = cap ? [null] : (s.zonas.length ? s.zonas : [SIN_ZONA])
    for (const zona of zonas) {
      const clave = `${s.planCode}|${zona ?? ''}`
      const g = grupos.get(clave) ?? {
        clave, planCode: s.planCode, esCapacitacion: cap, zona,
        personas: [], accionable: false, diasMasPedidos: [], franjaMasPedida: null,
      }
      if (!g.personas.some(p => p.id === s.id)) g.personas.push(s)
      grupos.set(clave, g)
    }
  }
  return [...grupos.values()]
    .map(g => ({
      ...g,
      personas: [...g.personas].sort((a, b) => a.creada.localeCompare(b.creada)),
      accionable: g.zona !== SIN_ZONA && g.personas.length >= umbral,
      diasMasPedidos: masFrecuentes(g.personas.flatMap(p => p.dias), 2),
      franjaMasPedida: masFrecuentes(g.personas.map(p => p.franja).filter((f): f is string => !!f), 1)[0] ?? null,
    }))
    .sort((a, b) => b.personas.length - a.personas.length || a.planCode.localeCompare(b.planCode) || (a.zona ?? '').localeCompare(b.zona ?? ''))
}

/** Lo que hace falta saber de un dirigente para el cruce con la oferta. */
export type DirigenteParaDemanda = {
  memberId: string
  nombre: string
  /** Activo y disponible YA calculado con `disponibilidadEfectiva` (dirigiendo incluido). */
  disponible: boolean
  /** `qualified_study_codes`: lo que dice que puede dar ahora. */
  puedeDar: readonly string[]
  /** `zone_preference`: vacío = cualquier zona. */
  zonas: readonly string[]
}

const NIVELES = new Set(STUDY_GROUPS.niveles.codes)

/**
 * ¿Puede dar este plan? Lo que declaró en «disponible para dar». Dar un
 * Nivel habilita para todos los Niveles (la misma regla que el badge de
 * `groupCodesForDisplay`).
 */
export function puedeDarPlan(d: Pick<DirigenteParaDemanda, 'puedeDar'>, planCode: string): boolean {
  if (d.puedeDar.includes(planCode)) return true
  return NIVELES.has(planCode) && d.puedeDar.some(c => NIVELES.has(c))
}

/**
 * Los dirigentes que podrían abrir ESTE clúster: disponibles, que puedan dar
 * el plan, y cuya zona preferida lo incluya (sin preferencia = cualquiera).
 *
 * En «Otra zona» y en capacitaciones no se filtra por zona: no hay una zona
 * contra la que comparar, y para una capacitación centralizada no aplica.
 */
export function dirigentesParaCluster(c: Pick<Cluster, 'planCode' | 'zona'>, dirigentes: readonly DirigenteParaDemanda[]): DirigenteParaDemanda[] {
  return dirigentes
    .filter(d => d.disponible && puedeDarPlan(d, c.planCode))
    // Virtual tampoco: se da desde cualquier lado.
    .filter(d => !c.zona || c.zona === SIN_ZONA || c.zona === CUALQUIER_ZONA || c.zona === ZONA_VIRTUAL || d.zonas.length === 0 || d.zonas.includes(c.zona))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Lunes de la semana de una fecha, como YYYY-MM-DD (UTC). */
export function lunesDe(iso: string): string {
  const d = new Date(iso)
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/**
 * Solicitudes NUEVAS por semana y por plan, de las últimas `semanas`.
 * Cuenta todas las que entraron, abiertas o no: la pregunta es si la demanda
 * de algo crece, no cuánto queda pendiente.
 */
export function tendenciaSemanal(
  creadas: readonly { planCode: string; creada: string }[],
  ahora: Date,
  semanas = 12,
): { semanas: string[]; porPlan: Array<{ planCode: string; conteos: number[]; total: number }> } {
  const ultima = lunesDe(ahora.toISOString())
  const lista: string[] = []
  for (let i = semanas - 1; i >= 0; i--) {
    const d = new Date(`${ultima}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    lista.push(d.toISOString().slice(0, 10))
  }
  const indice = new Map(lista.map((s, i) => [s, i]))
  const porPlan = new Map<string, number[]>()
  for (const c of creadas) {
    const i = indice.get(lunesDe(c.creada))
    if (i === undefined) continue
    const fila = porPlan.get(c.planCode) ?? Array(semanas).fill(0)
    fila[i]++
    porPlan.set(c.planCode, fila)
  }
  return {
    semanas: lista,
    porPlan: [...porPlan.entries()]
      .map(([planCode, conteos]) => ({ planCode, conteos, total: conteos.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total || a.planCode.localeCompare(b.planCode)),
  }
}

/** «Escazú», «Otra zona», «Cualquier zona» o «Centralizada» (capacitaciones). */
export function etiquetaDeZona(zona: string | null, zonas: Record<string, string>): string {
  if (zona === null) return 'Centralizada'
  if (zona === SIN_ZONA) return 'Otra zona'
  if (zona === CUALQUIER_ZONA) return 'Cualquier zona'
  if (zona === ZONA_VIRTUAL) return ETIQUETA_VIRTUAL
  return zonas[zona] ?? zona
}
