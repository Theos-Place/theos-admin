/**
 * REP-11 · QUIÉN ABRE CADA REPORTE. Una tabla, un solo lugar.
 *
 * Antes la respuesta estaba repartida en tres sitios que se contradecían: el
 * índice de /reportes filtraba las tarjetas con una lista de roles escrita
 * ahí mismo, cada pantalla repetía su propio `puedeVer`, y ocho de los diez
 * endpoints se conformaban con el módulo `reportes` a secas. Agregar un acceso
 * significaba acordarse de los tres.
 *
 * Ahora agregar el próximo es una línea de `ACCESO_POR_REPORTE`.
 *
 * TRES LLAVES, y ninguna reemplaza a las otras:
 *
 *  1. `roles` — quien tenga uno de esos roles entra, tenga o no el módulo.
 *  2. `moduloAlcanza` — si es `true`, el módulo `reportes` basta. Los reportes
 *     acotados lo ponen en `false`: ahí el módulo NO alcanza y manda la lista.
 *     OJO: el ROL `reportes` es otra cosa y abre los nueve (REP-19); esto es
 *     el módulo que otros roles traen de paso.
 *  3. `porPuesto` — lo abre un PUESTO de sede (anfitrión, encargado de
 *     logística), sin ningún rol de por medio. Ver
 *     `puestos-que-abren-reportes.ts`.
 *
 * Módulo PURO: la sesión y los puestos los resuelve el llamador.
 */
