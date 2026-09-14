/**
 * Qué se le pregunta a quien fusiona dos fichas, y qué no.
 *
 * EL CASO: al fusionar "Zully Murillo" con "Zully Murillo Sanchez" se perdió el
 * segundo apellido. El RPC fusiona los campos con `coalesce(principal, duplicado)`,
 * o sea rellena los HUECOS del principal — pero cuando los dos tienen valor se
 * queda con el del principal sin preguntar. "Murillo" le ganó a "Murillo Sanchez".
 *
 * De ahí los tres grupos: lo idéntico no se pregunta, el hueco se rellena solo
 * (y se muestra, para que se vea que el dato vino del duplicado) y el CONFLICTO
 * —los dos tienen valor y difieren— es lo único que pide decisión.
 *
 * Cédula y fecha de nacimiento no traen default: son identidad, y un default
 * ahí es justo la forma de perder el dato bueno sin mirarlo.
 */

export type LadoFusion = 'principal' | 'duplicado'

export type CampoFusionable = {
  key: string
  label: string
  /** Sin default: hay que elegir a mano. Son los que definen quién es la persona. */
  identidad?: boolean
  /** Texto largo: además de elegir uno, se pueden combinar los dos. */
  combinable?: boolean
}

/**
 * Los campos que se comparan. No están todas las columnas de `members` a
 * propósito: quedan afuera las que no son un dato de la persona (tokens,
 * banderas de rebote de correo, sede calculada) y las que resuelve el RPC por
 * su cuenta (id, fechas de sistema, auth_user_id, external_id).
 */
export const CAMPOS_FUSIONABLES: CampoFusionable[] = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellidos' },
  { key: 'cedula', label: 'Cédula', identidad: true },
  { key: 'document_type', label: 'Tipo de documento' },
  { key: 'birth_date', label: 'Fecha de nacimiento', identidad: true },
  { key: 'gender', label: 'Género' },
  { key: 'marital_status', label: 'Estado civil' },
  { key: 'email', label: 'Correo' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'province', label: 'Provincia' },
  { key: 'canton', label: 'Cantón' },
  { key: 'district', label: 'Distrito' },
  { key: 'address', label: 'Dirección', combinable: true },
  { key: 'occupation', label: 'Ocupación' },
  { key: 'workplace', label: 'Lugar de trabajo' },
  { key: 'allergies', label: 'Alergias', combinable: true },
  { key: 'medications', label: 'Medicamentos', combinable: true },
  // Es un arreglo en la base, no un texto: no se puede concatenar.
  { key: 'dietary_restrictions', label: 'Restricción alimenticia' },
  { key: 'emergency_contact_name', label: 'Contacto de emergencia' },
  { key: 'emergency_contact_phone', label: 'Teléfono de emergencia' },
  { key: 'photo_url', label: 'Foto' },
]

export type FichaParaFusion = Record<string, unknown> & { id: string }

const vacio = (v: unknown) =>
  v === null || v === undefined
  || (typeof v === 'string' && v.trim() === '')
  || (Array.isArray(v) && v.length === 0)

const texto = (v: unknown) =>
  // Los arreglos (restricción alimenticia) se comparan por contenido, sin que
  // el orden los haga parecer distintos.
  Array.isArray(v) ? [...v].map(x => String(x).trim().toLowerCase()).sort().join('|')
    : String(v ?? '').trim().toLowerCase()

/** Compara como lo vería una persona: sin espacios de sobra ni mayúsculas. */
const igual = (a: unknown, b: unknown) => texto(a) === texto(b)

export type CampoIgual = { campo: CampoFusionable; valor: unknown }
export type CampoDeUnLado = { campo: CampoFusionable; valor: unknown; lado: LadoFusion }
export type CampoEnConflicto = { campo: CampoFusionable; principal: unknown; duplicado: unknown }

export type Clasificacion = {
  /** Idénticos en los dos: no se preguntan, se muestran colapsados. */
  iguales: CampoIgual[]
  /** Solo uno tiene valor: se toma ese, sin preguntar, pero a la vista. */
  soloUno: CampoDeUnLado[]
  /** Los dos tienen valor y difieren: hay que elegir. */
  conflictos: CampoEnConflicto[]
  /** Vacíos en los dos: ni se muestran. */
  ambosVacios: CampoFusionable[]
}

export function clasificarCampos(principal: FichaParaFusion, duplicado: FichaParaFusion): Clasificacion {
  const r: Clasificacion = { iguales: [], soloUno: [], conflictos: [], ambosVacios: [] }
  for (const campo of CAMPOS_FUSIONABLES) {
    const p = principal[campo.key], d = duplicado[campo.key]
    if (vacio(p) && vacio(d)) { r.ambosVacios.push(campo); continue }
    if (vacio(p)) { r.soloUno.push({ campo, valor: d, lado: 'duplicado' }); continue }
    if (vacio(d)) { r.soloUno.push({ campo, valor: p, lado: 'principal' }); continue }
    if (igual(p, d)) { r.iguales.push({ campo, valor: p }); continue }
    r.conflictos.push({ campo, principal: p, duplicado: d })
  }
  return r
}

