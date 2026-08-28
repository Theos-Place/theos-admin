// Reglas de optimización del flyer de un evento (módulo puro).
//
// El procesamiento con sharp vive en la ruta de subida; acá están las
// decisiones, que es lo que conviene poder discutir y testear sin binarios.
//
// POR QUÉ HACE FALTA. Medido el 2026-08-28 sobre los flyers reales: dos de los
// cuatro pesan ~1 MB con 3400 y 3000 px de ancho, y se muestran a menos de 800.
// Es la imagen tal cual sale de Canva o del celular. Cada visita del calendario
// se baja eso entero.

/** Ancho máximo que se guarda. 1600 cubre una pantalla ancha en 2x sin pasarse:
 *  el flyer nunca se muestra a más de ~800 px de ancho en la app. */
export const MAX_ANCHO = 1600

/** Calidad WebP. 82 es el punto donde el archivo cae fuerte y el texto del
 *  flyer todavía se lee limpio. */
export const CALIDAD = 82

export type Medidas = { width: number; height: number }

/**
 * Cuánto hay que achicar, o null si ya está bien.
 *
 * NUNCA agranda: un flyer de 600 px se guarda de 600. Estirarlo solo agrega
 * peso y lo deja borroso.
 */
export function anchoDestino(m: Medidas): number | null {
  if (!m.width || m.width <= MAX_ANCHO) return null
  return MAX_ANCHO
}

/**
 * ¿Vale la pena quedarse con la versión optimizada?
 *
 * Si la conversión no achicó nada —pasa con imágenes ya chicas y muy
 * comprimidas— se guarda la original. Convertir por convertir cambia el formato
 * y la calidad a cambio de nada.
 */
export function valeLaPena(bytesOriginal: number, bytesOptimizado: number): boolean {
  return bytesOptimizado > 0 && bytesOptimizado < bytesOriginal * 0.9
}

/** Texto para el log/respuesta: "3400×1913, 1.0 MB → 1600×900, 128 KB". */
export function resumenOptimizacion(
  antes: Medidas & { bytes: number },
  despues: Medidas & { bytes: number },
): string {
  const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)
  return `${antes.width}×${antes.height}, ${kb(antes.bytes)} → ${despues.width}×${despues.height}, ${kb(despues.bytes)}`
}
