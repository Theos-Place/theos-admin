'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

type Props = {
  /** Qué explica. Va también en el aria-label, porque el ícono no dice nada. */
  texto: string
}

/** Margen mínimo contra cualquier borde de la ventana. */
const AIRE = 8
const ANCHO = 300

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
 * Y SE MIDE DESPUÉS DE PINTARLO, que es el arreglo del 2026-09-23. La primera
 * versión solo cuidaba el borde derecho: ponía el globo debajo del ícono y
 * listo. Con un texto largo —el de «Último estudio dado» son tres renglones
 * más— el globo se pasaba del borde de abajo y la última línea quedaba fuera de
 * la pantalla, sin forma de leerla: `pointer-events-none` impide hasta
 * seleccionarla. No se puede saber cuánto mide sin pintarlo, así que se pinta,
 * se mide y si no cabe abajo se pasa ARRIBA del ícono.
 *
 * Con `tabIndex` y `focus`, no solo `hover`: un tooltip que solo aparece con el
 * mouse no existe para quien navega con teclado ni en un teléfono, y acá se
 * explica el criterio con el que la tabla marca a alguien en rojo.
 */
export function InfoDelEncabezado({ texto }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const globo = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; medido: boolean } | null>(null)

  function abrir() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // Que no se salga por la derecha en una pantalla angosta.
    const left = Math.min(Math.max(AIRE, r.left), window.innerWidth - ANCHO - AIRE)
    setPos({ top: r.bottom + 6, left, medido: false })
  }

  // `medido` corta el ciclo: se corrige UNA vez por apertura. Sin esa marca,
  // cada setPos volvería a disparar el efecto.
  useLayoutEffect(() => {
    if (!pos || pos.medido) return
    const alto = globo.current?.getBoundingClientRect().height ?? 0
    const ancla = ref.current?.getBoundingClientRect()
    if (!alto || !ancla) return
    let top = pos.top
    if (top + alto > window.innerHeight - AIRE) {
      const arriba = ancla.top - alto - 6
      // Si tampoco cabe arriba —una ventana muy baja—, se pega al fondo antes
      // que dejar media explicación fuera.
      top = arriba >= AIRE ? arriba : Math.max(AIRE, window.innerHeight - alto - AIRE)
    }
    setPos({ ...pos, top, medido: true })
  }, [pos])

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
          ref={globo}
          role="tooltip"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: ANCHO,
            maxHeight: `calc(100vh - ${AIRE * 2}px)`,
            // Invisible hasta que se midió: si no, se ve saltar de abajo a
            // arriba del ícono en el primer frame.
            visibility: pos.medido ? 'visible' : 'hidden',
          }}
          className="pointer-events-none z-[80] overflow-auto rounded-lg bg-navy px-3 py-2 text-[13px] font-normal normal-case tracking-normal leading-snug text-white shadow-[var(--shadow-lg)] font-body"
        >
          {texto}
        </span>
      )}
    </span>
  )
}
