'use client'

import { useRef, useState } from 'react'
import { Info } from 'lucide-react'

type Props = {
  /** Qué explica. Va también en el aria-label, porque el ícono no dice nada. */
  texto: string
}

/**
 * El "¿qué quiere decir esta columna?" de un encabezado de tabla.
 *
 * EL PANEL VA EN `position: fixed` Y CON COORDENADAS CALCULADAS, no `absolute`.
 * Con `absolute` lo recortaba el contenedor de la tabla —que tiene
 * `overflow-x-auto` para poder deslizarla— y la explicación se leía a medias
 * (reportado el 2026-09-21). `overflow` recorta a cualquier descendiente
 * posicionado, así que no hay z-index que lo salve: hay que sacarlo del flujo
 * del contenedor.
 *
 * Con `tabIndex` y `focus`, no solo `hover`: un tooltip que solo aparece con el
 * mouse no existe para quien navega con teclado ni en un teléfono, y acá se
 * explica el criterio con el que la tabla marca a alguien en rojo.
 */
export function InfoDelEncabezado({ texto }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  function abrir() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const ancho = 260
    // Que no se salga por la derecha en una pantalla angosta.
    const left = Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8)
    setPos({ top: r.bottom + 6, left })
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="img"
      aria-label={texto}
      onMouseEnter={abrir}
      onMouseLeave={() => setPos(null)}
      onFocus={abrir}
      onBlur={() => setPos(null)}
      className="relative ml-1 inline-flex align-[-2px] text-navy-light/80 outline-none"
    >
      <Info size={12} strokeWidth={2} aria-hidden />
      {pos && (
        <span
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 260 }}
          className="pointer-events-none z-[80] rounded-lg bg-navy px-3 py-2 text-[13px] font-normal normal-case tracking-normal leading-snug text-white shadow-[var(--shadow-lg)] font-body"
        >
          {texto}
        </span>
      )}
    </span>
  )
}
