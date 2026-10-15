'use client'
import { useEffect } from 'react'

/**
 * QA-2/M2 · Un menú desplegable que se abre con teclado tiene que cerrarse con
 * Escape, y el foco tiene que volver al botón que lo abrió: si no, quien navega
 * sin mouse queda adentro de un menú que no sabe cómo cerrar.
 *
 * El botón que abre se reconoce por `aria-expanded="true"`, que es lo que lo
 * declara como disparador del menú; por eso no hace falta pasar una ref.
 */
export function useCerrarConEscape(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const disparador = document.querySelector<HTMLElement>('[aria-expanded="true"]')
      cerrar()
      disparador?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [abierto, cerrar])
}
