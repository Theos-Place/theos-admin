// Reglas puras de la subida del hero de un formulario (FRM-2).
// Separadas del handler para poder testear la validación sin red ni Storage.

export const HERO_BUCKET = 'form-heroes'
export const HERO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB, igual que el flyer de eventos
export const HERO_ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type HeroUploadError = { error: string; status: 400 }

/** Valida tipo y tamaño. null = pasa. */
export function validateHeroUpload(file: { type: string; size: number }): HeroUploadError | null {
  if (!(HERO_ALLOWED as readonly string[]).includes(file.type)) {
    return { error: 'Formato no permitido. Usá JPG, PNG o WEBP.', status: 400 }
  }
  if (file.size > HERO_MAX_BYTES) {
    return { error: 'La imagen supera el máximo de 5 MB.', status: 400 }
  }
  return null
}

/** Extensión del archivo según su MIME (no según el nombre, que miente). */
export function heroExtension(mime: string): string {
  return EXT[mime] ?? 'bin'
}
