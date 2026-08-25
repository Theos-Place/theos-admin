/**
 * Migración CCB agosto 2026 · parsing, normalización y mapeos compartidos.
 *
 * Vive aparte del runner para que las decisiones de mapeo (plan, sede, nombre)
 * sean legibles y testeables sin tocar la base.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DATA = join(process.cwd(), 'data-import')

/**
 * REGLA DE ESTA MIGRACIÓN: no se crea NINGÚN pago.
 *
 * Verificado el 2026-08-24 después de la Etapa 2 (205 matrículas nuevas): los
 * pagos de matrícula pendientes seguían siendo 6, los mismos de antes, ninguno
 * creado por la corrida. La razón es estructural y conviene dejarla escrita:
 * `study_enrollments` solo tiene triggers de auditoría y de updated_at, ninguno
 * genera cobros. El cobro nace en el flujo de matrícula de la app, y estos
 * scripts escriben directo con service role, así que ese camino no corre.
 *
 * Importa además por PAG-2: un pago de matrícula pendiente BLOQUEA a la persona
 * para matricularse en otro estudio. Crear 205 cobros al migrar habría dejado a
 * 205 personas trabadas sin que nadie entendiera por qué.
 *
 * Si alguna etapa futura necesitara insertar en `payments`, es una decisión que
 * se pide antes, no un efecto colateral.
 */
export const NO_CREAR_PAGOS = true

/** Sin tildes, minúsculas, espacios colapsados. La base para todo match por nombre. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/** CSV con comillas: hay nombres de grupo con comas adentro (verificado — un
 *  split por coma rompe el archivo de grupos). */
