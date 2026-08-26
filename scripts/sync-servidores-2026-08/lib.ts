/**
 * Sincronización de servidores contra un export de CCB (agosto 2026).
 *
 * El CSV es de ASIGNACIONES, no de personas: una fila por persona+puesto+comité,
 * así que la misma persona sale varias veces. La unidad de verdad acá es el par
 * (persona, puesto), que es exactamente la llave de `volunteers`.
 *
 * Modelo: volunteers(member_id, position_id) → service_positions(area_id, title)
 *         → areas(name, area_type, parent_id)
 *
 * NO TOCA DATOS PERSONALES. El CSV trae `mobile` y `email` y se ignoran a
 * propósito: solo se usan para MATCHEAR (el correo como respaldo del external_id),
 * nunca para escribir en members.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function cargarEnv(): void {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const l of readFileSync(join(process.cwd(), f), 'utf8').split('\n')) {
        const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch { /* sigue */ }
  }
}

/** Mismo normalizador que el resto de los importadores del repo. */
export const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export const normEmail = (s: string) => (s ?? '').trim().toLowerCase()

/** CSV al estilo Excel: campos citados con "" adentro. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

/**
 * PostgREST corta en 1000 filas SIN AVISAR (ni error ni bandera). Con 1013
 * asignaciones ya estamos del otro lado del corte: leer sin paginar devolvería
 * un universo incompleto y el diff marcaría bajas que no existen.
 */
export async function todo<T>(
  q: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  const tam = 1000
  for (let p = 0; ; p++) {
    const { data, error } = await q(p * tam, p * tam + tam - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < tam) break
  }
  return out
}

/**
 * ALIAS: nombre que manda CCB → nombre nuestro que NO se toca.
 *
 * Son los dedazos del export. La diferencia con un renombre es la intención:
 * "Pedregal Miércoles ( Heredia )" es una decisión suya sobre cómo nombrar las
 * sedes y se respeta; "Workship" es una letra movida y no tiene por qué entrar
 * a producción.
 *
 * Esto NO es cosmético. El comparador une "Comité Comunicación" con "Comité de
 * Comunicación" porque solo sobra una palabra de relleno, pero "Workship" contra
 * "Worship" es una letra transpuesta y NO lo une. Sin este alias, el export del
 * mes entrante lee ese comité como NUEVO: se crea duplicado y sus personas se
 * mudan al duplicado. El alias es lo que corta ese ciclo.
 *
 * Al agregar una entrada: la izquierda es literal como viene del CSV, la
 * derecha tiene que existir en `areas.name` (el dry-run avisa si no).
 */
export const ALIAS_COMITE: Record<string, string> = {
  // Dedazos del export.
  'Comité Workship': 'Comité de Worship',
  'Comité Comunity': 'Community',
  'Area de Operaciónes': 'Área Operaciones',
  // Minúscula del export. La aprobación fue tomar el nombre de CCB donde hay
  // una DECISIÓN detrás; "sports" en minúscula no es una decisión.
  'Comité sports': 'Comité Sports',
  // El comité nuevo llega con el nombre corto; el nombre real lleva el prefijo
  // de sede, igual que su hermana Martes. Sin este alias, las 23 filas de esa
  // sede no resolvían contra el área recién creada.
  'Meridiano Miércoles': 'Sede Oeste - Meridiano Miércoles',

  // LAS 12 SEDES. CCB les quita el prefijo y algunas las manda sin acento
  // ("Guapiles") o con otro esquema ("Pedregal Miércoles ( Heredia )"). El
  // nombre real lleva "Sede" adelante, así que ninguna se renombra: todas
  // entran como alias y la BD conserva su nombre.
  'Liberia': 'Sede Liberia',
  'Potrero': 'Sede Potrero',
  'Madrid': 'Sede Madrid',
  'Alajuela': 'Sede Alajuela',
  'Cartago': 'Sede Cartago',
  'Guapiles': 'Sede Guápiles',
  'Perez Zeledón': 'Sede Pérez Zeledón',
  'Antares': 'Sede Pro Este - Antares',
  'Meridiano Martes': 'Sede Oeste - Meridiano Martes',
  'Pedregal Jueves ( Home )': 'Sede Home',
  'Pedregal Miércoles ( Heredia )': 'Sede Heredia',
  'Pedregal Domingos ( United )': 'Sede United',
}

/**
 * Áreas que hay que CREAR, con el nombre que les toca según la convención
 * nuestra — no el que manda CCB.
 *
 * "Meridiano Miércoles" no es un nombre distinto de algo que ya existe: es que
 * Meridiano se partió en dos días. Se crea como hermana de "Sede Oeste -
 * Meridiano Martes", con el mismo prefijo y el mismo área padre. El acento en
 * "Miércoles" va como en la hermana.
 */
export const AREAS_A_CREAR: Record<string, { padre: string }> = {
  // Se indexa por el nombre FINAL (el que sale del alias), no por el que manda
  // CCB. El padre no puede salir de "Category Name" acá: esa columna dice
  // "Sedes", y "Sedes" en nuestra BD es un COMITÉ bajo Área Operaciones — una
  // sede nueva colgada de ahí quedaría fuera del árbol de sedes y, peor, sus
  // puestos de bienvenida dejarían de otorgar `encargado_eventos`, porque esa
  // regla exige que el padre sea Área Espiritual.
  'Sede Oeste - Meridiano Miércoles': { padre: 'Área Espiritual' },
}