/** 'combinado' solo aplica a los campos de texto largo. */
export type Eleccion = LadoFusion | 'combinado'
export type Resolucion = Record<string, Eleccion>

/**
 * Preselección: el principal, salvo en los campos de identidad, que quedan sin
 * elegir a propósito para obligar a mirarlos.
 */
export function resolucionInicial(c: Clasificacion): Resolucion {
  const r: Resolucion = {}
  for (const x of c.conflictos) if (!x.campo.identidad) r[x.campo.key] = 'principal'
  return r
}

/** Los campos de identidad en conflicto que todavía nadie decidió. */
export function faltanPorDecidir(c: Clasificacion, r: Resolucion): CampoFusionable[] {
  return c.conflictos.filter(x => !r[x.campo.key]).map(x => x.campo)
}

export function estaCompleta(c: Clasificacion, r: Resolucion): boolean {
  return faltanPorDecidir(c, r).length === 0
}

/** Dos textos en uno, sin repetir si uno ya contiene al otro. */
export function combinarTexto(a: unknown, b: unknown): string {
  const x = String(a ?? '').trim(), y = String(b ?? '').trim()
  if (!x) return y
  if (!y) return x
  if (x.toLowerCase().includes(y.toLowerCase())) return x
  if (y.toLowerCase().includes(x.toLowerCase())) return y
  return `${x} · ${y}`
}

/**
 * Los valores finales para el perfil que se conserva.
 *
 * Incluye los de "solo uno lo tiene" aunque vengan del principal: se escriben
 * igual y así el UPDATE es la foto completa de lo decidido, no un parche.
 */
export function valoresAAplicar(
  c: Clasificacion, r: Resolucion,
  principal: FichaParaFusion, duplicado: FichaParaFusion,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const x of c.soloUno) out[x.campo.key] = x.valor
  for (const x of c.conflictos) {
    const e = r[x.campo.key]
    if (!e) continue
    out[x.campo.key] = e === 'combinado'
      ? combinarTexto(principal[x.campo.key], duplicado[x.campo.key])
      : e === 'principal' ? x.principal : x.duplicado
  }
  return out
}

// ── Cuentas de acceso ───────────────────────────────────────────────────────

export type FichaConCuenta = FichaParaFusion & {
  auth_user_id?: string | null
  email?: string | null
  last_sign_in_at?: string | null
}

export type AvisoDeCuentas = {
  /** Las dos fichas tienen login: una se va a deshabilitar. */
  hayDos: boolean
  /** Correo de la cuenta que se deshabilita. */
  correoQueSeVa: string | null
  /** Último ingreso de cada una, para no dejar afuera a quien sí la usa. */
  ultimoIngresoPrincipal: string | null
  ultimoIngresoDuplicado: string | null
  /** La que se va se usó DESPUÉS que la que queda: casi seguro el principal está mal elegido. */
  laQueSeVaEsLaQueUsan: boolean
}

export function avisoDeCuentas(principal: FichaConCuenta, duplicado: FichaConCuenta): AvisoDeCuentas | null {
  if (!principal.auth_user_id || !duplicado.auth_user_id) return null
  const p = principal.last_sign_in_at ?? null, d = duplicado.last_sign_in_at ?? null
  return {
    hayDos: true,
    correoQueSeVa: duplicado.email ?? null,
    ultimoIngresoPrincipal: p,
    ultimoIngresoDuplicado: d,
    laQueSeVaEsLaQueUsan: !!d && (!p || new Date(d) > new Date(p)),
  }
}

/**
 * El correo del perfil y el del login pueden quedar distintos: si se elige el
 * correo del duplicado pero la cuenta que sobrevive es la del principal, la
 * persona sigue entrando con el correo viejo. No es un error, pero hay que
 * decirlo o el próximo "no puedo entrar" sale de acá.
 */
export function avisoDeCorreoDeLogin(
  principal: FichaConCuenta, duplicado: FichaConCuenta, r: Resolucion,
): { correoDelPerfil: string; correoDelLogin: string } | null {
  if (!principal.auth_user_id) return null
  if (r['email'] !== 'duplicado') return null
  const perfil = String(duplicado.email ?? '').trim()
  const login = String(principal.email ?? '').trim()
  if (!perfil || !login || igual(perfil, login)) return null
  return { correoDelPerfil: perfil, correoDelLogin: login }
}