export function leerCsv(nombre: string): Record<string, string>[] {
  const txt = readFileSync(join(DATA, nombre), 'utf8')
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (enComillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const [cab, ...resto] = filas
  return resto.filter(f => f.some(v => v.trim()))
    .map(f => Object.fromEntries(cab.map((k, i) => [k.trim(), (f[i] ?? '').trim()])))
}

/** Nombre del grupo → código de plan.
 *
 *  Dos correcciones a la tabla recibida, verificadas contra study_plans: "Hechos"
 *  es HCH (no HECHOS) y "Evangelismo" es EVM (no EVAN). Los nombres calzan
 *  exacto, así que no hay ambigüedad — pero se dejan anotadas acá.
 *  Resuelve los 102 grupos abiertos al 100%. */
const PLANES: Array<[RegExp, string]> = [
  [/\bnivel\s*1\b|\bn1\b/, 'N1'], [/\bnivel\s*2\b|\bn2\b/, 'N2'],
  [/\bnivel\s*3\b|\bn3\b/, 'N3'], [/\bnivel\s*4\b|\bn4\b/, 'N4'],
  [/discipulos\s*1/, 'DIS1'], [/discipulos\s*2/, 'DIS2'], [/discipulos\s*3/, 'DIS3'],
  [/sirviendo como jesus|\bscj\b/, 'SCJ'],
  [/\bcdeb\b|como dar estudios biblicos/, 'CDEB'],
  [/como interpretar la biblia|hermeneutica/, 'HER'],
  [/religiones del mundo/, 'RDM'],
  [/panorama/, 'PAN'],
  [/hechos/, 'HCH'],
  [/evangelismo/, 'EVM'],
  [/pre\s*matrimonial|prematrimonial/, 'PREMAT'],
  [/adonde va este bus/, 'BUS'],
  [/administrando el dinero|adm\.?\s*el dinero/, 'AED'],
]

export function planDe(groupName: string): string | null {
  const n = norm(groupName)
  return PLANES.find(([re]) => re.test(n))?.[1] ?? null
}

/** Listas administrativas que conviven con los grupos reales en los exports de
 *  CCB. No son estudios: no se crean, no se matricula a nadie y no resuelven
 *  graduaciones. Se detectan por nombre; la señal estructural (sin dirigente, o
 *  dirigente institucional) la aplica el runner, que sí ve esos campos. */
const LISTA_PATRONES = [
  /invitacion/, /retencion/, /no att/, /\blista\b/, /nuevos eb/, /pendiente/,
]
export function esListaAdministrativa(nombre: string): boolean {
  const n = norm(nombre)
  return LISTA_PATRONES.some(re => re.test(n))
}
/** Cuentas institucionales que aparecen como "dirigente" de una lista. */
export function esDirigenteInstitucional(nombre: string): boolean {
  const n = norm(nombre)
  return /theos place|estudios biblicos/.test(n)
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

/** Mes/año del nombre del grupo → primer día de ese mes (YYYY-MM-01).
 *  Es la fecha de inicio aproximada: CCB no exporta la fecha real, y el nombre
 *  la trae por convención ("Nivel 4. Laura Sandí. Mayo 2026"). Se usa para la
 *  equivalencia con grupos ya migrados y para el filtro por fecha de la Etapa 3. */
export function inicioDe(groupName: string): string | null {
  const n = norm(groupName)
  const m = n.match(new RegExp(`\\b(${Object.keys(MESES).join('|')})\\s*(?:de\\s*)?(20\\d{2})\\b`))
  if (!m) return null
  return `${m[2]}-${String(MESES[m[1]]).padStart(2, '0')}-01`
}

/** ¿El nombre dice que el grupo es virtual? En CCB la modalidad viaja en el
 *  nombre; en nuestra base es la bandera is_virtual, no una sede. */
export function esVirtual(groupName: string): boolean {
  return /\bvirtual\b/.test(norm(groupName))
}

/** "Jimenez Gutierrez, Florana" → "florana jimenez gutierrez".
 *  El archivo de graduaciones trae los nombres invertidos con coma; el de
 *  participantes, derechos. Se normalizan a la misma forma para comparar. */
export function nombreDerecho(s: string): string {
  const n = norm(s)
  if (!n.includes(',')) return n
  const [ap, no] = n.split(',', 2)
  return `${no.trim()} ${ap.trim()}`.trim()
}

/**
 * Dirigentes cuyo nombre en CCB no calza exacto con el de la base.
 *
 * Son SEIS casos, y van con external_id explícito a propósito: aflojar el
 * algoritmo de match (fuzzy, por apellido, por prefijo) para resolverlos
 * arriesgaría matches equivocados sobre 23.739 personas. Una tabla de seis
 * líneas es auditable; un umbral de similitud no.
 *
 * Los seis se verificaron contra la base el 2026-08-24: los seis YA dirigen
 * grupos acá (entre 1 y 15 cada uno), así que no son homónimos.
 *   · «Guiselle» en CCB, «Gisselle» acá
 *   · el apodo «(Tio)» en medio del nombre
 *   · falta el segundo nombre («Fernanda») o el segundo apellido («Gonzalez»)
 *   · el apodo «Lulu» de prefijo
 * Paola Goiri la confirmó el usuario por su correo (paolagoiri3@gmail.com).
 */
export const DIRIGENTES_POR_EXTERNAL_ID: Record<string, string> = {
  'guiselle lopez rodriguez': '7402',        // Gisselle Lopez Rodriguez
  'alonso araya morales': '195',             // Alonso (Tio) Araya Morales
  'maria fernanda madrigal alvarado': '2602',// Maria Madrigal Alvarado
  'luisa quesada vargas': '4666',            // Lulu Luisa Quesada Vargas
  'johana forero mercado': '10708',          // Johana Forero
  'paola goiri gonzalez': '6558',            // Paola Goiri
}

/**
 * Grupos que CCB trae con un nombre y nuestra base ya tiene con otro.
 *
 * El caso: nuestro sistema crea un GRUPO SUCESOR cuando una cohorte pasa junta
 * al siguiente nivel, y lo nombra `<PLAN> · <nombre del grupo anterior>`. CCB,
 * en cambio, lo nombra por el estudio nuevo. Son el mismo grupo con la misma
 * gente — verificado persona por persona el 2026-08-24: 10 de 10 en el de
 * Fernando Gutiérrez, 6 de 7 en el de Sofía Solís (Vivian Monge entró después).
 *
 * Sin este alias pasan dos cosas malas: la Etapa 1 crea un gemelo vacío, y la
 * Etapa 2 matricula de nuevo a gente que ya está, dejándola con dos matrículas
 * abiertas del mismo plan — que además rompe la Etapa 3.
 *
 * No se detectan solos porque el sucesor tiene el nombre prefijado y `starts_at`
 * en nulo: no calzan ni por nombre ni por equivalencia (plan+dirigente+mes).
 * Son dos casos conocidos; van a mano, como los dirigentes.
 */
export const ALIAS_GRUPO: Record<string, string> = {
  'discipulos 2.fernando gutierrez.agosto 2026': 'DIS2 · Discípulos 1.Fernando Gutiérrez.Junio 2026',
  'nivel 3. sofia solis. agosto 2026': 'N3 · Nivel 2. Sofía Solís. Junio 2026',
}

/** El nombre con el que hay que buscar el grupo en NUESTRA base. */
export function nombreEnLaBase(nombreCcb: string): string {
  return ALIAS_GRUPO[norm(nombreCcb)] ?? nombreCcb
}
