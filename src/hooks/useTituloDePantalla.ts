'use client'

import { useEffect } from 'react'
import { tituloDePantalla } from '@/lib/ui/titulo-de-pantalla'

/**
 * QA-1/N4 · Pone el título de la pestaña de una pantalla cliente.
 *
 * El porqué —y por qué no puede ser `metadata`— está en
 * `lib/ui/titulo-de-pantalla`, que es puro y tiene los tests. Acá queda solo el
 * efecto.
 *
 * `propio` puede llegar vacío mientras cargan los datos («» hasta saber el
 * nombre del grupo). En ese caso no se toca nada: escribir un título a medias y
 * corregirlo un segundo después deja basura en el historial del navegador.
 */
export function useTituloDePantalla(propio: string | null | undefined, seccion?: string) {
  useEffect(() => {
    if (!propio) return
    document.title = tituloDePantalla(propio, seccion)
  }, [propio, seccion])
}
