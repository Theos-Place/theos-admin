/**
 * REC-1 · Las reglas del centro de recursos, en un solo lugar y PURAS.
 *
 * Quién VE un recurso lo decide su audiencia (`Restriccion`, el sistema de
 * GRU-2/FRM-5 más la condición de rol). Este módulo no evalúa la audiencia
 * contra la base —eso es `memberPassesRestriction`— sino lo que la rodea: qué
 * condiciones se aceptan, cuándo un recurso está publicado y qué hace falta
 * para gestionarlos.
 */
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'
import {
  normalizeRestriction, hasRestriction, TIPOS_DE_AUDIENCIA_DE_RECURSOS, type Restriccion,
} from '@/lib/audiencia/restriccion'
import type { TipoDeArchivo } from '@/lib/archivos/tipo-por-contenido'

/** El bucket privado. Jamás público: todo pasa por URL firmada. */
export const BUCKET_DE_RECURSOS = 'resources'

/** Lo que se acepta subir. Sin video: si algún día hay, va a Microsoft Stream. */
export const TIPOS_DE_ARCHIVO: readonly TipoDeArchivo[] = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

/** 15 MB: un manual escaneado cabe; un video no. El bucket tiene el mismo tope. */
export const TAMANO_MAXIMO = 15 * 1024 * 1024

/** Cuánto vale la URL firmada. Corta: se pide al abrir, no se guarda. */
export const SEGUNDOS_DE_LA_URL = 300

/** La audiencia saneada, con el rol incluido. null = sin publicar. */
export function audienciaDeRecurso(raw: unknown): Restriccion | null {
  return normalizeRestriction(raw, TIPOS_DE_AUDIENCIA_DE_RECURSOS)
}

/**
 * ¿Está publicado? Solo si tiene audiencia.
 *
 * Sin audiencia NO es «para todos»: es un borrador que solo ve gestión. Al
 * revés, un manual interno subido sin elegir a quién quedaría a la vista de
 * todo el que tenga cuenta, por olvido.
 */
export function estaPublicado(r: { audience: unknown }): boolean {
  return hasRestriction(audienciaDeRecurso(r.audience))
}

/** ¿Puede subir, editar, definir la audiencia y retirar? El rol `recursos` o admin. */
export function gestionaRecursos(roles: readonly RoleId[] | null | undefined): boolean {
  return hasModulePermission([...(roles ?? [])], 'recursos', 'create')
}

/**
 * ¿Puede ABRIR este recurso?
 *
 * Gestión ve todo, publicado o no: tiene que poder revisar lo que sube. El
 * resto, solo lo publicado cuya audiencia lo incluye — y eso último lo dice el
 * servidor (`pasaLaAudiencia`), nunca la pantalla.
 */
export function puedeAbrir(opts: {
  gestiona: boolean
  publicado: boolean
  pasaLaAudiencia: boolean
}): boolean {
  if (opts.gestiona) return true
  return opts.publicado && opts.pasaLaAudiencia
}

/** El nombre con que se guarda en el bucket: sin nada que venga del usuario. */
export function rutaDelArchivo(id: string, tipo: TipoDeArchivo): string {
  const ext = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[tipo]
  return `${id}.${ext}`
}
