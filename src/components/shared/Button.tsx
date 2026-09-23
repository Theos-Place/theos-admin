'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  clasesDeBoton,
  type VarianteDeBoton, type TamanoDeBoton, type AnchoDeBoton, type RadioDeBoton,
} from '@/lib/ui/clases-de-boton'

/**
 * QA-1/N3 · El botón compartido.
 *
 * Las clases y el porqué de cada decisión viven en `lib/ui/clases-de-boton`,
 * que es puro y tiene los tests. Acá queda solo el cableado con React, y hay
 * una sola cosa que resolver: **de los 204 clicables con fondo de marca, buena
 * parte son `<Link>` y no `<button>`**. Si el componente solo supiera hacer
 * botones, la mitad de las pantallas seguiría escribiendo las clases a mano y
 * el refactor no serviría de nada. Por eso `href` cambia lo que se renderiza.
 *
 * `className` pasa por `cn`, que es `twMerge`: lo que se le pase PISA la clase
 * equivalente de la variante, no se suma a ella. Es el escape para lo que es de
 * ESA pantalla y de ninguna otra —un `shrink-0` en una barra apretada, un
 * relleno distinto— y no para cambiar el color: si hace falta un color nuevo,
 * es una variante nueva en `clases-de-boton`, donde queda medida y con test.
 */

type Comunes = {
  variante?: VarianteDeBoton
  tamano?: TamanoDeBoton
  ancho?: AnchoDeBoton
  radio?: RadioDeBoton
  resplandor?: boolean
  className?: string
  children: React.ReactNode
}

type ComoBoton = Comunes & { href?: undefined }
  & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

type ComoEnlace = Comunes & { href: string; disabled?: boolean }
  & Omit<React.ComponentProps<typeof Link>, 'className' | 'children' | 'href'>

export function Button(props: ComoBoton | ComoEnlace) {
  const { variante, tamano, ancho, radio, resplandor, className, children, ...resto } = props
  const clases = cn(clasesDeBoton({ variante, tamano, ancho, radio, resplandor }), className)

  if ('href' in resto && resto.href !== undefined) {
    const { href, disabled, ...enlace } = resto as ComoEnlace
    // Un `<a>` no entiende `disabled`: el atributo no existe y el clic pasa
    // igual. `aria-disabled` lo dice a los lectores de pantalla, y sacarlo del
    // orden de tabulación evita llegar con el teclado a algo que no funciona.
    // Las clases `disabled:*` tampoco aplican en un `<a>`, así que el aspecto
    // se resuelve acá con `data-inactivo`.
    return (
      <Link
        {...enlace}
        href={href}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? e => e.preventDefault() : enlace.onClick}
        className={cn(clases, disabled && 'opacity-40 pointer-events-none')}
      >
        {children}
      </Link>
    )
  }

  const { type = 'button', ...boton } = resto as ComoBoton
  // `type="button"` por defecto: el default del HTML es `submit`, y un botón
  // suelto dentro de un `<form>` que manda el formulario sin querer es de los
  // errores más difíciles de ver leyendo el código.
  return <button {...boton} type={type} className={clases}>{children}</button>
}
