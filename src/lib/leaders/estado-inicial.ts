/**
 * DIR-8 · De lo que viene de la base a lo que la ficha necesita.
 *
 * Existe para que la pantalla no tenga que escribir trece `?? null` en medio
 * del JSX —donde un typo no lo nota nadie— y para que el caso «todavía no
 * tiene estado nuevo» tenga UNA respuesta y no una por pantalla.
 *
 * Los 294 inactivos de la conversión llegan sin razón: eso es correcto y la
 * ficha debe mostrarlo así, con el aviso de que falta elegirla, en vez de
 * inventar una.
 *
 * Módulo PURO.
 */
import type { EstadoAdministrativoDelDirigente } from '@/lib/dirigentes'
import type {
  EstadoBase, RazonInactivo, DetalleNoEjerce, SituacionCdeb,
  Disponibilidad, RazonNoDisponible, RazonDeRevision,
} from './estado-del-dirigente'

export type EstadoInicial = {
  base: EstadoBase
  razonInactivo: RazonInactivo | null
  detalleNoEjerce: DetalleNoEjerce | null
  situacionCdeb: SituacionCdeb | null
  disponibilidad: Disponibilidad | null
  razonNoDisponible: RazonNoDisponible | null
  pausaHasta: string | null
  revision: RazonDeRevision[]
  notaRevision: string
  notaCdeb: string
  notaDecisionPropia: string
  notaPausa: string
  notaGeneral: string
}

export function estadoInicialDesde(
  e: EstadoAdministrativoDelDirigente | null | undefined,
): EstadoInicial {
  // Sin estado guardado se asume ACTIVO Y DISPONIBLE, que es lo que la ficha
  // ya mostraba antes de DIR-8. Asumir inactivo escondería dirigentes que sí
  // están dando, y ese error se descubre tarde y mal.
  if (!e) {
    return {
      base: 'activo', razonInactivo: null, detalleNoEjerce: null, situacionCdeb: null,
      disponibilidad: 'disponible', razonNoDisponible: null, pausaHasta: null, revision: [],
      notaRevision: '', notaCdeb: '', notaDecisionPropia: '', notaPausa: '', notaGeneral: '',
    }
  }
  return {
    base: e.estado_base,
    razonInactivo: (e.razon_inactivo ?? null) as RazonInactivo | null,
    detalleNoEjerce: (e.detalle_no_ejerce ?? null) as DetalleNoEjerce | null,
    situacionCdeb: (e.situacion_cdeb ?? null) as SituacionCdeb | null,
    disponibilidad: (e.disponibilidad ?? null) as Disponibilidad | null,
    razonNoDisponible: (e.razon_no_disponible ?? null) as RazonNoDisponible | null,
    pausaHasta: e.pausa_hasta ?? null,
    revision: (e.revision ?? []) as RazonDeRevision[],
    // Las notas llegan ausentes —no vacías— cuando quien mira no puede
    // leerlas. El string vacío es lo que el formulario necesita.
    notaRevision: e.nota_revision ?? '',
    notaCdeb: e.nota_cdeb ?? '',
    notaDecisionPropia: e.nota_decision_propia ?? '',
    notaPausa: e.nota_pausa ?? '',
    notaGeneral: e.nota_general ?? '',
  }
}

/**
 * Arma el estado administrativo desde la fila cruda del API, o null si no
 * vino ninguno.
 *
 * Las llaves de notas y banderita se copian SOLO si existen: el servidor las
 * quita a quien no puede verlas, y rellenarlas con vacío acá borraría esa
 * distinción justo antes de pintarla.
 */
export function estadoAdminDe(
  fila: Record<string, unknown>,
): EstadoAdministrativoDelDirigente | null {
  const base = fila.estado_base
  if (base !== 'activo' && base !== 'inactivo') return null
  const s = (k: string) => (typeof fila[k] === 'string' ? (fila[k] as string) : null)
  const out: EstadoAdministrativoDelDirigente = {
    estado_base: base,
    razon_inactivo: s('razon_inactivo'),
    detalle_no_ejerce: s('detalle_no_ejerce'),
    situacion_cdeb: s('situacion_cdeb'),
    disponibilidad: s('disponibilidad'),
    razon_no_disponible: s('razon_no_disponible'),
    pausa_hasta: s('pausa_hasta'),
    revision: Array.isArray(fila.revision) ? (fila.revision as string[]) : [],
    en_grupo_whatsapp: fila.en_grupo_whatsapp === true,
  }
  for (const k of ['nota_revision', 'nota_cdeb', 'nota_decision_propia', 'nota_pausa', 'nota_general'] as const) {
    if (k in fila) out[k] = s(k)
  }
  return out
}