/**
 * Renombres que el comparador NO puede deducir: los nombres no se parecen lo
 * suficiente y solo el solape de personas los delata (6 de 6 en este caso).
 * Van explícitos porque, sin esto, el comité se lee como NUEVO: se crea un
 * duplicado y sus 6 personas se mudan al duplicado dejando el original vacío.
 * Se aplican ANTES de todo lo demás, así el resto del script ya encuentra el
 * área por su nombre nuevo.
 */
export const RENOMBRES: Record<string, string> = {
  'Comité de Tecnologías Informáticas': 'Comité Tecnología de Información',
}

/** Mismo criterio para los títulos de puesto. Acá el alias aplica al título
 *  solo, sin importar el comité: "Colaboador" es dedazo en cualquier sede. */
export const ALIAS_PUESTO: Record<string, string> = {
  'Colaboador Finanzas': 'Colaborador Finanzas',
  'Coordinador Infomación': 'Coordinador Información',
}

export const aliasComite = (n: string) => ALIAS_COMITE[n.trim()] ?? n.trim()
export const aliasPuesto = (n: string) => ALIAS_PUESTO[n.trim()] ?? n.trim()

export type FilaCsv = {
  linea: number
  externalId: string
  nombre: string
  email: string
  puesto: string
  comite: string
  /** "Category Name" del export crudo: el área padre del comité. Vacío si el
   *  CSV no la trae. */
  categoria: string
}

export function leerCsv(ruta: string): FilaCsv[] {
  // El BOM del export queda DENTRO de la primera celda del header, así que
  // "Individual ID" no se encuentra nunca. Se quita antes de parsear.
  const rows = parseCsv(readFileSync(ruta, 'utf8').replace(/^\uFEFF/, ''))
  const header = rows[0].map(h => h.trim())

  /** Dos formatos vivos: el export CRUDO de CCB ("Individual ID", "Team Name",
   *  "Category Name") y el CSV ya normalizado que quedó de la carga de agosto 10
   *  (external_id, team_name). Se acepta cualquiera de los dos. */
  const col = (...nombres: string[]) => {
    for (const n of nombres) { const i = header.indexOf(n); if (i >= 0) return i }
    return -1
  }
  const req = (...nombres: string[]) => {
    const i = col(...nombres)
    if (i < 0) throw new Error(`El CSV no trae ninguna de estas columnas: ${nombres.join(' / ')}. Trae: ${header.join(', ')}`)
    return i
  }
  const cId = req('Individual ID', 'external_id')
  const cFn = req('First Name', 'first_name')
  const cLn = req('Last Name', 'last_name')
  const cPos = req('Position Name', 'position_name')
  const cTeam = req('Team Name', 'team_name')
  const cEmail = req('Email', 'email')
  /** El área padre. Solo la trae el export crudo; en el normalizado no existe y
   *  queda vacía (las áreas nuevas entonces sí necesitan padre a mano). */
  const cCat = col('Category Name', 'category_name')

  const out: FilaCsv[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    out.push({
      linea: i + 1,
      externalId: (r[cId] ?? '').trim(),
      nombre: `${(r[cFn] ?? '').trim()} ${(r[cLn] ?? '').trim()}`.trim(),
      email: normEmail(r[cEmail] ?? ''),
      // los alias se aplican EN LA LECTURA: de acá para adentro el resto del
      // script ya trabaja con nuestros nombres y no tiene que saber de dedazos.
      puesto: aliasPuesto(r[cPos] ?? ''),
      comite: aliasComite(r[cTeam] ?? ''),
      categoria: cCat >= 0 ? (r[cCat] ?? '').trim() : '',
    })
  }
  return out
}


/**
 * El export de CCB nombra distinto que la BD. Tres capas, de la más segura a la
 * que EXIGE ojo humano:
 *
 *   1) nombre idéntico (normalizado)
 *   2) nombre equivalente: sin palabras de relleno ("de", "la") ni el prefijo
 *      "Sede"/"Comité". Acá caen "Comité Comunicación" = "Comité de
 *      Comunicación" y "Area de Comunidad" = "Área Comunidad".
 *   3) solape de PERSONAS. Es la única capa que puede detectar que "Antares" es
 *      "Sede Pro Este - Antares", porque los nombres no se parecen en nada. Y es
 *      la única que puede equivocarse fuerte, así que nunca se aplica sola:
 *      exige umbral, resolución uno-a-uno, y aprobación.
 */
const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y'])

export const clave = (s: string) =>
  norm(s)
    .replace(/[()\-–—.]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !RELLENO.has(w))
    .join(' ')

/** Igual que `clave` pero además suelta el prefijo de tipo, para que "Antares"
 *  pueda encontrarse contra "Sede Pro Este Antares" por la vía de contención. */
export const claveSinTipo = (s: string) =>
  clave(s).replace(/^(sede|comite|subcomite|area)\s+/, '')


/**
 * Comités que NO los manda este CSV, aunque aparezcan en él.
 *
 * "Comité de Dirigentes" lo escribe el MÓDULO DE ESTUDIOS: addDirigente() y
 * setDirigenteActive() en queries/studies.ts hacen upsert en volunteers cuando
 * alguien se marca como dirigente activo. Si esta sincronización le da de baja
 * a alguien ahí, el módulo de estudios lo vuelve a meter en cuanto se toque ese
 * dirigente: los dos sistemas se pelean y el CSV siempre pierde. La membresía
 * de ese comité se corrige desde /estudios/dirigentes, no desde acá.
 */
export const COMITES_AJENOS = ['Comité de Dirigentes']

/** Compara con `clave`, no con `norm`: el CSV dice "Comité Dirigentes" y la BD
 *  "Comité de Dirigentes". Con norm no coincidían y el comité se colaba igual. */
export const esAjeno = (nombre: string) => COMITES_AJENOS.some(c => clave(c) === clave(nombre))
