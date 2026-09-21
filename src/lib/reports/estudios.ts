/**
 * REP-9 · El reporte de estudios: cuántos grupos, cuánta gente y cómo les fue,
 * por tipo de estudio y por año.
 *
 * DEFINICIONES, que son lo que hace que los números signifiquen algo:
 *
 * · ESTUDIANTE DEL AÑO: alguien matriculado en un grupo que estuvo EN CURSO ese
 *   año, no en uno creado ese año. Un grupo que arranca en noviembre y cierra
 *   en febrero tiene estudiantes en los dos, y contarlos solo en el primero
 *   escondería medio cuatrimestre.
 *
 * · UNA PERSONA EN DOS ESTUDIOS cuenta UNA vez en el total del año y una vez en
 *   cada tipo. Por eso las filas de la tabla suman más que el total — igual que
 *   en el reporte de servidores, y la pantalla lo dice.
 *
 * · FINALIZÓ: la matrícula quedó en `completed`. `reprobado` cuenta como que
 *   llegó al final pero no aprobó, y por eso NO entra en el porcentaje: el
 *   número responde "¿cuántos terminaron bien?".
 *
 * · EDAD a la fecha de inicio del grupo, no a hoy: alguien que llevó Nivel 1 en
 *   2019 lo llevó con la edad que tenía entonces. Sin fecha de nacimiento queda
 *   FUERA del promedio y se reporta aparte, nunca como 0.
 *
 * Módulo PURO.
 */

export type FilaDeEstudios = {
  plan_code: string
  plan_nombre: string
  grupo_id: string
  grupo_estado: string | null
  member_id: string
  matricula_estado: string | null
  birth_date: string | null
  gender: string | null
  /** Inicio del grupo, 'YYYY-MM-DD'. La edad se calcula contra esta fecha. */
  inicio_del_grupo: string
  leader_id: string | null
  co_leader_id: string | null
  /** Bloque del cuatrimestre, o null si el grupo no está en ninguno. */
  bloque: string | null
}

/** La etiqueta de "ningún bloque". Es una opción del filtro, no un vacío: de
 *  los 255 grupos en curso en 2026, 199 no tienen bloque, así que esconderlos
 *  al filtrar dejaría afuera a la mayoría sin decirlo. */
export const SIN_BLOQUE = 'Sin bloque'

/** Los bloques presentes en los datos, con cuántos grupos tiene cada uno. Los
 *  del año más reciente primero y "Sin bloque" al final. */
export function bloquesDisponibles(
  filas: readonly FilaDeEstudios[],
): Array<{ bloque: string; grupos: number }> {
  const porBloque = new Map<string, Set<string>>()
  for (const f of filas) {
    const k = f.bloque ?? SIN_BLOQUE
    const ya = porBloque.get(k)
    if (ya) ya.add(f.grupo_id); else porBloque.set(k, new Set([f.grupo_id]))
  }
  return [...porBloque.entries()]
    .map(([bloque, grupos]) => ({ bloque, grupos: grupos.size }))
    .sort((a, b) => {
      if (a.bloque === SIN_BLOQUE) return 1
      if (b.bloque === SIN_BLOQUE) return -1
      return b.bloque.localeCompare(a.bloque, 'es')
    })
}

/** Recorta por bloque. '' = todos. */
export function filtrarPorBloque(
  filas: readonly FilaDeEstudios[],
  bloque: string,
): FilaDeEstudios[] {
  if (!bloque) return [...filas]
  return filas.filter(f => (f.bloque ?? SIN_BLOQUE) === bloque)
}

/** Estados de matrícula que cuentan como haber terminado BIEN. */
const FINALIZO = new Set(['completed'])

