/**
 * El tipo REAL de un archivo, por sus primeros bytes.
 *
 * No se confía en el MIME que manda el navegador ni en la extensión: los dos
 * los decide quien sube. Esto lo usaban, cada uno con su copia, los documentos
 * de empleados; REC-1 (recursos) lo necesitaba igual y se juntó acá.
 *
 * `permitidos` es por llamador: cada pantalla acepta lo suyo. Documentos de
 * empleados sigue con PDF, PNG y JPEG; recursos suma WebP para infografías.
 */
export type TipoDeArchivo = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'

export function tipoPorContenido(
  bytes: Uint8Array,
  permitidos: readonly TipoDeArchivo[] = ['application/pdf', 'image/png', 'image/jpeg'],
): TipoDeArchivo | null {
  const b = bytes
  let t: TipoDeArchivo | null = null
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) t = 'application/pdf' // %PDF
  else if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) t = 'image/png'
  else if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) t = 'image/jpeg'
  // RIFF....WEBP
  else if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) t = 'image/webp'
  return t && permitidos.includes(t) ? t : null
}
