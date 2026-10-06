/**
 * Las siete provincias de Costa Rica, en el orden de siempre.
 *
 * Vive acá y no dentro de un formulario porque la lista se pinta en DOS
 * lugares desde UX-7: el formulario completo y la edición en sitio del
 * perfil. Dos copias se separan el día que alguien corrija una tilde.
 */
export const PROVINCIAS_CR = [
  'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón',
] as const

/** Con la forma que pide `CampoPerfilEditable` (valor = etiqueta). */
export const OPCIONES_PROVINCIA = PROVINCIAS_CR.map(p => ({ valor: p, etiqueta: p }))
