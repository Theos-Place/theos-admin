'use client'

import { Info } from 'lucide-react'

type Props = {
  /** Qué explica. Va también en el aria-label, porque el ícono no dice nada. */
  texto: string
}

/**
 * El "¿qué quiere decir esta columna?" de un encabezado de tabla.
 *
 * Con `tabIndex` y `group-focus-within` además de `hover`: un tooltip que solo
 * aparece con el mouse no existe para quien navega con teclado, y acá lo que se
 * explica es el criterio con el que la tabla marca a alguien en rojo.
 */
export function InfoDelEncabezado({ texto }: Props) {
  return (
    <span
      tabIndex={0}
      role="img"
      aria-label={texto}
      className="group/info relative ml-1 inline-flex align-[-2px] text-navy-light/80 outline-none"
    >
      <Info size={12} strokeWidth={2} aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[60] mt-1.5 hidden w-64 rounded-lg bg-navy px-3 py-2 text-[13px] font-normal normal-case tracking-normal leading-snug text-white shadow-[var(--shadow-lg)] font-body group-hover/info:block group-focus-within/info:block"
      >
        {texto}
      </span>
    </span>
  )
}
