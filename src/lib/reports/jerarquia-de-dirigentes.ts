/**
 * DIR-9 · Los números del reporte de dirigentes, con la jerarquía del
 * diagrama de Fabiola.
 *
 * LA REGLA QUE IMPORTA: estos números salen de la MISMA definición que la
 * ficha de cada persona (`lib/leaders/estado-del-dirigente`). Si el reporte
 * dice 40 disponibles y la lista filtrada da 38, es bug — y es el tipo de
 * bug que ya apareció dos veces este mes (REP-15 y REP-16), siempre por lo
 * mismo: dos definiciones del mismo número escritas en dos lugares.
 *
 * Por eso acá no se decide NADA sobre qué es un activo o un disponible: se
 * leen los campos que la ficha guarda y se cuentan.
 *
 * Módulo PURO.
 */
import {
  RAZONES_INACTIVO, RAZONES_NO_DISPONIBLE, RAZONES_DE_REVISION,
  ETIQUETA_RAZON_INACTIVO, ETIQUETA_NO_DISPONIBLE, ETIQUETA_REVISION,
  type RazonInactivo, type RazonNoDisponible, type RazonDeRevision,
} from '@/lib/leaders/estado-del-dirigente'
import { razonesVisibles } from '@/lib/leaders/revision-por-compromiso'
import { disponibilidadEfectiva } from '@/lib/leaders/esta-dirigiendo'

/** Una fila de `study_leaders`, con lo que el reporte necesita. */
export type DirigenteParaReporte = {
  member_id: string
  nombre: string
  estado_base: string | null
  disponibilidad: string | null
  razon_no_disponible: string | null
  razon_inactivo: string | null
  /** Las razones MANUALES. */
  revision: readonly string[] | null
  /** DIR-14 · La automática por compromiso: qué le falta. Vacía = no la tiene. */
  revision_auto_faltan?: readonly string[] | null
  /**
   * ¿Tiene un grupo en curso que la ocupe? NO se lee de `study_leaders`
   * —ahí no existe— sino de los grupos. Ver `esta-dirigiendo.ts`: 116 de
   * las 109 personas con grupo figuraban «disponible» en su ficha.
   */
  dirigiendo: boolean
}

/** Un número del reporte: cuánto, qué porcentaje y QUIÉNES. */
export type Celda = {
  clave: string
  etiqueta: string
  total: number
  /** Sobre el total de dirigentes. Redondeado a entero. */
  pct: number
  /** Para el drill-down: el reporte lista a estas personas al hacer clic. */
  miembros: string[]
}

export type JerarquiaDeDirigentes = {
  total: number
  inactivos: Celda
  /** Desglose de los inactivos. Suman `inactivos`, salvo los sin razón. */
  porRazonInactivo: Celda[]
  /** Los que están inactivos y nadie dijo por qué: los 294 de la conversión. */
  inactivosSinRazon: Celda
  activos: Celda
  disponibles: Celda
  noDisponibles: Celda
  /** Las cinco razones. Suman `noDisponibles`. */
  porRazonNoDisponible: Celda[]
  /** Solo para quien puede ver banderitas; vacío para el resto. */
  enRevision: Celda | null
  /** DIR-14 · De esas, cuántas puso el cron y cuántas alguien a mano. Se pisan:
   *  una persona puede tener las dos, así que no suman `enRevision`. */
  revisionAutomaticas: Celda | null
  revisionManuales: Celda | null
  porRazonDeRevision: Celda[]
  /**
   * Los que pasaron a «dirigiendo» por derivación y no porque alguien lo
   * escribiera. Se expone para que la pantalla pueda explicar de dónde
   * salió el número en vez de que alguien lo crea un error.
   */
  derivadosADirigiendo: Celda
  /**
   * INCONSISTENCIA: inactivos que igual tienen un grupo en curso. EST-1
   * dice que no debería pasar. Se muestra en vez de esconderse, porque es
   * trabajo pendiente de alguien, no ruido.
   */
  inactivosConGrupo: Celda
}

function celda(
  clave: string, etiqueta: string, filas: readonly DirigenteParaReporte[], total: number,
): Celda {
  return {
    clave,
    etiqueta,
    total: filas.length,
    // Sobre el TOTAL de dirigentes y no sobre su rama: así los porcentajes
    // de distintas ramas se pueden comparar entre sí, que es para lo que
    // se miran.
    pct: total === 0 ? 0 : Math.round((filas.length / total) * 100),
    miembros: filas.map(f => f.member_id),
  }
}

