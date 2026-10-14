/**
 * DIR-13 · Las reglas del import del CSV de Fabiola (2026-10-13).
 *
 * El CSV es manual y puede traer errores: por eso TODO pasa por dry-run y
 * por eso las reglas viven acá, donde se pueden probar sin tocar la base.
 *
 * LA REGLA QUE ORDENA TODO: EL SISTEMA GANA SOBRE EL CSV EN LO AUTOMÁTICO.
 * El CSV es una foto de un momento y el sistema sabe cosas que la foto no
 * —quién tiene un grupo abierto ahora mismo—. Dos consecuencias:
 *
 *   · CSV «Inactivo» + el sistema lo tiene activo o dirigiendo → NO SE
 *     DESACTIVA A NADIE. Se reporta: es el CSV desactualizado.
 *   · CSV «En Curso» sin grupo en el sistema → tampoco se cree. «En curso»
 *     es un hecho observable, no una opinión: si no hay grupo, no está en
 *     curso (precisión de Floriana, 2026-10-13).
 *
 * Módulo PURO.
 */
import type { RazonInactivo, RazonNoDisponible, RazonDeRevision } from './estado-del-dirigente'

/** Una fila del CSV, ya con los campos que importan. */
export type FilaDelCsv = {
  individualId: string | null
  nombre: string
  status: string
  disponibilidad: string
  enGrupoWhatsapp: boolean
}

/** Lo que el SISTEMA sabe de esa persona. */
export type LoQueSabeElSistema = {
  /** ¿Tiene un grupo en curso, en matrícula o por empezar? Derivado. */
  dirigiendo: boolean
  /** Su estado base de hoy, si ya tiene ficha. */
  estadoBase: 'activo' | 'inactivo' | null
}

export type Decision =
  | { tipo: 'aplicar'; cambios: CambiosDeEstado; nota?: string }
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'revisar'; motivo: string }

export type CambiosDeEstado = {
  estado_base: 'activo' | 'inactivo'
  razon_inactivo: RazonInactivo | null
  razon_no_disponible: RazonNoDisponible | null
  disponibilidad: 'disponible' | 'no_disponible' | null
  revision: RazonDeRevision[]
  /** Pausa SIN fecha: Fabiola la completa después. */
  pausa_por_completar?: boolean
}

const norm = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Qué hacer con una fila.
 *
 * El orden de las ramas NO es casual: primero lo que se descarta, después
 * lo que el sistema contradice, y al final lo que se aplica. Al revés, una
 * contradicción se colaría como un cambio válido.
 */
export function decidir(fila: FilaDelCsv, sistema: LoQueSabeElSistema): Decision {
  const status = norm(fila.status)
  const disp = norm(fila.disponibilidad)

  // 1 · Sin status no hay nada que importar.
  if (!status) return { tipo: 'revisar', motivo: 'La fila no trae estado.' }

  // 2 · CONTRADICCIONES: se ignoran (decisión de Floriana, 2026-10-13).
  //     «Inactivo + Disponible» no es un estado: es un error de captura, y
  //     adivinar cuál de los dos vale sería inventar.
  if (status === 'inactivo' && disp === 'disponible') {
    return { tipo: 'ignorar', motivo: 'Contradicción en el CSV: inactivo y disponible a la vez.' }
  }

  // 3 · EL SISTEMA GANA: no se desactiva a quien está activo o dirigiendo.
  if (status === 'inactivo' && (sistema.dirigiendo || sistema.estadoBase === 'activo')) {
    return {
      tipo: 'ignorar',
      motivo: sistema.dirigiendo
        ? 'El CSV lo da de baja pero tiene un grupo abierto.'
        : 'El CSV lo da de baja pero el sistema lo tiene activo.',
    }
  }

  // 4 · INACTIVO limpio. El CSV no trae la sub-razón, así que queda por
  //     clasificar en vez de inventarle una.
  if (status === 'inactivo') {
    return {
      tipo: 'aplicar',
      cambios: {
        estado_base: 'inactivo', razon_inactivo: null,
        disponibilidad: null, razon_no_disponible: null, revision: [],
      },
      nota: 'Inactivo por el CSV de Fabiola; falta clasificar la razón.',
    }
  }

  // 5 · EN REVISIÓN: es una BANDERITA, no un estado. El estado de abajo
  //     sale de su columna de disponibilidad.
  if (status === 'en revision') {
    const base = disponibilidadDeCsv(disp)
    return {
      tipo: 'aplicar',
      cambios: { ...base, revision: ['no_confirmo_datos'] },
      nota: 'Banderita puesta por el CSV; falta precisar el motivo.',
    }
  }

  // 6 · PASANTÍA.
  if (status === 'pasantia') {
    return {
      tipo: 'aplicar',
      cambios: {
        estado_base: 'activo', razon_inactivo: null,
        disponibilidad: 'no_disponible', razon_no_disponible: 'pasantia', revision: [],
      },
    }
  }

  // 7 · ACTIVO.
  if (status === 'activo') {
    return { tipo: 'aplicar', cambios: { ...disponibilidadDeCsv(disp), revision: [] } }
  }

  return { tipo: 'revisar', motivo: `Estado desconocido en el CSV: «${fila.status}».` }
}

/**
 * La disponibilidad de un ACTIVO, según lo que dice el CSV y lo que sabe el
 * sistema.
 */
function disponibilidadDeCsv(disp: string): Omit<CambiosDeEstado, 'revision'> {
  const activo = { estado_base: 'activo' as const, razon_inactivo: null }

  /**
   * «En curso» NO SE ESCRIBE, ni cuando el CSV lo dice.
   *
   * Es un hecho observable, y el sistema ya lo deriva de los grupos
   * (`esta-dirigiendo.ts`). Se guarda `disponible` en los DOS casos, por
   * razones distintas:
   *   · Con grupo → la derivación lo mostrará como «dirigiendo un estudio»
   *     sola. Escribirlo acá sería el mismo dato en dos lugares, que es la
   *     forma de bug más repetida de este repo.
   *   · Sin grupo → el CSV está viejo (precisión de Floriana): «en curso»
   *     solo vale si hay un estudio en matrícula, en curso o por empezar.
   *     Sin grupo, lo que de verdad está es DISPONIBLE.
   *
   * Por eso esta función NO necesita saber si tiene grupo: el resultado es
   * el mismo en los dos casos. `dirigiendo` se usa más arriba, donde sí
   * cambia la decisión (no desactivar a quien está dando).
   */
  if (disp === 'en curso' || disp === 'codirigente en curso') {
    return { ...activo, disponibilidad: 'disponible', razon_no_disponible: null }
  }

  if (disp === 'descanso') {
    // Pausa SIN fecha: el CSV no la trae y la pausa la exige. Queda marcada
    // para que Fabiola complete fecha y motivo.
    return {
      ...activo, disponibilidad: 'no_disponible', razon_no_disponible: 'pausa',
      pausa_por_completar: true,
    }
  }

  if (disp === 'en capacitacion') {
    return { ...activo, disponibilidad: 'no_disponible', razon_no_disponible: 'estudiante_capacitacion' }
  }

  // Disponible, o vacío: disponible.
  return { ...activo, disponibilidad: 'disponible', razon_no_disponible: null }
}

/** VERDADERO/FALSO del CSV. Cualquier otra cosa es `false`. */
export function siONo(valor: string | null | undefined): boolean {
  return norm(valor ?? '') === 'verdadero'
}