import type { RoleId } from '@/types/auth'
import { ESTUDIOS_REPORTE_ROLES, SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'

export type SlugDeReporte =
  | 'asistencia' | 'personas-nuevas' | 'discipulos' | 'retencion'
  | 'estudios' | 'dirigentes' | 'servidores'
  | 'exalumnos-perdidos' | 'recurrentes-perdidos'

export type ReglaDeAcceso = {
  /** Roles que lo abren por sí solos. */
  roles: readonly RoleId[]
  /** ¿El módulo `reportes` basta para abrirlo? */
  moduloAlcanza: boolean
  /** ¿Lo abre un puesto de sede (anfitrión / encargado de logística)? */
  porPuesto: boolean
  /**
   * DIR-7 · ¿Lo abre SER DIRIGENTE, acotado a lo propio?
   *
   * Es una llave aparte de `roles` porque no es lo mismo: un rol abre el
   * reporte ENTERO, y esto abre solo la parte de quien pregunta. Mezclarlas
   * habría hecho que un dirigente viera la lista de todos los dirigentes,
   * que es exactamente lo que el recorte evita.
   */
  porSerDirigente?: boolean
}

export const ACCESO_POR_REPORTE: Record<SlugDeReporte, ReglaDeAcceso> = {
  /**
   * Crecimiento y Asistencia, y Personas Nuevas: los dos que el anfitrión y el
   * encargado de logística necesitan para su sede (decisión 2026-09-30). Son
   * los únicos con `porPuesto`.
   *
   * OJO: dentro de estos dos hay datos que siguen cerrados por su cuenta y
   * NO se abren acá — el teléfono en Personas Nuevas y la lista nominal de la
   * semana exigen el módulo `miembros` con alcance total, y su endpoint lo
   * comprueba aparte. Abrir el reporte no es abrir el padrón.
   */
  asistencia: { roles: [], moduloAlcanza: true, porPuesto: true },
  'personas-nuevas': { roles: [], moduloAlcanza: true, porPuesto: true },

  /**
   * Discípulos y Retención: el módulo, como siempre.
   *
   * Los 21 anfitriones los ven HOY y los van a perder, y es a propósito
   * (confirmado por Floriana 2026-09-30): nunca se los dieron: les cayeron de
   * arrastre cuando PAR-3 les puso el rol `reportes` entero por tener el
   * puesto. Eso es justo lo que REP-11 deshace.
   */
  discipulos: { roles: [], moduloAlcanza: true, porPuesto: false },
  retencion: { roles: [], moduloAlcanza: true, porPuesto: false },

  /**
   * Estudios y Dirigentes: ACOTADOS. El módulo `reportes` no alcanza.
   *
   * Estudios ya estaba así desde REP-9. Dirigentes se acota igual el
   * 2026-09-30, y no es gratis: además de los 21 anfitriones lo pierden cinco
   * personas que hoy lo ven —Comunicación Theos Place, Encargada de RH,
   * Finanzas Theos Place, Lucía Porras y Roberto Acosta—. Medido y confirmado
   * antes de aplicar.
   *
   * `ESTUDIOS_REPORTE_ROLES` ya incluye dirección y admin, así que ponerlos
   * de nuevo sería repetir la lista en dos lugares.
   */
  estudios: { roles: ESTUDIOS_REPORTE_ROLES, moduloAlcanza: false, porPuesto: false },
  /**
   * DIR-9 · `lector_dirigentes` se agrega a los de estudios y NO se reemplaza.
   *
   * El rediseño del reporte se pidió para la coordinación de dirigentes Y
   * para quienes solo leen (Luis y Yeya): ellos ven la ficha de un dirigente,
   * así que negarles el agregado de esas mismas fichas no protegería nada.
   *
   * Lo que sí sigue acotado es la BANDERITA: el conteo viaja solo para quien
   * puede leer notas (`puedeVerBanderita`), y para el resto va `null` en vez
   * de cero. Un cero afirmaría que no hay ninguna.
   */
  dirigentes: {
    roles: [...ESTUDIOS_REPORTE_ROLES, 'lector_dirigentes'],
    moduloAlcanza: false, porPuesto: false,
  },

  /** Servidores y compromisos: la vista de dirección sobre la organización
   *  (REP-7). Acotado desde que se creó. */
  servidores: { roles: SERVICE_ADMIN_ROLES, moduloAlcanza: false, porPuesto: false },

  /**
   * DIR-7 · «Los que no volvieron», de cada dirigente.
   *
   * DOS PUERTAS, y la diferencia importa. El DIRIGENTE entra por ser
   * dirigente y ve SOLO a sus exalumnos — el recorte lo hace el servidor con
   * su propio id, no un parámetro del request. Los roles de estudios entran
   * por rol y pueden ELEGIR un dirigente con el selector, igual que SRV-6.
   *
   * El módulo `reportes` a secas NO alcanza: la lista trae teléfonos de
   * gente que dejó de venir, para escribirles. Eso no es una métrica.
   */
  'exalumnos-perdidos': {
    roles: ESTUDIOS_REPORTE_ROLES, moduloAlcanza: false, porPuesto: false,
    porSerDirigente: true,
  },

  /**
   * REP-14 · Los recurrentes que ya no van.
   *
   * Acotado como Estudios: son 644 personas con teléfono y correo (medido en
   * producción el 2026-10-05). No lleva `porSerDirigente` — no es de nadie en
   * particular, es la foto de la organización.
   */
  'recurrentes-perdidos': {
    roles: ESTUDIOS_REPORTE_ROLES, moduloAlcanza: false, porPuesto: false,
  },
}

export type QuienPregunta = {
  roles: readonly string[] | null | undefined
  /** ¿Tiene el módulo `reportes`? Lo resuelve `hasModulePermission`. */
  tieneModulo: boolean
  /**
   * ¿Algún puesto suyo abre los reportes de sede? Lo calcula el SERVIDOR
   * mirando los puestos; el navegador no los tiene. `false` por omisión, que
   * es el lado seguro.
   */
  porPuesto?: boolean
  /** REP-18 · Ocupa un puesto de dirección (`esPuestoDeDireccion`): ve todos. */
  direccionPorPuesto?: boolean
  /**
   * DIR-7 · ¿Dirige o dirigió algún grupo? Lo resuelve el servidor. `false`
   * por omisión, que es el lado seguro.
   */
  esDirigente?: boolean
}

/**
 * REP-19 · El ROL `reportes` abre los nueve (decisión de Floriana, 2026-10-21:
 * «ya existe un acceso tipo reportes que debería de poder ver todos»).
 *
 * Es el rol, no el módulo: el módulo `reportes` lo traen también otros roles
 * de paso (comunicaciones, coordinaciones) y para esos sigue valiendo
 * `moduloAlcanza`, con los reportes acotados cerrados. Quien recibe el rol
 * `reportes` a mano lo recibe para mirar números, y la restricción de
 * REP-11 lo dejaba viendo cuatro de nueve: el caso fue la cuenta de
 * Finanzas, que no veía Servidores.
 */
export const ROL_QUE_ABRE_TODOS = 'reportes' as const

export function puedeVerReporte(slug: SlugDeReporte, quien: QuienPregunta): boolean {
  const regla = ACCESO_POR_REPORTE[slug]
  if (!regla) return false
  // REP-18 · Un puesto de dirección abre TODOS (ver puesto-de-direccion.ts).
  if (quien.direccionPorPuesto === true) return true
  const roles = quien.roles ?? []
  // REP-19 · El rol `reportes` abre TODOS.
  if ((roles as readonly string[]).includes(ROL_QUE_ABRE_TODOS)) return true
  if (regla.roles.some(r => (roles as readonly string[]).includes(r))) return true
  if (regla.moduloAlcanza && quien.tieneModulo) return true
  if (regla.porSerDirigente && quien.esDirigente === true) return true
  return regla.porPuesto && quien.porPuesto === true
}

/** Los reportes que esta persona puede abrir. Lo usa el índice para no pintar
 *  una tarjeta que lleva a un "Acceso restringido". */
export function reportesVisibles(quien: QuienPregunta): SlugDeReporte[] {
  return (Object.keys(ACCESO_POR_REPORTE) as SlugDeReporte[])
    .filter(slug => puedeVerReporte(slug, quien))
}
