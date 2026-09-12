/**
 * La CUARTA etapa de /servidores/admin: quién ocupa el puesto seleccionado.
 *
 * La navegación es área → comité → puesto → miembros, y hasta ahora moría en el
 * puesto: se veía cuántos puestos tiene un comité pero no a quién le tocaba
 * cada uno, que es lo que uno va a buscar.
 *
 * Módulo puro. La lista que se ve y la que se exporta salen de la MISMA
 * función, por el antecedente de committee-filter: cuando eran dos expresiones
 * distintas la tabla mostraba 67 y el archivo bajaba 84.
 */
import { calcularAntiguedad, type FlatServer } from './columns'
import type { CommitteeData, CommitteeServer } from '@/types/server'

export type MiembroDelPuesto = CommitteeServer & { antiguedad: string }

/**
 * Los miembros de un puesto, ordenados: primero los activos, después por nombre.
 *
 * `incluirInactivos` es el toggle de la pantalla. Por defecto NO van: quien
 * abre un puesto quiere ver el equipo de hoy, y mezclar a quien ya salió hace
 * que el conteo del encabezado no cuadre con lo que se lee debajo.
 */
export function miembrosDelPuesto(
  comite: Pick<CommitteeData, 'members'> | null | undefined,
  positionId: string | null | undefined,
  opciones: { incluirInactivos?: boolean } = {},
): MiembroDelPuesto[] {
  if (!comite || !positionId) return []
  const activosPrimero = (a: CommitteeServer, b: CommitteeServer) =>
    (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1)
    || a.name.localeCompare(b.name, 'es')
  return comite.members
    .filter(m => m.position_id === positionId)
    .filter(m => opciones.incluirInactivos || m.status === 'active')
    .sort(activosPrimero)
    .map(m => ({ ...m, antiguedad: calcularAntiguedad(m.start_date) }))
}

/** Cuántos hay, mirando SIEMPRE la lista completa: el conteo del encabezado no
 *  puede depender del toggle, o "12 activos" cambiaría al mostrar inactivos. */
export function conteoDelPuesto(
  comite: Pick<CommitteeData, 'members'> | null | undefined,
  positionId: string | null | undefined,
): { activos: number; inactivos: number } {
  const todos = miembrosDelPuesto(comite, positionId, { incluirInactivos: true })
  const activos = todos.filter(m => m.status === 'active').length
  return { activos, inactivos: todos.length - activos }
}

/** "Colaborador Comida — 12 activos". Sin gente lo dice, no muestra un cero. */
export function tituloDelPuesto(titulo: string, c: { activos: number; inactivos: number }): string {
  if (c.activos === 0 && c.inactivos === 0) return `${titulo} — sin nadie asignado`
  if (c.activos === 0) return `${titulo} — sin nadie activo`
  return `${titulo} — ${c.activos} activo${c.activos === 1 ? '' : 's'}`
}

/** Fila del export. Mismas columnas que el resto de servidores (SERVER_COLUMNS),
 *  para que el archivo de esta pantalla se lea igual que el del listado. */
export function filasParaExport(
  miembros: readonly MiembroDelPuesto[],
  ctx: { comite: string; area: string; lider: string },
): FlatServer[] {
  return miembros.map(m => ({
    member_id: m.member_id,
    name: m.name,
    initials: m.initials,
    position: m.position,
    start_date: m.start_date,
    status: m.status === 'active' ? 'active' : 'inactive',
    committee: ctx.comite,
    area: ctx.area,
    leader_name: ctx.lider,
    email: m.email ?? null,
    phone: m.phone ?? null,
    birth_date: m.birth_date ?? null,
  }))
}

/** Nombre del archivo. Sin tildes ni espacios: viaja por Content-Disposition y
 *  por el sistema de archivos de quien lo baja. */
export function nombreDeArchivo(...partes: Array<string | null | undefined>): string {
  return partes
    .filter(Boolean)
    .map(p => String(p).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase())
    .filter(Boolean)
    .join('-') || 'servidores'
}