export function jerarquiaDeDirigentes(
  filas: readonly DirigenteParaReporte[],
  opts: { verBanderitas: boolean },
): JerarquiaDeDirigentes {
  const total = filas.length

  // El estado EFECTIVO antes de contar nada. Si acá se leyera
  // `f.disponibilidad` a secas, el reporte diría «disponible» de quien ya
  // tiene un grupo — que era justo el bug que DIR-9 destapó.
  const conEfectiva = filas.map(f => ({
    fila: f,
    efectiva: disponibilidadEfectiva({ estado: f, dirigiendo: f.dirigiendo }),
  }))
  const soloFilas = (xs: typeof conEfectiva) => xs.map(x => x.fila)

  const inactivos = filas.filter(f => f.estado_base === 'inactivo')
  const activos = filas.filter(f => f.estado_base === 'activo')
  const disponibles = soloFilas(conEfectiva.filter(x => x.efectiva.disponibilidad === 'disponible'))
  const noDisponibles = soloFilas(conEfectiva.filter(x => x.efectiva.disponibilidad === 'no_disponible'))
  // DIR-14 · Lo que se cuenta es lo VISIBLE: las manuales más la automática.
  const visibles = (f: DirigenteParaReporte) => razonesVisibles(f.revision, f.revision_auto_faltan)
  const conRevision = filas.filter(f => visibles(f).length > 0)

  return {
    total,
    inactivos: celda('inactivos', 'Inactivos', inactivos, total),
    porRazonInactivo: RAZONES_INACTIVO.map(r => celda(
      `inactivo:${r}`, ETIQUETA_RAZON_INACTIVO[r as RazonInactivo],
      inactivos.filter(f => f.razon_inactivo === r), total,
    )),
    // Se muestran aparte y no se esconden: son 294 fichas a las que nadie
    // les puso razón nunca, y esconderlas haría que el desglose no sume.
    inactivosSinRazon: celda(
      'inactivo:sin_razon', 'Sin razón registrada',
      inactivos.filter(f => !f.razon_inactivo), total,
    ),
    activos: celda('activos', 'Activos', activos, total),
    disponibles: celda('disponibles', 'Disponibles', disponibles, total),
    noDisponibles: celda('no_disponibles', 'No disponibles', noDisponibles, total),
    // La razón también sale de la efectiva: «dirigiendo» no está guardada
    // en ninguna fila, así que filtrar por `razon_no_disponible` daría cero.
    porRazonNoDisponible: RAZONES_NO_DISPONIBLE.map(r => celda(
      `no_disponible:${r}`, ETIQUETA_NO_DISPONIBLE[r as RazonNoDisponible],
      soloFilas(conEfectiva.filter(x => x.efectiva.razonNoDisponible === r)), total,
    )),
    // La banderita dice que hay una situación abierta con una persona. Quien
    // no puede verla recibe `null`, no un cero: un cero afirmaría que no hay
    // ninguna, y eso no es lo mismo que «no te toca verlo».
    enRevision: opts.verBanderitas
      ? celda('en_revision', 'Con banderita de revisión', conRevision, total)
      : null,
    porRazonDeRevision: opts.verBanderitas
      ? RAZONES_DE_REVISION.map(r => celda(
        `revision:${r}`, ETIQUETA_REVISION[r as RazonDeRevision],
        filas.filter(f => visibles(f).includes(r)), total,
      ))
      : [],
    revisionAutomaticas: opts.verBanderitas
      ? celda('revision:automaticas', 'Automáticas', filas.filter(f => (f.revision_auto_faltan ?? []).length > 0), total)
      : null,
    revisionManuales: opts.verBanderitas
      ? celda('revision:manuales', 'Manuales', filas.filter(f => (f.revision ?? []).length > 0), total)
      : null,
    derivadosADirigiendo: celda(
      'derivados:dirigiendo', 'Derivados de su grupo activo',
      soloFilas(conEfectiva.filter(x => x.efectiva.derivada)), total,
    ),
    inactivosConGrupo: celda(
      'inconsistencia:inactivo_con_grupo', 'Inactivos que igual tienen grupo',
      inactivos.filter(f => f.dirigiendo), total,
    ),
  }
}

/**
 * Lo que la pantalla tiene que decir sobre los porcentajes de la banderita.
 *
 * Una persona puede tener varias razones a la vez, así que el desglose suma
 * MÁS que el total de personas con banderita. Sin avisarlo, alguien suma la
 * columna y concluye que hay más gente en revisión de la que hay.
 */
export const NOTA_BANDERITA =
  'Una persona puede tener varias razones a la vez, así que el desglose suma '
  + 'más que el total. La banderita convive con cualquier estado: un dirigente '
  + 'en revisión puede estar perfectamente disponible.'
