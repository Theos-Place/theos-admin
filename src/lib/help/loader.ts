import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RoleId } from '@/lib/auth/roles'
import {
  parseHelpDoc, canViewHelpDoc, visibleHelpDocs,
  type HelpDoc, type HelpDocMeta,
} from './visibility'

// Lee el contenido de /ayuda desde content/ayuda/*.md. Sin tabla en la BD: se
// edita con un commit.
//
// SEGURIDAD: getHelpDoc() aplica canViewHelpDoc ANTES de devolver el contenido.
// Esconder un documento del índice no alcanza — quien adivine la URL recibe null
// (la página responde 404) si su rol no está en el frontmatter.

const CONTENT_DIR = join(process.cwd(), 'content', 'ayuda')

/** Cache en memoria por proceso: el contenido solo cambia con un deploy. En dev
 *  se relee siempre, para ver los cambios al guardar. */
let cache: HelpDoc[] | null = null

function slugFromFilename(name: string): string {
  return name.replace(/\.md$/i, '')
}

/** Un slug de URL válido: minúsculas, números y guiones. Corta cualquier intento
 *  de path traversal (../) antes de tocar el disco. */
export function isValidHelpSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

async function loadAll(): Promise<HelpDoc[]> {
  if (cache && process.env.NODE_ENV === 'production') return cache
  let files: string[] = []
  try {
    files = (await readdir(CONTENT_DIR)).filter(f => f.toLowerCase().endsWith('.md'))
  } catch {
    return []   // sin carpeta de contenido: el centro de ayuda queda vacío
  }
  const docs = await Promise.all(files.map(async file => {
    const raw = await readFile(join(CONTENT_DIR, file), 'utf8')
    return parseHelpDoc(slugFromFilename(file), raw)
  }))
  cache = docs
  return docs
}

/** Índice (sin el cuerpo) YA filtrado por lo que puede ver quien pregunta.
 *  `roles` null o [] = petición sin sesión. */
export async function getHelpIndex(roles: readonly RoleId[] | null): Promise<HelpDocMeta[]> {
  const docs = await loadAll()
  // Se descarta el cuerpo a propósito: el índice no necesita el contenido y así
  // no viaja al cliente lo que la persona no va a abrir.
  return visibleHelpDocs(docs, roles).map(({ slug, titulo, seccion, tipo, visibilidad, roles: docRoles, orden, resumen }) => ({
    slug, titulo, seccion, tipo, visibilidad, roles: docRoles, orden, resumen,
  }))
}

/** Un documento COMPLETO, o null si no existe o si quien pregunta no puede verlo.
 *  El caller responde 404 en ambos casos: no se distingue "no existe" de "no te
 *  toca", para no confirmar la existencia de contenido interno. */
export async function getHelpDoc(
  slug: string,
  roles: readonly RoleId[] | null,
): Promise<HelpDoc | null> {
  if (!isValidHelpSlug(slug)) return null
  const docs = await loadAll()
  const doc = docs.find(d => d.slug === slug)
  if (!doc) return null
  if (!canViewHelpDoc(doc, roles)) return null
  return doc
}

/** Solo para tests: olvida el cache. */
export function __clearHelpCache() {
  cache = null
}
