/** Categorías de plantillas. Hay 5 "conocidas" con label/color propios; el resto
 *  son categorías libres creadas desde la UI, que caen al label/color por defecto. */

export const KNOWN_CATEGORIES = ['bienvenida', 'recordatorio', 'inscripcion', 'cancelacion', 'general'] as const

const KNOWN_LABELS: Record<string, string> = {
  bienvenida: 'Bienvenida',
  recordatorio: 'Recordatorio',
  inscripcion: 'Inscripción',
  cancelacion: 'Cancelación',
  general: 'General',
}

const KNOWN_COLORS: Record<string, string> = {
  bienvenida: 'bg-teal-soft/30 text-teal-deep',
  recordatorio: 'bg-amber-50 text-amber-700',
  inscripcion: 'bg-blue-50 text-blue-700',
  cancelacion: 'bg-coral/10 text-coral',
  general: 'bg-navy/10 text-navy-light',
}

/** Label legible: conocida → su nombre; libre → capitaliza la primera letra. */
export function categoryLabel(category: string): string {
  if (!category) return 'General'
  return KNOWN_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}

/** Clases de color del chip; las categorías nuevas usan un neutro. */
export function categoryColor(category: string): string {
  return KNOWN_COLORS[category] ?? 'bg-navy/10 text-navy-light'
}
