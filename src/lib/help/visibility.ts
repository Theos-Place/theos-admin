// Centro de ayuda (/ayuda): qué contenido ve cada persona.
//
// La visibilidad la declara el propio archivo .md en su frontmatter, y esta
// lógica es PURA: la usan el índice (para listar) y el loader (para servir), así
// que no hay forma de ver un documento adivinando la URL — el filtro es el mismo
// en los dos lados.
//
//   visibilidad: publica   → cualquiera, con o sin sesión
//   visibilidad: gestion   → cualquier sesión con al menos un rol de gestión
//   roles: [a, b]          → solo esos roles (admin ve todo igual)

import { hasManagementRole, type RoleId } from '@/lib/auth/roles'
import { parseFrontmatter, type FrontmatterValue } from './frontmatter'

export const HELP_SECTIONS = [
  'Primeros pasos', 'Estudios', 'Eventos', 'Pagos', 'Servidores', 'Comunicaciones', 'Finanzas',
] as const
export type HelpSection = (typeof HELP_SECTIONS)[number]

export const HELP_TYPES = ['infografia', 'tutorial'] as const
export type HelpType = (typeof HELP_TYPES)[number]

export type HelpVisibility = 'publica' | 'gestion' | 'roles'

export type HelpDocMeta = {
  slug: string
  titulo: string
  seccion: HelpSection
  tipo: HelpType
  visibilidad: HelpVisibility
  /** Roles permitidos cuando visibilidad === 'roles'. */
  roles: RoleId[]
  orden: number
  /** Resumen opcional para el índice. */
  resumen: string | null
}

export type HelpDoc = HelpDocMeta & { content: string }

const asString = (v: FrontmatterValue | undefined): string =>
  typeof v === 'string' ? v : v == null ? '' : String(v)

const asList = (v: FrontmatterValue | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? [v.trim()] : []

export function isHelpSection(v: string): v is HelpSection {
  return (HELP_SECTIONS as readonly string[]).includes(v)
}

/** Convierte un archivo .md en documento. `slug` viene del nombre del archivo.
 *  Los valores inválidos caen en el default MÁS RESTRICTIVO: si el frontmatter
 *  no dice explícitamente "publica" o "gestion", el documento es de roles — y
 *  sin roles listados no lo ve nadie salvo admin. Un archivo mal escrito se
 *  esconde; nunca se filtra. */
export function parseHelpDoc(slug: string, file: string): HelpDoc {
  const { data, content } = parseFrontmatter(file)
  const rawVisibility = asString(data.visibilidad).toLowerCase()
  const roles = asList(data.roles) as RoleId[]
  const visibilidad: HelpVisibility =
    rawVisibility === 'publica' ? 'publica'
    : rawVisibility === 'gestion' ? 'gestion'
    : 'roles'
  const seccionRaw = asString(data.seccion)
  const tipoRaw = asString(data.tipo)
  return {
    slug,
    titulo: asString(data.titulo) || slug,
    seccion: isHelpSection(seccionRaw) ? seccionRaw : 'Primeros pasos',
    tipo: (HELP_TYPES as readonly string[]).includes(tipoRaw) ? (tipoRaw as HelpType) : 'tutorial',
    visibilidad,
    roles,
    orden: typeof data.orden === 'number' ? data.orden : 999,
    resumen: asString(data.resumen) || null,
    content,
  }
}

/** ¿Esta persona puede LEER este documento? `roles` null/[] = sin sesión.
 *  Es la única regla: el índice la usa para listar y el loader para servir. */
export function canViewHelpDoc(
  doc: Pick<HelpDocMeta, 'visibilidad' | 'roles'>,
  roles: readonly RoleId[] | null | undefined,
): boolean {
  if (doc.visibilidad === 'publica') return true
  const mine = roles ?? []
  if (mine.length === 0) return false          // sin sesión: solo lo público
  if (mine.includes('admin')) return true      // admin ve todo
  if (doc.visibilidad === 'gestion') return hasManagementRole(mine)
  return doc.roles.some(r => mine.includes(r))
}

/** Documentos visibles, ordenados por `orden` y luego por título. */
export function visibleHelpDocs<T extends Pick<HelpDocMeta, 'visibilidad' | 'roles' | 'orden' | 'titulo'>>(
  docs: readonly T[],
  roles: readonly RoleId[] | null | undefined,
): T[] {
  return docs
    .filter(d => canViewHelpDoc(d, roles))
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'))
}

/** Índice agrupado por sección, en el orden de HELP_SECTIONS y sin secciones vacías. */
export function groupHelpBySection<T extends Pick<HelpDocMeta, 'seccion' | 'orden' | 'titulo'>>(
  docs: readonly T[],
): Array<{ seccion: HelpSection; docs: T[] }> {
  return HELP_SECTIONS
    .map(seccion => ({
      seccion,
      docs: docs
        .filter(d => d.seccion === seccion)
        .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es')),
    }))
    .filter(g => g.docs.length > 0)
}

/** Búsqueda por título (y resumen), sin acentos ni mayúsculas. */
export function searchHelpDocs<T extends Pick<HelpDocMeta, 'titulo' | 'resumen'>>(
  docs: readonly T[],
  query: string,
): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const q = norm(query.trim())
  if (!q) return [...docs]
  return docs.filter(d => norm(d.titulo).includes(q) || norm(d.resumen ?? '').includes(q))
}

/** Anterior y siguiente DENTRO de la misma sección (solo entre lo visible). */
export function helpNeighbors<T extends Pick<HelpDocMeta, 'slug' | 'seccion' | 'orden' | 'titulo'>>(
  docs: readonly T[],
  slug: string,
): { prev: T | null; next: T | null } {
  const current = docs.find(d => d.slug === slug)
  if (!current) return { prev: null, next: null }
  const sameSection = docs
    .filter(d => d.seccion === current.seccion)
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'))
  const i = sameSection.findIndex(d => d.slug === slug)
  return {
    prev: i > 0 ? sameSection[i - 1] : null,
    next: i >= 0 && i < sameSection.length - 1 ? sameSection[i + 1] : null,
  }
}