/** Edad cumplida a una fecha dada. 0 si falta o no se entiende. */
export function edadAlIniciar(birthDate: string | null, inicio: string): number {
  if (!birthDate) return 0
  const n = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`)
  const i = new Date(`${inicio.slice(0, 10)}T00:00:00Z`)
  if (isNaN(n.getTime()) || isNaN(i.getTime())) return 0
  let edad = i.getUTCFullYear() - n.getUTCFullYear()
  const m = i.getUTCMonth() - n.getUTCMonth()
  if (m < 0 || (m === 0 && i.getUTCDate() < n.getUTCDate())) edad--
  return edad > 0 && edad < 120 ? edad : 0
}

export type ResumenDeEstudios = {
  grupos: number
  /** Personas distintas. */
  estudiantes: number
  /** Dirigentes y co-dirigentes distintos. */
  dirigentes: number
  matriculas: number
  finalizaron: number
  /** Porcentaje que terminó bien. null si no hay matrículas. */
  pctFinalizo: number | null
  edadPromedio: number | null
  sinEdad: number
  mujeres: number
  hombres: number
  sinGenero: number
}

function pct(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 100)
}

function genero(g: string | null): 'F' | 'M' | 'sin' {
  const v = (g ?? '').trim().toUpperCase()
  return v === 'F' || v === 'M' ? v : 'sin'
}

export function resumirEstudios(filas: readonly FilaDeEstudios[]): ResumenDeEstudios {
  const personas = new Map<string, FilaDeEstudios>()
  for (const f of filas) if (!personas.has(f.member_id)) personas.set(f.member_id, f)
  const gente = [...personas.values()]

  const dirigentes = new Set<string>()
  for (const f of filas) {
    if (f.leader_id) dirigentes.add(f.leader_id)
    if (f.co_leader_id) dirigentes.add(f.co_leader_id)
  }

  const edades = gente.map(g => edadAlIniciar(g.birth_date, g.inicio_del_grupo)).filter(e => e > 0)
  const finalizaron = filas.filter(f => FINALIZO.has(f.matricula_estado ?? '')).length
  const generos = gente.map(g => genero(g.gender))

  return {
    grupos: new Set(filas.map(f => f.grupo_id)).size,
    estudiantes: gente.length,
    dirigentes: dirigentes.size,
    matriculas: filas.length,
    finalizaron,
    pctFinalizo: pct(finalizaron, filas.length),
    edadPromedio: edades.length ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
    sinEdad: gente.length - edades.length,
    mujeres: generos.filter(g => g === 'F').length,
    hombres: generos.filter(g => g === 'M').length,
    sinGenero: generos.filter(g => g === 'sin').length,
  }
}

export type FilaPorPlan = ResumenDeEstudios & {
  code: string
  nombre: string
}

/** Una fila por tipo de estudio, de la más grande a la más chica. */
export function porPlan(filas: readonly FilaDeEstudios[]): FilaPorPlan[] {
  const grupos = new Map<string, FilaDeEstudios[]>()
  for (const f of filas) {
    const ya = grupos.get(f.plan_code)
    if (ya) ya.push(f); else grupos.set(f.plan_code, [f])
  }
  return [...grupos.entries()]
    .map(([code, suyas]) => ({
      code,
      nombre: suyas[0].plan_nombre,
      ...resumirEstudios(suyas),
    }))
    .sort((a, b) => b.estudiantes - a.estudiantes || a.nombre.localeCompare(b.nombre, 'es'))
}

export type PuntoDeEstudios = { anio: number; etiqueta: string; estudiantes: number }

/** Estudiantes por año, para la evolución. Opcionalmente de un solo plan. */
export function serieDeEstudios(
  filas: readonly { anio: number; plan_code: string; estudiantes: number }[],
  planCode?: string,
): PuntoDeEstudios[] {
  const porAnio = new Map<number, number>()
  for (const f of filas) {
    if (planCode && f.plan_code !== planCode) continue
    porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + f.estudiantes)
  }
  return [...porAnio.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([anio, estudiantes]) => ({ anio, etiqueta: String(anio), estudiantes }))
}

/** Los años que existen en la serie, del más nuevo al más viejo. */
export function aniosConEstudios(filas: readonly { anio: number }[]): number[] {
  return [...new Set(filas.map(f => f.anio))].sort((a, b) => b - a)
}
